import Anthropic from '@anthropic-ai/sdk';
import { Content, Part } from '@google/genai';
import OpenAI from 'openai';

import { MUSCLOG_GATEWAY_MAX_TOKENS, MUSCLOG_GATEWAY_PROVIDER } from '@/constants/gateway';
import { SETTINGS } from '@/constants/settingDefinitions';
import { DebugDumpService } from '@/database/services/DebugDumpService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n, { DEFAULT_LANG } from '@/lang/lang';
import { type HostedErrorKind, hostedErrorKindOf } from '@/utils/hostedAiError';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';

import { type AiEffort, type AiTask, effortFor, type ReasoningEffortValue } from './aiEffort';
import { notifyUserFacingAiError } from './aiErrorNotice';
import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  isAiConnectionError,
  OnDeviceUnavailableError,
  rethrowUserFacingAiError,
} from './aiErrors';
import { reviewAndRevise, runSamples, sameValue } from './aiPasses';
import { reportAiEvent } from './aiTelemetry';
import {
  effectiveThinkingLevel,
  EXTRACTION_FIRST_READINGS,
  extractionSamples,
  THINKING_PIPELINE,
  type ThinkingLevel,
} from './aiThinkingLevel';
import {
  buildClaudeClient,
  buildClaudeMessages,
  CLAUDE_MAX_TOKENS,
  CLAUDE_STREAM_MAX_TOKENS,
  claudeEffort,
  claudeStreamDelta,
  extractClaudeText,
} from './claude';
import { type HistoryTurn, tagTurnsWithTime } from './coachHistory';
import { combineExtractions } from './extractionConsensus';
import { resolveFoundationRefsInMeals } from './foundationFoodList';
import { withGatewayProviderPin } from './gatewayRouting';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from './gemini';
import { handleError } from './handleError';
import { readJsonStringField } from './jsonStringFieldStream';
import { withLlmRetry } from './llmRetry';
import { extractLlmUsage, type LlmUsage, mergeLlmUsage, recordLlmUsage } from './llmUsage';
import {
  checkStructuredShape,
  jsonRepairMessage,
  jsonRepairPrompt,
  MAX_JSON_REPAIR_INPUT_CHARS,
  parseStructuredJson,
  stripStreamingTemplateTokens,
  stripTemplateTokens,
  type StructuredResult,
} from './localReplyShape';
import type { MealImage } from './mealImages';
import { formatMealPhotoContext, type MealPhotoContext } from './mealPhotoContext';
import { ungroundedFigures } from './numberGrounding';
import { sendOnDeviceMessage, sendOnDeviceStructured, streamOnDeviceMessage } from './onDeviceAi';
import { ON_DEVICE_CONTEXT_CHARS, type OnDeviceEngine } from './onDeviceEngine';
import { sendLocalMessage, sendLocalStructuredRaw, streamLocalMessage } from './onDeviceLocal';
import { mealPlanFindings, workoutPlanFindings, workoutVolumeFindings } from './planFindings';
import {
  createWorkoutPlanPrompt,
  type FoundationFoodsPrompt,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getChatMessagePromptContent,
  getChatReviewInstruction,
  getEstimateMacrosFunctions,
  getExtractionArbiterMessage,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getFoundationFoodsPrompt,
  getGenerateMealPlanFunctions,
  getGenerateMealPlanPrompt,
  getGenerateWorkoutPlanFunctions,
  getInsightFactCheckInstruction,
  getMealCritiquePrompt,
  getNutritionInsightsPrompt,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getPlanReviewInstruction,
  getRecentWorkoutInsightsPromptByLogId,
  getRecentWorkoutsInsightsPrompt,
  getRetrospectiveNutritionPrompt,
  getWorkoutInsightsPrompt,
  getWorkoutVolumeInsightsPrompt,
  type MealSchemaDialect,
  withCustomPrompts,
} from './prompts';
import { prepareChatText, wrapUserContent } from './promptSanitizer';
import { type ChatPenalties, providerPolicyFor } from './providerPolicy';
import { isTruncatedStop, type StopSignal } from './replyTruncation';
import { captureMessage } from './sentry';

export class AiCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiCreditsError';
  }
}

export class GatewayRateLimitError extends AiCreditsError {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayRateLimitError';
  }
}

export function isAiCreditsError(error: any): boolean {
  // A used-up Premium allowance is a credits problem too (the person can use their own key).
  if (error instanceof AiCreditsError || hostedErrorKindOf(error) === 'budget') {
    return true;
  }

  const status = error?.status ?? error?.response?.status;
  const code = error?.error?.code ?? error?.code;
  const message = (error?.message ?? '').toLowerCase();
  if (status === 429 || status === 402) {
    return true;
  }

  // OpenRouter: a spent guardrail budget or key limit answers 403 with the limit's source.
  if (
    status === 403 &&
    String(error?.error?.metadata?.limit_source ?? '').startsWith('openrouter_')
  ) {
    return true;
  }

  if (code === 'insufficient_quota') {
    return true;
  }

  if (
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted') ||
    message.includes('billing') ||
    message.includes('credit balance')
  ) {
    return true;
  }

  return false;
}

/**
 * Hosted Premium kinds that reach Sentry: `unavailable` (the Worker failed: 5xx, hosted_disabled,
 * an expired session), `alreadyProcessed` (the app's idempotency key is broken) and
 * `consentRequired` (the consent header the Worker needs never arrived). Every other
 * hosted kind (budget, daily limit, subscription, removed, daily full, busy) is the subscriber's
 * normal state or a retry the app already handles, so it stays out.
 */
const HOSTED_KINDS_REPORTED = new Set<HostedErrorKind>([
  'unavailable',
  'alreadyProcessed',
  // The app sent no consent version, or an old one: the app and the Worker disagree on it.
  'consentRequired',
]);

/**
 * A rate limit or exhausted quota is the provider refusing the request, not a Musclog bug: it is
 * reported to the user (see `AiCreditsError`) but must not reach Sentry, where every busy hour on a
 * shared key or the gateway's daily cap filed an unactionable `429 status code (no body)` event.
 * A dropped connection (`isAiConnectionError`) is likewise the user's network, not ours.
 */
export function reportAiError(error: unknown, context: string): void {
  const hostedKind = hostedErrorKindOf(error);
  handleError(error, context, {
    sendToSentry:
      !isAiCreditsError(error) &&
      !isAiConnectionError(error) &&
      // Typed Premium failures are the Worker's answer, except the kinds that are real faults.
      (hostedKind === null || HOSTED_KINDS_REPORTED.has(hostedKind)) &&
      // A rejected key, a timeout and a cancel are the user's configuration or network, not bugs.
      !(
        error instanceof AiInvalidKeyError ||
        error instanceof AiTimeoutError ||
        error instanceof AiCancelledError
      ),
  });
}

export type CoachAIProvider =
  'gemini' | 'openai' | 'claude' | 'on-device' | 'local' | 'gateway' | 'hosted';

export interface ProviderConfig {
  maxCharBudget: number; // Maximum character budget for the total request context
  promptComplexity: 'minimal' | 'standard';
  enableContextInjection: boolean;
  enableFoundationFoods: boolean;
  enableMemories: boolean;
}

/** The context budget of every provider with a large context window. */
const LARGE_CONTEXT_CHAR_BUDGET = 64000;

export const PROVIDER_CONFIGS: Record<CoachAIProvider, ProviderConfig> = {
  'on-device': {
    // The tightest engine's budget; the engine's own is `ON_DEVICE_CONTEXT_CHARS`.
    maxCharBudget: ON_DEVICE_CONTEXT_CHARS.apple,
    promptComplexity: 'minimal',
    enableContextInjection: true,
    enableFoundationFoods: false,
    enableMemories: false,
  },
  gemini: {
    maxCharBudget: LARGE_CONTEXT_CHAR_BUDGET,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
  openai: {
    maxCharBudget: LARGE_CONTEXT_CHAR_BUDGET,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
  claude: {
    maxCharBudget: LARGE_CONTEXT_CHAR_BUDGET,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
  local: {
    maxCharBudget: 8000,
    promptComplexity: 'standard',
    enableContextInjection: true,
    // The whole list (about 11 KB, a few thousand tokens) goes to a custom server too; the person can
    // still turn "Send foundation foods to AI" off, and the server needs a context window to hold it.
    enableFoundationFoods: true,
    enableMemories: true,
  },
  gateway: {
    maxCharBudget: LARGE_CONTEXT_CHAR_BUDGET,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
  hosted: {
    maxCharBudget: LARGE_CONTEXT_CHAR_BUDGET,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
};

type CoachAIConfigFields = {
  provider: CoachAIProvider;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  language?: string;
  /** Aborts the request when the caller cancels (a Cancel button). */
  signal?: AbortSignal;
  /** Overrides the default request timeout, in milliseconds. */
  timeoutMs?: number;
  /** Set by daily background tasks, so their thinking level is capped (`effectiveThinkingLevel`). */
  background?: boolean;
  /** Iron consent version accepted on this device. */
  hostedConsentVersion?: number;
};

/** What only an `on-device` config carries: which engine answers and whether it can read photos. */
type OnDeviceFields = {
  engine: OnDeviceEngine;
  /** The engine can read a food photo (the downloaded model with its projector). */
  vision: boolean;
};

/** Every other provider has neither field, so `config.engine` reads the same on all of them. */
type NoOnDeviceFields = { engine?: undefined; vision?: undefined };

/**
 * A config that can send, or a hosted one whose session token could not be minted (built by
 * `AiService`): the second carries why, and its requests fail with the matching hosted error
 * without being sent, so the data recipient never changes silently. The failure exists only on the
 * hosted variant, and the engine only on the `on-device` one (`OnDeviceConfig`).
 */
export type CoachAIConfig =
  | (Omit<CoachAIConfigFields, 'provider'> & {
      provider: Exclude<CoachAIProvider, 'on-device'>;
      hostedGrantFailure?: undefined;
    } & NoOnDeviceFields)
  | (Omit<CoachAIConfigFields, 'provider'> & {
      provider: 'on-device';
      hostedGrantFailure?: undefined;
    } & OnDeviceFields)
  | (Omit<CoachAIConfigFields, 'provider' | 'apiKey' | 'baseUrl'> & {
      provider: 'hosted';
      hostedGrantFailure: PremiumActionFailure;
      apiKey?: undefined;
      baseUrl?: undefined;
    } & NoOnDeviceFields);

export type OnDeviceConfig = Extract<CoachAIConfig, { provider: 'on-device' }>;

export function isOnDeviceConfig(config: CoachAIConfig): config is OnDeviceConfig {
  return config.provider === 'on-device';
}

/**
 * The thinking level a request runs at: the stored setting, lowered by the provider (the free tier
 * never thinks) and by background tasks (`effectiveThinkingLevel`).
 */
export async function thinkingLevelFor(config: CoachAIConfig): Promise<ThinkingLevel> {
  return effectiveThinkingLevel(await SettingsService.get(SETTINGS.thinkingLevel), config);
}

/** The effort a job gets: its row of `AI_TASK_EFFORT` for the request's thinking level. */
async function resolveEffort(config: CoachAIConfig, task: AiTask): Promise<AiEffort> {
  return effortFor(task, await thinkingLevelFor(config));
}

/**
 * The `reasoning_effort` of an OpenAI-protocol request: the provider's own rule decides whether it
 * sends one (`ProviderPolicy.reasoningEffort`: OpenAI itself and Musclog Iron, never a local server
 * or the free tier, whose models may reject the field).
 */
async function openAiReasoning(
  config: CoachAIConfig,
  effort: AiEffort
): Promise<{ reasoning_effort?: ReasoningEffortValue }> {
  const reasoning = await providerPolicyFor(config).reasoningEffort?.(effort);

  return reasoning ? { reasoning_effort: reasoning } : {};
}

function buildOpenAIClient(config: CoachAIConfig): OpenAI {
  // Free-tier requests are pinned to one OpenRouter provider with no fallbacks (see
  // `withGatewayProviderPin`); OpenRouter answers browser CORS preflights, so no proxy is needed.
  const pinFetch: typeof fetch | undefined =
    config.provider === 'gateway' && MUSCLOG_GATEWAY_PROVIDER
      ? (url, init) =>
          fetch(
            url,
            init?.body === undefined
              ? init
              : {
                  ...init,
                  body: withGatewayProviderPin(
                    init.body,
                    MUSCLOG_GATEWAY_PROVIDER,
                    MUSCLOG_GATEWAY_MAX_TOKENS
                  ),
                }
          )
      : undefined;

  return new OpenAI({
    apiKey: config.apiKey ?? 'unused',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
    // `withLlmRetry` is the only retry loop: the SDK's own (two retries by default) would repeat a
    // failure inside every one of its attempts. Per-request headers (the hosted idempotency key) are
    // passed per call through the `options` that `withLlmRetry` hands the request, never as client
    // defaults.
    maxRetries: 0,
    fetch: pinFetch,
  });
}

export async function logLlmDebugEvent(params: {
  provider: CoachAIProvider;
  direction: 'request' | 'response';
  operation: string;
  payload: unknown;
  config?: CoachAIConfig;
}): Promise<void> {
  try {
    await DebugDumpService.logJsonEvent({
      provider: params.provider,
      direction: params.direction,
      operation: params.operation,
      payload: params.payload,
      secrets: params.config?.apiKey ? [params.config.apiKey] : [],
    });
  } catch (error) {
    console.warn('[coachAI] Failed to write debug dump:', error);
  }
}

export type ChatHistoryEntry = HistoryTurn;

export type CoachResponse = {
  msg4User: string;
  /** Only older replies and the templated ones carry one; the model is no longer asked for it. */
  sumMsg?: string;
  sumUserMsg?: string;
  rememberMe?: string;
};

/**
 * Pass one to a reply function to see the reply while it is written. `onText` gets the visible text
 * so far (never a fragment), each time it grows. Without it the call is one request, one answer.
 */
export type CoachStream = {
  onText: (textSoFar: string) => void;
  /** Said once, before any text, when the reply is first drafted unseen and then double-checked. */
  onPhase?: (phase: 'reviewing') => void;
};

type StreamSink = {
  onDelta: (delta: string) => void;
  /** Starts a new attempt: whatever a failed attempt had received is forgotten. */
  reset: () => void;
  /** True once text has reached `onText`. From then on a failure is not retried. */
  hasEmitted: () => boolean;
  /** Everything received, unparsed. */
  raw: () => string;
};

/**
 * `plain`: the text is the reply. `coachJson`: the text is the coach's JSON object, of which only
 * `msg4User` is shown (it is the first property, so it can be shown while the rest is written).
 */
function createStreamSink(stream: CoachStream, mode: 'plain' | 'coachJson'): StreamSink {
  let raw = '';
  let shown = '';
  let emitted = false;

  return {
    onDelta: (delta) => {
      raw += delta;
      // Leaked template tokens are held back in both modes; in JSON mode first, or a reply behind
      // a `<|im_start|>assistant` header reads as non-JSON and streams as raw text.
      const cleaned = stripStreamingTemplateTokens(raw);
      const visible = mode === 'plain' ? cleaned : readJsonStringField(cleaned, 'msg4User');
      if (!visible || visible === shown) {
        return;
      }

      shown = visible;
      emitted = true;
      stream.onText(visible);
    },
    reset: () => {
      raw = '';
      shown = '';
    },
    hasEmitted: () => emitted,
    raw: () => raw,
  };
}

type ClaudeParams = Anthropic.MessageCreateParamsNonStreaming;

/**
 * One Claude request. Structured output goes through `output_config.format` rather than a forced
 * tool call, which the newest models reject; the schema is made strict because Claude requires
 * `additionalProperties: false` on every object.
 */
async function buildClaudeParams(
  config: CoachAIConfig,
  system: string,
  messages: Anthropic.MessageParam[],
  options: { task: AiTask; schema?: object; cache?: boolean }
): Promise<ClaudeParams> {
  return {
    model: config.model,
    // Automatic prompt caching: the rules, persona, profile and data are the same from one message
    // to the next, so only the newest turn is paid for in full. Chat only: a one-off request
    // would pay the cache write for nothing.
    ...(options.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    max_tokens: CLAUDE_MAX_TOKENS,
    system,
    messages,
    output_config: {
      effort: claudeEffort(await resolveEffort(config, options.task)),
      ...(options.schema
        ? { format: { type: 'json_schema', schema: makeSchemaStrict(options.schema) } }
        : {}),
    },
  };
}

// --- One completion, whatever the cloud provider ---

/**
 * What every Gemini, Claude and OpenAI-compatible request needs. The chat reply, a plain-text insight
 * and a structured job are the same request with a different `schema` and `sink`, so they share this
 * one funnel: it is the only place the debug dump is written and the token usage recorded.
 */
type CompletionRequest = {
  /** Names the call in debug dumps, retry logs and token usage. */
  operation: string;
  system: string;
  /** The conversation before `userMessage`. */
  turns: readonly ChatHistoryEntry[];
  userMessage: string;
  images?: readonly MealImage[];
  /** What kind of job this is, which decides how hard the model reasons. */
  task: AiTask;
  /** A reply that must fit this JSON schema (a structured job, or the chat reply object). */
  schema?: { name: string; body: object };
  /** Streams the reply into this sink; without one the call is a single request. */
  sink?: StreamSink | null;
  /** Free chat only: the provider's repetition penalties and prompt caching. */
  chat?: boolean;
};

type Completion = { text: string; stop?: StopSignal };

/** A request ready to send: what the debug dump shows, and the call itself. */
type PreparedCall = {
  payload: unknown;
  send: () => Promise<Completion & { usage: LlmUsage | null }>;
};

async function prepareGeminiCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
  const { operation, system, sink, schema } = request;
  const systemParts: Part[] = [{ text: system }];
  const genModel = await configureBasicGenAI(
    {
      apiKey: config.apiKey,
      model: config.model,
      generationConfig: buildGeminiGenerationConfig(config.model, {
        effort: await resolveEffort(config, request.task),
        // A reply that must fit a schema is JSON; a plain-text insight is not.
        ...(schema ? { responseSchema: schema.body } : { json: false }),
      }),
    },
    systemParts
  );
  const contents = buildGeminiContents(request.turns, request.userMessage, request.images);

  return {
    payload: { model: config.model, contents, systemPrompt: system, schema: schema?.body },
    send: async () => {
      if (sink) {
        let usage: LlmUsage | null = null;
        const text = await withLlmRetry(
          operation,
          config,
          async (signal, touch) => {
            sink.reset();
            usage = null;
            const chunks = await genModel.generateContentStream({
              contents,
              abortSignal: signal,
            });
            for await (const chunk of chunks) {
              touch();
              usage = mergeLlmUsage(usage, extractLlmUsage(chunk));
              const { text: delta } = extractGeminiText(chunk);
              if (delta) {
                sink.onDelta(delta);
              }
            }

            return sink.raw();
          },
          { hasStreamed: sink.hasEmitted }
        );

        return { text, usage };
      }

      const result = await withLlmRetry(operation, config, (signal) =>
        genModel.generateContent({ contents, abortSignal: signal })
      );
      const { text, finishReason } = extractGeminiReply(result);

      return {
        text,
        stop: { source: 'gemini', reason: finishReason },
        usage: extractLlmUsage(result),
      };
    },
  };
}

async function prepareOpenAiCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
  const { operation, sink, schema } = request;
  const client = buildOpenAIClient(config);
  const images = request.images ?? [];
  const payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: request.system },
      ...normalizeHistory(request.turns).map((entry) => ({
        role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: entry.content,
      })),
      {
        role: 'user',
        content:
          images.length > 0
            ? [
                { type: 'text', text: request.userMessage },
                ...images.map((image) => ({
                  type: 'image_url' as const,
                  image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
                })),
              ]
            : request.userMessage,
      },
    ],
    ...(request.chat ? providerPolicyFor(config).chatSampling : {}),
    ...(await openAiReasoning(config, await resolveEffort(config, request.task))),
    ...(schema
      ? {
          response_format: {
            type: 'json_schema' as const,
            json_schema: { name: schema.name, strict: true, schema: makeSchemaStrict(schema.body) },
          },
        }
      : {}),
  };

  return {
    payload,
    send: async () => {
      if (sink) {
        let usage: LlmUsage | null = null;
        const text = await withLlmRetry(
          operation,
          config,
          async (_signal, touch, options) => {
            sink.reset();
            usage = null;
            const chunks = await client.chat.completions.create(
              { ...payload, stream: true },
              options
            );
            for await (const chunk of chunks) {
              touch();
              // Only present when the provider sends it (OpenRouter does, on the last chunk).
              usage = mergeLlmUsage(usage, extractLlmUsage(chunk));
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                sink.onDelta(delta);
              }
            }

            return sink.raw();
          },
          { hasStreamed: sink.hasEmitted }
        );

        return { text, usage };
      }

      const completion = await withLlmRetry(operation, config, (_signal, _touch, options) =>
        client.chat.completions.create(payload, options)
      );
      const choice = completion.choices[0];

      return {
        text: choice?.message?.content ?? '',
        stop: { source: 'openai', reason: choice?.finish_reason },
        usage: extractLlmUsage(completion),
      };
    },
  };
}

async function prepareClaudeCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
  const { operation, sink } = request;
  const client = buildClaudeClient(config.apiKey, 0);
  const images = request.images ?? [];
  const params = await buildClaudeParams(
    config,
    request.system,
    buildClaudeMessages(
      [...request.turns],
      images.length > 0
        ? [
            ...images.map((image) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: claudeImageType(image.mimeType),
                data: image.base64,
              },
            })),
            { type: 'text' as const, text: request.userMessage },
          ]
        : request.userMessage
    ),
    { task: request.task, schema: request.schema?.body, cache: request.chat }
  );

  return {
    payload: params,
    send: async () => {
      if (sink) {
        let usage: LlmUsage | null = null;
        // A stream has no HTTP timeout to stay under, so it may ask for more tokens.
        const text = await withLlmRetry(
          operation,
          config,
          async (signal, touch) => {
            sink.reset();
            const events = client.messages.stream(
              { ...params, max_tokens: CLAUDE_STREAM_MAX_TOKENS },
              { signal }
            );
            for await (const event of events) {
              touch();
              const delta = claudeStreamDelta(event);
              if (delta) {
                sink.onDelta(delta);
              }
            }

            usage = await finalClaudeUsage(events);

            return sink.raw();
          },
          { hasStreamed: sink.hasEmitted }
        );

        return { text, usage };
      }

      const message = await withLlmRetry(operation, config, (signal) =>
        client.messages.create(params, { signal })
      );
      const { text, stopReason } = extractClaudeText(message);

      return {
        text,
        stop: { source: 'claude', reason: stopReason },
        usage: extractLlmUsage(message),
      };
    },
  };
}

/** One Gemini, Claude or OpenAI-compatible request, retried and timed out by `withLlmRetry`. */
async function complete(config: CoachAIConfig, request: CompletionRequest): Promise<Completion> {
  let prepare = prepareOpenAiCall;
  if (config.provider === 'gemini') {
    prepare = prepareGeminiCall;
  } else if (config.provider === 'claude') {
    prepare = prepareClaudeCall;
  }

  const call = await prepare(config, request);
  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation: request.operation,
    payload: call.payload,
    config,
  });

  const { usage, ...completion } = await call.send();
  noteUsage(config, request.operation, usage);
  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: request.operation,
    payload: completion,
    config,
  });

  return completion;
}

/**
 * Response types for various AI functions
 */

export type WorkoutPlan = {
  title: string;
  description?: string;
  recurringOnWeekDay: string;
  exercises: {
    exerciseId: string;
    reps: number;
    sets: number;
    oneRepMaxPercentage: number;
  }[];
};

export type GenerateWorkoutPlanResponse = {
  planTitle: string;
  workoutPlan: WorkoutPlan[];
  description: string;
};

export type CalculateVolumeResponse = {
  messageToUser: string;
  workoutVolume: {
    exerciseId: number;
    sets: {
      setId: number;
      reps: number;
      weight: number;
    }[];
  }[];
};

export type MacroEstimate = {
  name: string;
  kcal: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber: number;
  grams: number;
  barcode?: string;
  foodId?: string;
};

export type ParsedWorkout = {
  title: string;
  date: string;
  duration?: number;
  description?: string;
  exercises: {
    name: string;
    muscleGroup?: string;
    type?: string;
    sets: {
      reps: number;
      weight: number;
    }[];
  }[];
};

export type ParsedNutrition = {
  date: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
};

export type TrackMealIngredient = {
  name: string;
  kcal: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number;
  grams: number;
  foodId?: string;
};

export type TrackedMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName?: string;
  ingredients: TrackMealIngredient[];
};

export type TrackMealResponse = {
  meals: TrackedMeal[];
};

export type RecipeIngredient = {
  name: string;
  /** The food's plain English name, used only to find it among the stored foods; never shown. */
  englishName?: string;
  grams: number;
  foodId?: string;
};

export type RecipeTrackedMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName: string;
  ingredients: RecipeIngredient[];
};

export type RecipeExtractionResponse = {
  meals: RecipeTrackedMeal[];
};

export type MissingIngredientMacrosResponse = {
  ingredients: TrackMealIngredient[];
};

export type GenerateMealPlanResponse = {
  meals: {
    day: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    description: string;
    ingredients: TrackMealIngredient[];
  }[];
  description: string;
};

export type NutritionEntry = {
  productTitle: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  mealType: number; // 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack, 5=Other
  fiber?: number;
  sodium?: number;
  sugar?: number;
};

const baseSchemaProperties = {
  msg4User: {
    type: 'string',
    description: 'The full response to display to the user in the chat.',
  },
};

const rememberMeProperty = {
  remember_me: {
    type: 'string',
    description:
      'A short neutral fact worth keeping about the user for months (an injury, a preference, equipment, a schedule, a goal). An empty string when there is nothing.',
  },
};

/**
 * `remember_me` is required (an empty string means "nothing"): strict structured output wants every
 * property listed, and a small model fills a required field more reliably than it opts into an
 * optional one.
 */
const CHAT_PROPERTY_ORDER = ['msg4User', 'remember_me'];

function buildResponseSchema() {
  return {
    type: 'object',
    properties: { ...baseSchemaProperties, ...rememberMeProperty },
    required: ['msg4User', 'remember_me'],
  };
}

/**
 * Normalizes a history array so that no two consecutive entries share the same role.
 * Consecutive same-role messages are merged (content joined with newline).
 * This is required by Gemini (strict alternation) and produces cleaner context for OpenAI too.
 */
export function normalizeHistory(history: readonly ChatHistoryEntry[]): ChatHistoryEntry[] {
  const result: ChatHistoryEntry[] = [];
  for (const entry of history) {
    const prev = result[result.length - 1];
    if (prev && prev.role === entry.role) {
      prev.content = prev.content + '\n' + entry.content;
    } else {
      result.push({ ...entry });
    }
  }

  return result;
}

/**
 * Truncates chat history to fit within a character budget,
 * keeping the most recent messages.
 */
export function truncateHistoryByBudget(
  history: ChatHistoryEntry[],
  maxChars: number
): ChatHistoryEntry[] {
  let currentChars = 0;
  const truncated: ChatHistoryEntry[] = [];

  // Traverse backwards to keep the most recent, relevant context
  for (let i = history.length - 1; i >= 0; i--) {
    const msgLength = history[i].content.length;
    // If adding this message exceeds budget, stop if we already have context.
    // If it's the very first message (most recent) and it's too big, we keep it
    // but the model might still fail; however, we prioritize having at least one message.
    if (currentChars + msgLength > maxChars && truncated.length > 0) {
      break;
    }

    truncated.unshift({ ...history[i] });
    currentChars += msgLength;
  }

  return truncated;
}

// --- Helper Functions ---

/** The answer text of a Gemini response and its `finishReason`, warning when there is no text. */
function extractGeminiReply(response: any): { text: string; finishReason?: string } {
  const { text, finishReason, blockReason, thoughtOnly } = extractGeminiText(response);
  if (!text.trim()) {
    // An empty answer has several different causes; say which, so "analyzing forever" is debuggable.
    console.warn(
      `[coachAI] Gemini returned no answer text (finishReason=${finishReason ?? 'none'}, blockReason=${blockReason ?? 'none'}, thoughtOnly=${thoughtOnly})`
    );
  }

  return { text, finishReason };
}

function parseCoachResponse(raw: string): CoachResponse {
  // The same ladder every structured reply gets (fences and template tokens, the JSON inside text,
  // `jsonrepair`), so almost-JSON from a small model is not shown to the person as raw JSON.
  const parsed = parseStructuredJson<Record<string, unknown>>(raw);
  const fields =
    parsed.kind === 'ok' && typeof parsed.value === 'object' ? (parsed.value ?? {}) : {};
  const text = (field: string): string | undefined =>
    typeof fields[field] === 'string' ? (fields[field] as string) : undefined;

  // Cut off, too broken to repair or missing the reply field: the field can often still be read out
  // of the text (`readJsonStringField` passes text that is not a JSON object through), and otherwise
  // the text itself is the reply.
  const stripped = stripTemplateTokens(raw);
  const readable = readJsonStringField(stripped, 'msg4User');

  return {
    msg4User: text('msg4User') ?? (readable.trim() ? readable : stripped || raw),
    sumMsg: text('sumMsg'),
    sumUserMsg: text('sumUserMsg'),
    rememberMe: text('remember_me'),
  };
}

/** The latest turns a free-chat reply is sent, under the provider's turn cap when it has one. */
function latestChatTurns(history: ChatHistoryEntry[], config: CoachAIConfig): ChatHistoryEntry[] {
  const max = providerPolicyFor(config).maxChatHistoryTurns;

  return max === undefined ? history : history.slice(-max);
}

function buildGeminiContents(
  history: readonly ChatHistoryEntry[],
  userMessage: string,
  images: readonly MealImage[] = []
): Content[] {
  const normalized = normalizeHistory(history);
  const historyContents: Content[] = normalized.map((entry) => ({
    parts: [{ text: entry.content } as Part],
    role: entry.role === 'coach' ? 'model' : 'user',
  }));

  return [
    ...historyContents,
    {
      parts: [
        { text: userMessage } as Part,
        ...images.map(
          (image) => ({ inlineData: { data: image.base64, mimeType: image.mimeType } }) as Part
        ),
      ],
      role: 'user',
    },
  ];
}

/**
 * Recursively adds additionalProperties: false to all objects in a JSON schema.
 * Required for OpenAI's 'strict: true' mode.
 */
function makeSchemaStrict(schema: any): any {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  if (schema.type === 'object') {
    const properties = schema.properties ? { ...schema.properties } : {};
    Object.keys(properties).forEach((key) => {
      properties[key] = makeSchemaStrict(properties[key]);
    });

    return {
      ...schema,
      properties,
      additionalProperties: false,
    };
  }

  if (schema.type === 'array' && schema.items) {
    return {
      ...schema,
      items: makeSchemaStrict(schema.items),
    };
  }

  return schema;
}

/**
 * The chat system prompt. A session the conversation already carries in full (the workout just
 * finished) is left out of the prompt's own list of recent workouts, or the model reads it twice.
 */
function chatSystemPrompt(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  context?: 'nutrition' | 'exercise' | 'general'
): Promise<string> {
  return getChatMessagePromptContent(config.language, undefined, context, config.provider, {
    excludeWorkoutLogIds: history.flatMap((entry) =>
      entry.workoutLogId ? [entry.workoutLogId] : []
    ),
  });
}

/** The usage of a finished Claude stream. Telemetry only: whatever goes wrong, the reply stands. */
async function finalClaudeUsage(events: {
  finalMessage?: () => Promise<unknown>;
}): Promise<LlmUsage | null> {
  try {
    return extractLlmUsage(await events.finalMessage?.());
  } catch {
    return null;
  }
}

/** Keeps what a request cost, so cache hits and bloat can be seen. */
function noteUsage(config: CoachAIConfig, operation: string, usage: LlmUsage | null): void {
  if (usage) {
    recordLlmUsage({ operation, provider: config.provider, usage });
  }
}

// --- Provider Implementations ---

/**
 * The senders are transport only: the system prompt and the trimmed turns arrive ready, and any
 * failure is thrown. `sendCoachMessage` turns a failure into the apology once.
 *
 * A Gemini, Claude or OpenAI-compatible chat reply is one request for the coach's JSON object, of
 * which only `msg4User` is shown while it is written. Gemini does not promise the schema's property
 * order, and the reply is shown from the first property while the rest is still being written, so it
 * is told the order.
 */
async function sendViaCloud(
  config: CoachAIConfig,
  systemPrompt: string,
  turns: ChatHistoryEntry[],
  userMessage: string,
  stream?: CoachStream
): Promise<CoachResponse> {
  const body = buildResponseSchema();
  const reply = await complete(config, {
    operation: 'sendCoachMessage',
    system: systemPrompt,
    turns,
    userMessage,
    task: 'chat',
    schema: {
      name: 'coach_response',
      body:
        config.provider === 'gemini' ? { ...body, propertyOrdering: CHAT_PROPERTY_ORDER } : body,
    },
    sink: stream ? createStreamSink(stream, 'coachJson') : null,
    chat: true,
  });

  return parseCoachResponse(reply.text);
}

/** The context budget of the engine behind an `on-device` config. */
function onDeviceBudget(config: OnDeviceConfig): number {
  return ON_DEVICE_CONTEXT_CHARS[config.engine];
}

/**
 * One plain-text generation on the on-device engine. The downloaded model goes through
 * `withLlmRetry` (idle timeout, cancel, never retried once text is on screen); Apple's system
 * model keeps its own path.
 */
async function runOnDeviceText(
  config: OnDeviceConfig,
  operation: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string | undefined,
  sink: StreamSink | null,
  penalties?: ChatPenalties
): Promise<string> {
  if (config.engine === 'gguf') {
    return withLlmRetry(
      operation,
      config,
      async (signal, touch) => {
        sink?.reset();
        if (!sink) {
          return sendLocalMessage(messages, systemPrompt, signal, penalties);
        }

        const streamed = await streamLocalMessage(
          messages,
          systemPrompt,
          (delta) => {
            touch();
            sink.onDelta(delta);
          },
          signal,
          penalties
        );

        // The runtime's text is llama.cpp's parsed message, already cleaned; the raw stream is the
        // fallback when it parsed to nothing.
        return streamed || sink.raw();
      },
      { hasStreamed: () => sink?.hasEmitted() ?? false }
    );
  }

  const text = sink
    ? await streamOnDeviceMessage(messages, systemPrompt, sink.onDelta, config.signal)
    : await sendOnDeviceMessage(messages, systemPrompt);

  return text ?? '';
}

async function sendViaOnDevice(
  config: OnDeviceConfig,
  systemPrompt: string,
  turns: ChatHistoryEntry[],
  userMessage: string,
  stream?: CoachStream
): Promise<CoachResponse> {
  const sink = stream ? createStreamSink(stream, 'plain') : null;
  const normalized = normalizeHistory(turns);

  const messages = [
    ...normalized.map((e) => ({
      role: (e.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: e.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'request',
    operation: 'sendCoachMessage',
    payload: { systemPrompt, messages },
    config,
  });

  // Chat-template tokens a model leaks (`<|im_start|>assistant …`) never reach the person.
  const raw = stripTemplateTokens(
    await runOnDeviceText(
      config,
      'sendViaOnDevice',
      messages,
      systemPrompt,
      sink,
      providerPolicyFor(config).chatSampling
    )
  );

  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'response',
    operation: 'sendCoachMessage',
    payload: { text: raw },
    config,
  });

  // An empty reply stays empty: the reply service takes the person's message back and offers a
  // retry. Saving the apology as the coach's answer put it into the history, and a small model
  // copies its own earlier replies.
  return { msg4User: raw, sumMsg: raw.slice(0, 120) };
}

// --- Helpers for insight/parsing/vision ---

const INSIGHTS_USER_MESSAGE = 'Based on the data above, provide your analysis and insights.';

/**
 * The plain-text path for Apple's on-device model. It used to fall through to the OpenAI client
 * (no base URL, key "unused"), which sent the prompt — workout and nutrition data — to OpenAI,
 * was rejected, and left every insight feature broken on-device.
 */
async function generateTextOnDevice(
  config: OnDeviceConfig,
  systemPrompt: string,
  history: ChatHistoryEntry[],
  userMessage: string,
  stream?: CoachStream
): Promise<string> {
  const truncatedHistory = truncateHistoryByBudget(
    history,
    onDeviceBudget(config) - userMessage.length
  );
  const messages = [
    ...normalizeHistory(truncatedHistory).map((entry) => ({
      role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: entry.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'request',
    operation: 'generateText',
    payload: { systemPrompt, messages },
    config,
  });

  const sink = stream ? createStreamSink(stream, 'plain') : null;
  const raw = await runOnDeviceText(config, 'generateText', messages, systemPrompt, sink);

  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'response',
    operation: 'generateText',
    payload: { text: raw },
    config,
  });

  return raw;
}

/**
 * Text a review round, an arbiter or a first look adds to a request that was already sent. It is
 * written by code, so it never goes through `wrapUserContent` (which cuts at 2,000 characters and
 * escapes quotes and newlines); only the person's own words are sanitized, once, in the original.
 */
export type FollowUp = {
  /** The answer being reviewed. It becomes the model's own turn, whole and word for word. */
  answer?: string;
  /** What to do now. It is the last user turn. */
  instruction: string;
};

/**
 * The original request again, plus a follow-up: the same system prompt, history, photos and
 * (already sanitized) user message. With an answer the turns alternate (original message, the
 * answer, the instruction), which Gemini requires; without one the instruction joins the same user
 * turn, since two user turns in a row would break that alternation.
 */
export function followUpOf<R extends { history: ChatHistoryEntry[]; userMessage: string }>(
  request: R,
  followUp: FollowUp
): R {
  if (followUp.answer === undefined) {
    return { ...request, userMessage: `${request.userMessage}\n\n${followUp.instruction}` };
  }

  return {
    ...request,
    history: [
      ...request.history,
      { role: 'user', content: request.userMessage },
      { role: 'coach', content: followUp.answer },
    ],
    userMessage: followUp.instruction,
  };
}

/** The language line a plain-text request without conversation history ends its system prompt with. */
function withLanguageNote(systemPrompt: string, config: CoachAIConfig): string {
  return `${systemPrompt}\n\nRespond in the following language/locale: ${config.language ?? DEFAULT_LANG}.`;
}

/**
 * One plain-text reply from the configured provider, as it came back. The user message arrives
 * ready to send: the person's words were sanitized by the caller, a follow-up is trusted text.
 */
async function requestPlainText(
  config: CoachAIConfig,
  operation: string,
  systemPrompt: string,
  recentConversation: ChatHistoryEntry[],
  sanitizedFinalUserMessage: string,
  stream: CoachStream | undefined,
  task: AiTask
): Promise<string> {
  if (isOnDeviceConfig(config)) {
    return generateTextOnDevice(
      config,
      systemPrompt,
      recentConversation,
      sanitizedFinalUserMessage,
      stream
    );
  }

  return (
    await complete(config, {
      operation,
      system: systemPrompt,
      turns: recentConversation,
      userMessage: sanitizedFinalUserMessage,
      task,
      sink: stream ? createStreamSink(stream, 'plain') : null,
    })
  ).text;
}

/**
 * The JSON Schema of the first function of a `get*Functions()` list. Gemini's declarations and
 * OpenAI's functions both carry it as `parameters`, so one reader serves every dialect.
 */
export function schemaOfFunction(fns: readonly { parameters?: unknown }[]): object {
  const parameters = fns[0]?.parameters;
  if (typeof parameters !== 'object' || parameters === null) {
    return { type: 'object', properties: {}, required: [] };
  }

  const { type, properties, required } = parameters as {
    type?: unknown;
    properties?: unknown;
    required?: unknown;
  };

  return {
    type: typeof type === 'string' ? type : 'object',
    properties: typeof properties === 'object' && properties !== null ? properties : {},
    required: Array.isArray(required) ? required : [],
  };
}

export type StructuredDialect = 'openai' | 'gemini' | 'claude' | 'on-device' | 'gguf';

export type StructuredRequest = {
  /** Names the call in debug dumps and retry logs. */
  operation: string;
  schemaName: string;
  /** Already carries any language note. */
  systemPrompt: string;
  /** The conversation so far, without the message being sent. */
  history: ChatHistoryEntry[];
  userMessage: string;
  /**
   * Photos that go with the user message, already prepared (`prepareMealImages`). Apple's on-device
   * engine takes none. The downloaded model reads ONE photo per request (the first), so a meal of
   * several photos is read one request at a time (`estimateMealFromPhotoOnDevice`).
   */
  images?: readonly MealImage[];
  /** Each provider takes the schema in a slightly different dialect. */
  buildSchema: (dialect: StructuredDialect) => object;
  /** What kind of job this is, which decides how hard the model reasons. Defaults to extraction. */
  task?: AiTask;
  /** Sampling temperature, for the downloaded model only (a warmer retry of an unusable reply). */
  temperature?: number;
};

/**
 * Last resort for a local model's structured reply: one text-only structured request that is asked to
 * correct the broken reply against the schema, sent through the same funnel and shape check. It runs
 * only after the parser, `jsonrepair` and the schema check all failed, so a good reply never pays for
 * it. A failure of the repair call leaves the original failure; only a cancel is rethrown.
 */
export async function repairStructuredWithModel<T>(
  config: CoachAIConfig,
  operation: string,
  broken: string,
  schema: object
): Promise<StructuredResult<T> | null> {
  // A reply longer than a repair request can carry would be cut short, and the model would answer
  // with the part it saw: a repaired list that silently lost its tail. Better no repair at all.
  if (!broken.trim() || broken.length > MAX_JSON_REPAIR_INPUT_CHARS) {
    return null;
  }

  const repairOperation = `${operation}.repair`;
  try {
    const repaired = await requestStructuredOnce<T>(
      config,
      {
        operation: repairOperation,
        schemaName: 'repair',
        systemPrompt: jsonRepairPrompt(schema),
        history: [],
        userMessage: jsonRepairMessage(broken),
        buildSchema: () => schema,
      },
      schema
    );

    return checkStructuredShape(repaired, schema, repairOperation);
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    // The original failure stands, but a repair that itself breaks is worth knowing about.
    reportAiError(error, 'coachAI.repairStructured');

    return null;
  }
}

/**
 * The one shape check and repair of a structured reply from a provider that does not enforce its
 * schema (`structuredReplies: 'repaired'`): a reply that is malformed or misses the schema gets one repair
 * call. The downloaded model is held to its schema, since its grammar is enforced by a runtime we do
 * not control and nothing may read its answer unchecked. A custom server's reply that parsed but
 * missed part of the schema is kept when the repair does not do better, because callers of an
 * OpenAI-compatible endpoint have always tolerated a partial answer.
 */
async function reviveLocalStructured<T>(
  config: CoachAIConfig,
  operation: string,
  result: StructuredResult<T>,
  schema: object
): Promise<StructuredResult<T>> {
  const policy = providerPolicyFor(config);
  if (policy.structuredReplies !== 'repaired') {
    return result;
  }

  const checked = checkStructuredShape(result, schema, operation);
  if (checked.kind === 'ok') {
    return checked;
  }

  const repaired = await repairStructuredWithModel<T>(config, operation, checked.raw, schema);
  const telemetry = { provider: config.provider, operation: operationFamily(operation) };
  if (repaired?.kind === 'ok') {
    reportAiEvent('ai-structured-reply-repaired', telemetry);

    return repaired;
  }

  // Still unusable: the reply stays as a tolerant server's partial answer, or fails the request.
  reportAiEvent('ai-structured-reply-unusable', telemetry);

  return policy.keepsPartialStructuredReply && result.kind === 'ok' ? result : checked;
}

/** `estimateMissingIngredients.repair` and `estimateMissingIngredients` are one operation to count. */
function operationFamily(operation: string): string {
  return operation.split('.')[0];
}

/** The schema dialect a structured request to this provider (and on-device, engine) is written in. */
function structuredDialect(config: CoachAIConfig): StructuredDialect {
  switch (config.provider) {
    case 'on-device':
      return config.engine === 'gguf' ? 'gguf' : 'on-device';
    case 'gemini':
    case 'claude':
      return config.provider;
    default:
      return 'openai';
  }
}

/**
 * The dialect the meal schemas (recipe, estimate, review, meal plan) are built in: the provider's own,
 * except a custom local server, which enforces no schema, so none of the lookup fields is required
 * of it (a missing required field would cost a repair request on every estimate).
 */
export function mealSchemaDialect(config: CoachAIConfig): MealSchemaDialect {
  return config.provider === 'local' ? 'optional' : structuredDialect(config);
}

/**
 * The one place a reply that must match a JSON schema is requested from a provider: the on-device
 * model, Gemini, Claude, or an OpenAI-compatible endpoint. A reply that is not valid JSON comes back as
 * `malformed`; a provider failure is thrown as it happened, for the caller to classify.
 * `generateStructured` (one shot, null on bad output) and `sendStructuredChatTurn` (multi-turn,
 * typed errors) are both thin callers of this.
 */
export async function requestStructured<T = unknown>(
  config: CoachAIConfig,
  request: StructuredRequest
): Promise<StructuredResult<T>> {
  // Built once, in the provider's dialect; a repair call reuses it.
  const schema = request.buildSchema(structuredDialect(config));
  const result = await requestStructuredOnce<T>(config, request, schema);

  return reviveLocalStructured(config, request.operation, result, schema);
}

/**
 * Reports a reply a provider cut off at its token limit: the provider, the operation and the
 * provider's own stop signal, never a word of the reply. Fire and forget, like the other telemetry.
 */
function reportTruncatedReply(
  config: Pick<CoachAIConfig, 'provider'>,
  operation: string,
  stop: StopSignal
): void {
  try {
    void captureMessage('ai-structured-reply-truncated', {
      level: 'warning',
      tags: {
        provider: config.provider,
        operation,
        finishReason: stop.reason ?? 'unknown',
      },
      fingerprint: ['ai-structured-reply-truncated', config.provider, operation],
    }).catch(() => {});
  } catch {
    // Never throws.
  }
}

/**
 * Reads the text of a structured reply. A provider that enforces the schema
 * (`structuredReplies: 'enforced'`) and stopped at its token limit gave a half answer: it is a
 * failure (`malformed`, reason `truncated`), reported once and never sent through the repair ladder,
 * which would close its braces and return a half-empty object as if it were complete. It is not
 * retried: the same limit would cut it again. Every other reply, a complete one with fences or
 * surrounding text included, and every reply of a provider whose schema cannot be trusted (the free
 * tier, a local server, the on-device model), goes through `parseStructuredJson` as before.
 */
function readStructuredReply<T>(
  config: CoachAIConfig,
  operation: string,
  raw: string,
  stop?: StopSignal
): StructuredResult<T> {
  if (stop && isTruncatedStop(stop) && providerPolicyFor(config).structuredReplies === 'enforced') {
    reportTruncatedReply(config, operation, stop);
    console.warn(`[coachAI] ${operation}: ${config.provider} cut the reply off (${stop.reason})`);

    return {
      kind: 'malformed',
      raw: '',
      reason: 'truncated',
      finishReason: stop.reason ?? undefined,
    };
  }

  return parseStructuredJson<T>(raw);
}

/** One structured request, with the schema already built in `structuredDialect(config)`. */
export async function requestStructuredOnce<T = unknown>(
  config: CoachAIConfig,
  request: StructuredRequest,
  schema: object
): Promise<StructuredResult<T>> {
  const { operation, schemaName, systemPrompt, history, userMessage } = request;
  const images = request.images ?? [];
  const task = request.task ?? 'extraction';

  if (config.provider === 'on-device') {
    const engine = config.engine;
    const messages = [
      ...history.map((entry) => ({
        role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: entry.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];
    await logLlmDebugEvent({
      provider: 'on-device',
      direction: 'request',
      operation,
      payload: { systemPrompt, messages, schema },
      config,
    });

    let result: StructuredResult<T>;
    if (engine === 'gguf') {
      // Grammar-constrained by the engine, then parsed and checked here: the engine is not trusted
      // to have honoured the schema.
      const photo = images[0];
      const raw = await withLlmRetry(operation, config, (signal, touch) =>
        sendLocalStructuredRaw(messages, systemPrompt, schema, {
          signal,
          // Every token resets the timeout, so it limits a stall, not model load plus generation.
          onDelta: () => touch(),
          ...(photo ? { image: `data:${photo.mimeType};base64,${photo.base64}` } : {}),
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
        })
      );
      result = parseStructuredJson<T>(raw);
    } else {
      const value = await sendOnDeviceStructured<T>(messages, systemPrompt, schema);
      result =
        value === null || value === undefined
          ? { kind: 'malformed', raw: '' }
          : { kind: 'ok', value };
    }

    await logLlmDebugEvent({
      provider: 'on-device',
      direction: 'response',
      operation,
      payload: result,
      config,
    });

    // Apple's guided generation is enforced by the OS; the downloaded model's answer is checked
    // and repaired by `reviveLocalStructured`, the one place that does it.
    return result;
  }

  const reply = await complete(config, {
    operation,
    system: systemPrompt,
    turns: history,
    userMessage,
    images,
    task,
    schema: { name: schemaName, body: schema },
  });

  return readStructuredReply<T>(config, operation, reply.text, reply.stop);
}

/**
 * One structured request that is not a conversation turn. `userMessage` is sent as given: text the
 * person (or a label) wrote goes through `wrapUserContent` or `prepareChatText` at the caller, which
 * knows which part of the message that is; text written by code (an instruction, a transcript the
 * app built) must reach the model whole and unescaped.
 */
export async function generateStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string,
  schema: object,
  schemaName: string = 'response',
  task: AiTask = 'extraction',
  options?: { followUp?: FollowUp }
): Promise<T | null> {
  const lang = config.language ?? DEFAULT_LANG;

  try {
    const original: StructuredRequest = {
      operation: 'generateStructured',
      task,
      schemaName,
      systemPrompt: `${systemPrompt}\n\nRespond in the following language/locale: ${lang}. All user-facing content in the structured output (e.g. titles, descriptions) must be in this language.`,
      history: [],
      userMessage,
      buildSchema: () => schema,
    };
    const result = await requestStructured<T>(
      config,
      options?.followUp ? followUpOf(original, options.followUp) : original
    );

    return result.kind === 'ok' ? result.value : null;
  } catch (error) {
    // An on-device engine has no retry layer to classify its failures, so a bad run is "no answer".
    if (
      !providerPolicyFor(config).structuredFailureIsNoAnswer ||
      error instanceof OnDeviceUnavailableError ||
      error instanceof AiCancelledError
    ) {
      throw error;
    }

    reportAiError(error, `coachAI.generateStructured[${schemaName}]`);
    return null;
  }
}

type ClaudeImageType = Anthropic.Base64ImageSource['media_type'];

const CLAUDE_IMAGE_TYPES: readonly ClaudeImageType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** Claude takes four image types; anything else is sent as the JPEG the camera pipeline produces. */
function claudeImageType(mimeType: string): ClaudeImageType {
  return CLAUDE_IMAGE_TYPES.find((type) => type === mimeType) ?? 'image/jpeg';
}

/**
 * Loaded inline because the image codec is a native module that text-only requests never need (the
 * pattern of `utils/providerPolicy.ts` and `services/premium/revenueCat.ts`).
 */
function prepareOwnKeyImageLazily(
  base64: string,
  mimeType: string,
  count?: number
): Promise<{ base64: string; mimeType: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiImage: typeof import('@/utils/aiImage') = require('@/utils/aiImage');

  return aiImage.prepareOwnKeyImage(base64, mimeType, count);
}

/**
 * Prepares every photo of one request, once: each at the detail the person chose in AI settings,
 * holding the photos together to what the request may carry (Musclog Iron's body cap is shared by
 * all of them). A meal estimate prepares its photos once and reuses the result for every look,
 * sample and review, instead of re-encoding the same photos in each request.
 */
export async function prepareMealImages(
  config: CoachAIConfig,
  images: readonly MealImage[]
): Promise<MealImage[]> {
  const prepareImage = providerPolicyFor(config).prepareImage ?? prepareOwnKeyImageLazily;
  const count = images.length;
  const prepared: MealImage[] = [];
  // One after another: the codec is a native module and each photo can be several megabytes.
  for (const image of images) {
    prepared.push(await prepareImage(image.base64, image.mimeType, count));
  }

  return prepared;
}

/** One photo through the funnel below (a nutrition label, one photo of a meal). */
async function generateWithImageStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  rawBase64Image: string,
  rawMimeType: string,
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string,
  task: AiTask = 'extraction',
  options?: { followUp?: FollowUp }
): Promise<T | null> {
  return generateWithImagesStructured<T>(
    config,
    systemPrompt,
    [{ base64: rawBase64Image, mimeType: rawMimeType }],
    schema,
    schemaName,
    userMessageSuffix,
    task,
    options
  );
}

/**
 * The single funnel for every provider's photo request, for one photo or several of the same meal.
 * Every provider gets the photos at the detail the person chose in AI settings. Musclog Iron has
 * its own step: it also holds the photos to the Worker's limits, and refuses them while the Worker
 * has photos off. `options.prepared` says the photos were already prepared by `prepareMealImages`.
 */
export async function generateWithImagesStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  rawImages: readonly MealImage[],
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string,
  task: AiTask = 'extraction',
  options?: { prepared?: boolean; followUp?: FollowUp }
): Promise<T | null> {
  const images = options?.prepared ? [...rawImages] : await prepareMealImages(config, rawImages);

  // Wrap user message suffix with delimiters to prevent prompt injection
  const sanitizedSuffix = userMessageSuffix?.trim()
    ? wrapUserContent(userMessageSuffix.trim())
    : '';
  const userMessage =
    (images.length > 1
      ? 'Analyze these images and return the structured data.'
      : 'Analyze this image and return the structured data.') +
    (sanitizedSuffix ? `\n\n${sanitizedSuffix}` : '');

  const original: StructuredRequest = {
    operation: 'generateWithImageStructured',
    task,
    schemaName,
    systemPrompt,
    history: [],
    userMessage,
    images,
    buildSchema: () => schema,
  };
  const result = await requestStructured<T>(
    config,
    options?.followUp ? followUpOf(original, options.followUp) : original
  );

  return result.kind === 'ok' ? result.value : null;
}

/**
 * The foundation foods this request offers the model, with the map that reads its answer back, or
 * null when this provider leaves them out (the on-device model has no room) or the person turned
 * "Send foundation foods to AI" off. Built once per request: the prompt and the reading of the answer
 * use the same object, so a food's reference number always means the line the model saw.
 */
export async function foundationFoodsFor(
  config: CoachAIConfig,
  style: 'estimate' | 'recipe'
): Promise<FoundationFoodsPrompt | null> {
  const providerConfig = PROVIDER_CONFIGS[config.provider] ?? PROVIDER_CONFIGS.openai;
  if (!providerConfig.enableFoundationFoods) {
    return null;
  }

  return (await SettingsService.getSendFoundationFoodsToLlm())
    ? getFoundationFoodsPrompt(style)
    : null;
}

export async function sendCoachMessage(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  // The person's own message goes through as typed (see `prepareChatText`); it used to be escaped
  // as if it were text spliced into a template, so the model read "I\'m" and "\n".
  const text = prepareChatText(userMessage);

  // On-device keeps its tight budget and its own date line, so nothing is added there.
  let sendHistory = history;
  let sendText = text;

  if (!isOnDeviceConfig(config)) {
    // Every user turn carries the time it was sent, the newest also how long the pause was.
    const tagged = tagTurnsWithTime(history, text, Date.now());
    sendHistory = tagged.history;
    sendText = tagged.userMessage;
  }

  // Whether any text reached the person: a reply that fails after that is taken back by the caller,
  // never replaced by an apology.
  let shown = false;
  const target: CoachStream | undefined = stream && {
    ...stream,
    onText: (textSoFar) => {
      if (textSoFar) {
        shown = true;
      }

      stream.onText(textSoFar);
    },
  };

  try {
    // Built once, from the full history (the excludes), and reused by the draft and the review.
    const systemPrompt = isOnDeviceConfig(config)
      ? await getChatMessagePromptContent(config.language, undefined, context, 'on-device')
      : await chatSystemPrompt(config, sendHistory, context);

    // Per dispatched message: the review instruction is longer than the person's message, and a
    // review round also carries the exchange under review (`exchange`), which always stays whole.
    const turnsFor = (message: string, exchange: ChatHistoryEntry[]): ChatHistoryEntry[] => {
      const reserved =
        message.length + exchange.reduce((sum, turn) => sum + turn.content.length, 0);

      return [
        ...truncateHistoryByBudget(
          latestChatTurns(sendHistory, config),
          isOnDeviceConfig(config)
            ? onDeviceBudget(config) - reserved
            : (PROVIDER_CONFIGS[config.provider] ?? PROVIDER_CONFIGS.openai).maxCharBudget
        ),
        ...exchange,
      ];
    };

    const dispatch = (
      message: string,
      to?: CoachStream,
      exchange: ChatHistoryEntry[] = []
    ): Promise<CoachResponse> => {
      const turns = turnsFor(message, exchange);

      if (isOnDeviceConfig(config)) {
        return sendViaOnDevice(config, systemPrompt, turns, message, to);
      }

      // Gemini, Claude and every OpenAI-compatible provider (OpenAI, a custom local server, the free
      // tier through OpenRouter, and Musclog Iron).
      return sendViaCloud(config, systemPrompt, turns, message, to);
    };

    const level = await thinkingLevelFor(config);

    if (!THINKING_PIPELINE[level].chatReview) {
      return await dispatch(sendText, target);
    }

    return await draftAndReviewCoachReply(config, sendText, dispatch, target);
  } catch (error) {
    return failedCoachReply(error, config, shown);
  }
}

/**
 * What a chat request that threw turns into: a cancel, a typed user-actionable error and a reply
 * that was already on screen (taken back by the caller; an apology saved as the coach's answer would
 * sit next to half of the real one) are rethrown; a spent quota is an `AiCreditsError`; anything else
 * becomes a generic apology without the internals.
 */
async function failedCoachReply(
  error: unknown,
  config: CoachAIConfig,
  shown: boolean
): Promise<CoachResponse> {
  if (error instanceof AiCancelledError || shown) {
    throw error;
  }

  rethrowUserFacingAiError(error);

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: 'sendCoachMessage',
    payload: { error },
    config,
  });
  console.error('[coachAI] sendCoachMessage error:', error);

  // Log detailed error for debugging but don't expose internals to user
  reportAiError(error, 'coachAI.sendCoachMessage');

  if (isAiCreditsError(error)) {
    throw config.provider === 'gateway'
      ? new GatewayRateLimitError(i18n.t('errors.gatewayDailyLimitError'))
      : new AiCreditsError(i18n.t('errors.aiCreditsError'));
  }

  return {
    msg4User: i18n.t('errors.aiProcessingError'),
    sumMsg: i18n.t('errors.aiProcessingErrorTitle'),
  };
}

/**
 * The highest thinking level answers twice: the first reply is drafted unseen, then a review
 * request, with the same system prompt and history, checks it against the history and the app data
 * and writes the final reply, which is the one streamed. A failing draft throws (the caller gives
 * the apology a single request would); a failing review (not a cancel) keeps the draft.
 */
async function draftAndReviewCoachReply(
  config: CoachAIConfig,
  message: string,
  dispatch: (
    message: string,
    target?: CoachStream,
    exchange?: ChatHistoryEntry[]
  ) => Promise<CoachResponse>,
  stream?: CoachStream
): Promise<CoachResponse> {
  stream?.onPhase?.('reviewing');
  const draft = await dispatch(message);

  if (!draft.msg4User.trim()) {
    return draft;
  }

  try {
    // The draft is the model's own previous reply (and the person's message the turn before it), so
    // the instruction quotes nothing: a small model has no markers to copy back into its answer.
    const reviewed = await dispatch(
      getChatReviewInstruction(config.language ?? DEFAULT_LANG),
      stream,
      [
        { role: 'user', content: message },
        { role: 'coach', content: draft.msg4User },
      ]
    );

    if (!reviewed.msg4User.trim()) {
      stream?.onText(draft.msg4User);

      return draft;
    }

    return {
      ...reviewed,
      rememberMe: reviewed.rememberMe?.trim() ? reviewed.rememberMe : draft.rememberMe,
    };
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, 'coachAI.reviewCoachReply');
    stream?.onText(draft.msg4User);

    return draft;
  }
}

/**
 * AI FUNCTION DISPATCHERS
 * These delegate to provider-specific implementations
 */

/**
 * An insight at the person's thinking level. Off and Medium make the single request they always
 * made. From High up the answer is drafted unseen, then fact-checked for `reviewRounds` rounds with
 * the same system prompt (so the data and the voice stay): the corrector is told which figures the
 * data does not hold (`ungroundedFigures`), and a correction is kept only when it has no more of them.
 * The final text then reaches the stream once, so what was shown is what is saved.
 */
async function generateInsight(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string,
  recentConversation?: ChatHistoryEntry[],
  stream?: CoachStream
): Promise<string> {
  // The one request every pass sends: the draft as it is, a fact-check round with the draft as the
  // model's own turn and a trusted instruction after it (`followUpOf`). The person's words are
  // sanitized once, here; nothing added later goes through `wrapUserContent`.
  const hasHistory = Boolean(recentConversation?.length);
  const original = {
    systemPrompt: hasHistory ? systemPrompt : withLanguageNote(systemPrompt, config),
    history: recentConversation ?? [],
    userMessage: wrapUserContent(userMessage),
  };
  const send = async (
    request: typeof original,
    operation: string,
    target?: CoachStream
  ): Promise<string> =>
    // Leaked chat-template tokens are removed from every pass, as `generateTextWithHistory` does.
    stripTemplateTokens(
      await requestPlainText(
        config,
        operation,
        request.systemPrompt,
        request.history,
        request.userMessage,
        target,
        'insight'
      )
    );
  const draftOperation = hasHistory ? 'generateTextWithHistory' : 'generateText';
  const pipeline = THINKING_PIPELINE[await thinkingLevelFor(config)];
  const rounds = pipeline.reviewRounds;
  if (rounds === 0) {
    return send(original, draftOperation, stream);
  }

  stream?.onPhase?.('reviewing');
  const draft = await send(original, draftOperation);
  if (!draft.trim()) {
    return draft;
  }

  const data = [
    systemPrompt,
    ...(recentConversation ?? []).map((entry) => entry.content),
    userMessage,
  ].join('\n');
  const final = await reviewAndRevise({
    draft,
    rounds,
    critique: (current, round) =>
      send(
        followUpOf(original, {
          answer: current,
          instruction: getInsightFactCheckInstruction(ungroundedFigures(current, data), round > 0),
        }),
        'generateInsightFactCheck'
      ),
    accept: (current, revised) =>
      revised.trim() !== '' &&
      ungroundedFigures(revised, data).length <= ungroundedFigures(current, data).length,
    onError: (error) => reportAiError(error, 'coachAI.factCheckInsight'),
    isUnchanged: pipeline.earlyExit ? sameValue : undefined,
  });
  stream?.onText(final);

  return final;
}

/**
 * A plan at the person's thinking level. Off and Medium make the single request they always made.
 * From High up the answer gets `reviewRounds` critique rounds: the same request again, with the
 * current answer and the problems code found in it (`planFindings`), and the revision is kept only
 * when it parses and has no more problems than the answer it revises.
 */
async function generatePlan<T>(
  config: CoachAIConfig,
  request: (followUp?: FollowUp) => Promise<T | null | undefined>,
  findingsOf: (answer: T) => string[]
): Promise<T | null> {
  const draft = await request();
  if (draft == null) {
    return null;
  }

  const pipeline = THINKING_PIPELINE[await thinkingLevelFor(config)];
  const rounds = pipeline.reviewRounds;
  if (rounds === 0) {
    return draft;
  }

  return reviewAndRevise<T>({
    draft,
    rounds,
    critique: (current) =>
      request({
        answer: JSON.stringify(current),
        instruction: getPlanReviewInstruction(findingsOf(current)),
      }),
    accept: (current, revised) => findingsOf(revised).length <= findingsOf(current).length,
    onError: (error) => reportAiError(error, 'coachAI.reviewPlan'),
    isUnchanged: pipeline.earlyExit ? sameValue : undefined,
  });
}

/**
 * The shell every user-facing AI function shares. A failure the person can act on (a rejected key, a
 * timeout, a spent allowance) is shown to them, and any failure reaches Sentry through
 * `reportAiError`, which leaves out what the person fixes themselves. The function then answers
 * null, as every caller expects. `name` is the exported function's name, so an event names its
 * feature.
 */
async function userFacing<T>(name: string, run: () => Promise<T | null>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    notifyUserFacingAiError(error);
    reportAiError(error, `coachAI.${name}`);

    return null;
  }
}

/** What an insight request says when the person added remarks, or the default ask when not. */
function remarksMessage(userRemarks?: string): string {
  return userRemarks?.trim()
    ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
    : INSIGHTS_USER_MESSAGE;
}

/**
 * A conversation as one block of text, for a request that is not a chat turn (a plan built from what
 * was said): the person's words as typed, the coach's as written. Nothing is cut or escaped as a
 * whole: only the sanitizer's per-message limit applies to what the person wrote.
 */
function conversationTranscript(history: readonly ChatHistoryEntry[]): string {
  return history
    .map((entry) =>
      entry.role === 'user' ? `User: ${prepareChatText(entry.content)}` : `Coach: ${entry.content}`
    )
    .join('\n\n');
}

/**
 * Get nutrition insights for a date range.
 * Optional userRemarks are passed to the model so it can factor them into the analysis.
 * Optional recentConversation (e.g. last 3 messages) gives the model context so it doesn't reply as if starting fresh.
 */
export async function getNutritionInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string,
  userRemarks?: string,
  recentConversation?: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'nutrition',
  stream?: CoachStream
): Promise<string | null> {
  return userFacing('getNutritionInsights', async () => {
    const systemPrompt = await getNutritionInsightsPrompt(
      startDate,
      endDate,
      config.language ?? DEFAULT_LANG,
      { context, provider: config.provider }
    );

    return (
      (await generateInsight(
        config,
        systemPrompt,
        remarksMessage(userRemarks),
        recentConversation,
        stream
      )) || null
    );
  });
}

/**
 * Generate a meal plan from conversation history
 */
export async function generateMealPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  macroTargets?: { calories: number; protein: number; carbs: number; fat: number; fiber: number },
  context: 'nutrition' | 'exercise' | 'general' = 'nutrition'
): Promise<GenerateMealPlanResponse | null> {
  return userFacing('generateMealPlan', async () => {
    const lang = config.language ?? DEFAULT_LANG;
    // One list for the whole plan: a revision round reads its answer against the list the first one saw.
    const foundation = await foundationFoodsFor(config, 'estimate');
    const systemPrompt = await getGenerateMealPlanPrompt(
      lang,
      macroTargets,
      undefined,
      context,
      foundation
    );
    const userMessage = `${conversationTranscript(history)}\n\nGenerate the meal plan.`;
    const schema = schemaOfFunction(
      getGenerateMealPlanFunctions(foundation !== null, mealSchemaDialect(config))
    );
    const plan = await generatePlan<GenerateMealPlanResponse>(
      config,
      (followUp) =>
        generateStructured<GenerateMealPlanResponse>(
          config,
          systemPrompt,
          userMessage,
          schema,
          'generateMealPlan',
          'planning',
          { followUp }
        ),
      (plan) => mealPlanFindings(plan, macroTargets)
    );

    // The references stay as the model wrote them while a critique round re-reads the plan, so a
    // revision speaks the same language as the list in the system prompt; the real ids come last.
    return plan ? resolveFoundationRefsInMeals(plan, foundation) : null;
  });
}

/**
 * Generate a workout plan from conversation history
 */
export async function generateWorkoutPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'exercise'
): Promise<GenerateWorkoutPlanResponse | null> {
  return userFacing('generateWorkoutPlan', async () => {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await createWorkoutPlanPrompt(lang, undefined, context);
    const userMessage =
      history.length > 0
        ? `${conversationTranscript(history)}\n\n${i18n.t(
            'coach.aiInstructions.generateWorkoutPlanWithHistory',
            { lng: lang }
          )}`
        : i18n.t('coach.aiInstructions.generateWorkoutPlanDefault', { lng: lang });
    const schema = schemaOfFunction(getGenerateWorkoutPlanFunctions());

    return generatePlan<GenerateWorkoutPlanResponse>(
      config,
      (followUp) =>
        generateStructured<GenerateWorkoutPlanResponse>(
          config,
          systemPrompt,
          userMessage,
          schema,
          'generateWorkoutPlan',
          'planning',
          { followUp }
        ),
      workoutPlanFindings
    );
  });
}

/**
 * Calculate next workout volume based on performance
 */
export async function calculateNextWorkoutVolume(
  config: CoachAIConfig,
  workoutTitle: string,
  completedWorkoutData: any
): Promise<CalculateVolumeResponse | null> {
  return userFacing('calculateNextWorkoutVolume', async () => {
    const systemPrompt = await getCalculateNextWorkoutVolumePrompt(
      workoutTitle,
      config.language ?? DEFAULT_LANG
    );
    const userMessage =
      typeof completedWorkoutData === 'string'
        ? completedWorkoutData
        : JSON.stringify(completedWorkoutData ?? {}, null, 2);
    const schema = schemaOfFunction(getCalculateNextWorkoutVolumeFunctions());

    return generatePlan<CalculateVolumeResponse>(
      config,
      (followUp) =>
        generateStructured<CalculateVolumeResponse>(
          config,
          systemPrompt,
          userMessage,
          schema,
          'calculateNextWorkoutVolume',
          'planning',
          { followUp }
        ),
      workoutVolumeFindings
    );
  });
}

/**
 * Get insights about an upcoming workout
 */
export async function getWorkoutInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  return userFacing('getWorkoutInsights', async () => {
    const systemPrompt = await getWorkoutInsightsPrompt(
      workoutTitle,
      config.language ?? DEFAULT_LANG,
      { provider: config.provider }
    );

    return (await generateInsight(config, systemPrompt, INSIGHTS_USER_MESSAGE)) || null;
  });
}

/**
 * Get feedback on a recently completed workout (by workout log id).
 */
export async function getRecentWorkoutInsights(
  config: CoachAIConfig,
  workoutLogId: string,
  stream?: CoachStream
): Promise<string | null> {
  return userFacing('getRecentWorkoutInsights', async () => {
    const systemPrompt = await getRecentWorkoutInsightsPromptByLogId(
      workoutLogId,
      config.language ?? DEFAULT_LANG,
      { provider: config.provider }
    );

    return (
      (await generateInsight(config, systemPrompt, INSIGHTS_USER_MESSAGE, undefined, stream)) ||
      null
    );
  });
}

/**
 * Get insights about recent workouts in a date range.
 * Optional userRemarks are passed to the model so it can factor them into the analysis.
 * Optional recentConversation (e.g. last 3 messages) gives the model context so it doesn't reply as if starting fresh.
 */
export async function getRecentWorkoutsInsights(
  config: CoachAIConfig,
  startDate: string,
  endDate: string,
  userRemarks?: string,
  recentConversation?: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'exercise',
  stream?: CoachStream
): Promise<string | null> {
  return userFacing('getRecentWorkoutsInsights', async () => {
    const systemPrompt = await getRecentWorkoutsInsightsPrompt(
      startDate,
      endDate,
      config.language ?? DEFAULT_LANG,
      { context, provider: config.provider }
    );

    return (
      (await generateInsight(
        config,
        systemPrompt,
        remarksMessage(userRemarks),
        recentConversation,
        stream
      )) || null
    );
  });
}

/**
 * Get volume trend analysis for a specific workout
 */
export async function getWorkoutVolumeInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  return userFacing('getWorkoutVolumeInsights', async () => {
    const systemPrompt = await getWorkoutVolumeInsightsPrompt(
      workoutTitle,
      config.language ?? DEFAULT_LANG,
      { provider: config.provider }
    );

    return (await generateInsight(config, systemPrompt, INSIGHTS_USER_MESSAGE)) || null;
  });
}

/**
 * One extraction (a label, past workouts, a food log) at the person's thinking level. Off and
 * Medium make the single request they always made; High reads the input twice, together, and
 * Tokenmaxxing reads it twice and takes a third reading only when the first two disagree on some
 * field (`extractionSamples`, `EXTRACTION_FIRST_READINGS`). A reading that fails or says nothing is
 * no evidence, so a level that exits early spends what is left of its budget on another one instead
 * of ending on a single reading. Code combines the readings field by field (`combineExtractions`).
 * Only when they still disagree is one more request made: the same request with the readings and
 * the disputed fields appended, whose answer is used when it parses. A failed arbiter keeps the
 * combined readings; a cancel stops everything.
 */
async function extractWithConsensus<T>(
  config: CoachAIConfig,
  request: (followUp?: FollowUp) => Promise<T | null | undefined>
): Promise<T | null> {
  const level = await thinkingLevelFor(config);
  const samples = extractionSamples(level);
  // A level that exits early reads `EXTRACTION_FIRST_READINGS` first and takes the rest only when
  // those disagree; the others read everything at once.
  const firstReadings = THINKING_PIPELINE[level].earlyExit
    ? Math.min(EXTRACTION_FIRST_READINGS, samples)
    : samples;
  let requested = firstReadings;
  let readings = await runSamples(config, firstReadings, () => request(), {
    onDroppedFailure: (error) => reportAiError(error, 'coachAI.extractionReading'),
  });

  // Further readings only ever add evidence: when they all fail, what there is stands (a cancel
  // stops everything).
  const takeMoreReadings = async (): Promise<void> => {
    const count = samples - requested;
    requested = samples;
    try {
      readings = [
        ...readings,
        ...(await runSamples(config, count, () => request(), {
          onDroppedFailure: (error) => reportAiError(error, 'coachAI.extractionReading'),
        })),
      ];
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      reportAiError(error, 'coachAI.extractionExtraReading');
    }
  };

  if (readings.length < 2 && requested < samples) {
    await takeMoreReadings();
  }

  if (readings.length <= 1) {
    return readings[0] ?? null;
  }

  let { value, disputed } = combineExtractions(readings);
  if (disputed.length === 0) {
    return value as T;
  }

  if (requested < samples) {
    // The first readings disagree: one more reading settles a two-to-one split.
    await takeMoreReadings();
    ({ value, disputed } = combineExtractions(readings));
    if (disputed.length === 0) {
      return value as T;
    }
  }

  try {
    const arbiter = await request({
      instruction: getExtractionArbiterMessage(readings, disputed),
    });

    // The arbiter settles only the fields the readings disputed (aligned to them the way the
    // readings were aligned to each other); what they agreed on stays.
    return arbiter == null ? (value as T) : (combineExtractions(readings, { arbiter }).value as T);
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, 'coachAI.arbitrateExtraction');
    return value as T;
  }
}

/**
 * Extract macros from a nutrition label photo
 */
export async function extractMacrosFromLabelPhoto(
  config: CoachAIConfig,
  base64Image: string,
  context?: MealPhotoContext | null
): Promise<MacroEstimate | null> {
  return userFacing('extractMacrosFromLabelPhoto', async () => {
    const systemPrompt = await withCustomPrompts(getExtractMacrosFromLabelPrompt());
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const schema = schemaOfFunction(getEstimateMacrosFunctions(true));
    const userMessageSuffix = formatMealPhotoContext(context);

    return extractWithConsensus<MacroEstimate>(config, (followUp) =>
      generateWithImageStructured<MacroEstimate>(
        config,
        systemPrompt,
        base64,
        mimeType,
        schema,
        'estimateMacros',
        userMessageSuffix,
        'extraction',
        { followUp }
      )
    );
  });
}

/**
 * Extract macros from OCR text of a nutrition label (no image sent to AI).
 * Use when the app has already run OCR and only the text is available.
 */
export async function extractMacrosFromLabelText(
  config: CoachAIConfig,
  ocrText: string,
  context?: MealPhotoContext | null
): Promise<MacroEstimate | null> {
  return userFacing('extractMacrosFromLabelText', async () => {
    const contextText = formatMealPhotoContext(context);
    if (!ocrText.trim() && !contextText) {
      return null;
    }

    const systemPrompt = await withCustomPrompts(getExtractMacrosFromLabelTextPrompt());
    const schema = schemaOfFunction(getEstimateMacrosFunctions(true));
    // What was read off a label and what the person wrote are both untrusted text.
    const userMessage = wrapUserContent(
      (ocrText.trim() || 'No text extracted from the label.') +
        (contextText ? `\n\n${contextText}` : '')
    );

    return extractWithConsensus<MacroEstimate>(config, (followUp) =>
      generateStructured<MacroEstimate>(
        config,
        systemPrompt,
        userMessage,
        schema,
        'estimateMacros',
        'extraction',
        { followUp }
      )
    );
  });
}

/**
 * Parse past workouts from natural language
 */
export async function parsePastWorkouts(
  config: CoachAIConfig,
  userMessage: string,
  exerciseNames: string[]
): Promise<ParsedWorkout[] | null> {
  return userFacing('parsePastWorkouts', async () => {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getParsePastWorkoutsPrompt(userMessage, exerciseNames, lang);
    const schema = schemaOfFunction(getParsePastWorkoutsFunctions());
    const parsed = await extractWithConsensus<{ pastWorkouts: ParsedWorkout[] }>(
      config,
      (followUp) =>
        generateStructured<{ pastWorkouts: ParsedWorkout[] }>(
          config,
          systemPrompt,
          i18n.t('coach.aiInstructions.parseWorkouts', { lng: lang }),
          schema,
          'parsePastWorkouts',
          'extraction',
          { followUp }
        )
    );

    return parsed?.pastWorkouts ?? null;
  });
}

/**
 * Parse past nutrition from natural language
 */
export async function parsePastNutrition(
  config: CoachAIConfig,
  userMessage: string
): Promise<ParsedNutrition[] | null> {
  return userFacing('parsePastNutrition', async () => {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getParsePastNutritionPrompt(userMessage, lang);
    const schema = schemaOfFunction(getParsePastNutritionFunctions());
    const parsed = await extractWithConsensus<{ pastNutrition: ParsedNutrition[] }>(
      config,
      (followUp) =>
        generateStructured<{ pastNutrition: ParsedNutrition[] }>(
          config,
          systemPrompt,
          i18n.t('coach.aiInstructions.parseNutrition', { lng: lang }),
          schema,
          'parsePastNutrition',
          'extraction',
          { followUp }
        )
    );

    return parsed?.pastNutrition ?? null;
  });
}

/**
 * Parse nutrition from a natural language description of a past day
 */
export async function parseRetrospectiveNutrition(
  config: CoachAIConfig,
  userMessage: string,
  targetDate: string
): Promise<NutritionEntry[] | null> {
  return userFacing('parseRetrospectiveNutrition', async () => {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getRetrospectiveNutritionPrompt(targetDate, userMessage, lang);
    const schema = schemaOfFunction(getParseRetrospectiveNutritionFunctions());
    const parsed = await extractWithConsensus<{ nutritionEntries: NutritionEntry[] }>(
      config,
      (followUp) =>
        generateStructured<{ nutritionEntries: NutritionEntry[] }>(
          config,
          systemPrompt,
          i18n.t('coach.aiInstructions.parseRetrospectiveNutrition', { lng: lang }),
          schema,
          'parseRetrospectiveNutrition',
          'extraction',
          { followUp }
        )
    );

    return parsed?.nutritionEntries ?? null;
  });
}

/**
 * Get AI critique/insights for a single meal.
 */
export async function getMealCritique(
  config: CoachAIConfig,
  mealType: string,
  foods: { name: string; gramWeight: number }[],
  totals: { calories: number; protein: number; carbs: number; fat: number },
  userRemarks?: string,
  stream?: CoachStream
): Promise<string | null> {
  return userFacing('getMealCritique', async () => {
    const systemPrompt = await getMealCritiquePrompt(
      mealType,
      foods,
      totals,
      config.language ?? DEFAULT_LANG,
      { context: 'nutrition', provider: config.provider }
    );
    const finalUserMessage = userRemarks?.trim()
      ? userRemarks.trim()
      : 'Please critique this meal.';

    return (
      (await generateInsight(config, systemPrompt, finalUserMessage, undefined, stream)) || null
    );
  });
}
