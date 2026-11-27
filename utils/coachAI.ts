import Anthropic from '@anthropic-ai/sdk';
import { Content, Part } from '@google/genai';
import OpenAI from 'openai';

import { MUSCLOG_GATEWAY_MAX_TOKENS, MUSCLOG_GATEWAY_PROVIDER } from '@/constants/gateway';
import { SETTINGS } from '@/constants/settingDefinitions';
import { DebugDumpService } from '@/database/services/DebugDumpService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n, { DEFAULT_LANG } from '@/lang/lang';
import type {
  LocalChatMessage,
  LocalToolCall,
  LocalToolDefinition,
} from '@/services/localModels/llamaRuntime';
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
import {
  getChatReviewInstruction,
  getExtractionArbiterMessage,
  getInsightFactCheckInstruction,
  getPlanReviewInstruction,
} from './aiReviewPrompts';
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
import { createCopyGate, isCopiedReply } from './copiedReply';
import { combineExtractions } from './extractionConsensus';
import { resolveFoundationRefsInMeals } from './foundationFoodList';
import { withGatewayProviderPin } from './gatewayRouting';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from './gemini';
import { handleError } from './handleError';
import { readJsonStringField } from './jsonStringFieldStream';
import { withLlmRetry } from './llmRetry';
import type { LlmRequest } from './llmRetryTypes';
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
import type { OnDeviceEngine } from './onDeviceEngine';
import {
  sendLocalMessage,
  sendLocalStructuredRaw,
  sendLocalToolCall,
  streamLocalMessage,
} from './onDeviceLocal';
import { mentionsPainOrInjury } from './painMention';
import { mealPlanFindings, workoutPlanFindings, workoutVolumeFindings } from './planFindings';
import {
  createWorkoutPlanPrompt,
  type FoundationFoodsPrompt,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getChatMessagePromptContent,
  getEstimateMacrosFunctions,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getFoundationFoodsPrompt,
  getGenerateMealPlanFunctions,
  getGenerateMealPlanPrompt,
  getGenerateWorkoutPlanFunctions,
  getMealCritiquePrompt,
  getNutritionInsightsPrompt,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getRecentWorkoutInsightsPromptByLogId,
  getRecentWorkoutsInsightsPrompt,
  getRetrospectiveNutritionPrompt,
  getWorkoutInsightsPrompt,
  getWorkoutVolumeInsightsPrompt,
  withCustomPrompts,
} from './prompts';
import { prepareChatText, wrapUserContent } from './promptSanitizer';
import { contextCharsFor, providerPolicyFor } from './providerPolicy';
import { isTruncatedStop, type StopSignal } from './replyTruncation';
import { captureMessage } from './sentry';
import type { MealSchemaDialect, StructuredDialect } from './structuredDialect';

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
  /** Every request of this config keeps what it carries out of the debug dump (spoken words). */
  redactDump?: boolean;
};

/** What only an `on-device` config carries: which engine answers and whether it can read photos. */
type OnDeviceFields = {
  engine: OnDeviceEngine;
  /** The engine can read a food photo (the downloaded model with its projector). */
  vision: boolean;
  /** The downloaded model's optional text model is installed (undefined: it is not). */
  textModel?: boolean;
};

/** Every other provider has neither field, so `config.engine` reads the same on all of them. */
type NoOnDeviceFields = { engine?: undefined; vision?: undefined; textModel?: undefined };

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
  /** The dump records that the call happened and nothing it carried (a voice transcript). */
  redact?: boolean;
}): Promise<void> {
  try {
    await DebugDumpService.logJsonEvent({
      provider: params.provider,
      direction: params.direction,
      operation: params.operation,
      payload: params.redact || params.config?.redactDump ? { redacted: true } : params.payload,
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

// --- One completion, whatever the provider ---

/**
 * What every request needs, on-device ones included. The chat reply, a plain-text insight and a
 * structured job are the same request with a different `schema` and `sink`, so they share this one
 * funnel (`runPrepared`): it is the only place the debug dump is written and the usage recorded.
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
  /** Sampling temperature, for the downloaded model only (a warmer retry of an unusable reply). */
  temperature?: number;
  /** Keeps what the request and reply say out of the debug dump. */
  redactDump?: boolean;
};

type Completion = {
  text: string;
  stop?: StopSignal;
  /** A structured reply the engine already parsed (Apple's guided generation). */
  value?: unknown;
};

/** What one attempt answers: the completion and what it cost. */
type Sent<C extends Completion> = C & { usage: LlmUsage | null };

/**
 * A request ready to send: what the debug dump shows, and one attempt of each shape. The retry loop,
 * the stream's bookkeeping, the dump and the usage are `runPrepared`'s, never a provider's.
 */
type PreparedCall<C extends Completion = Completion> = {
  payload: unknown;
  /** One attempt that answers at once. */
  once: LlmRequest<Sent<C>>;
  /** One attempt that feeds the sink as the reply is written. */
  stream: (sink: StreamSink) => LlmRequest<Sent<C>>;
  /** Apple's system model keeps its own path: no retry, timeout or abort race. */
  unmanaged?: boolean;
};

type RoleMessage = { role: 'user' | 'assistant'; content: string };

/** A turn as the providers that speak in `user` / `assistant` roles take it. */
function toRoleMessage(entry: ChatHistoryEntry): RoleMessage {
  return { role: entry.role === 'coach' ? 'assistant' : 'user', content: entry.content };
}

async function prepareGeminiCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
  const { system, schema } = request;
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
    once: async (signal) => {
      const result = await genModel.generateContent({ contents, abortSignal: signal });
      const { text, finishReason } = extractGeminiReply(result);

      return {
        text,
        stop: { source: 'gemini', reason: finishReason },
        usage: extractLlmUsage(result),
      };
    },
    stream: (sink) => async (signal, touch) => {
      let usage: LlmUsage | null = null;
      const chunks = await genModel.generateContentStream({ contents, abortSignal: signal });
      for await (const chunk of chunks) {
        touch();
        usage = mergeLlmUsage(usage, extractLlmUsage(chunk));
        const { text: delta } = extractGeminiText(chunk);
        if (delta) {
          sink.onDelta(delta);
        }
      }

      return { text: sink.raw(), usage };
    },
  };
}

async function prepareOpenAiCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
  const { schema } = request;
  const client = buildOpenAIClient(config);
  const images = request.images ?? [];
  const payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: request.system },
      ...normalizeHistory(request.turns).map(toRoleMessage),
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
    once: async (_signal, _touch, options) => {
      const completion = await client.chat.completions.create(payload, options);
      const choice = completion.choices[0];

      return {
        text: choice?.message?.content ?? '',
        stop: { source: 'openai', reason: choice?.finish_reason },
        usage: extractLlmUsage(completion),
      };
    },
    stream: (sink) => async (_signal, touch, options) => {
      let usage: LlmUsage | null = null;
      const chunks = await client.chat.completions.create({ ...payload, stream: true }, options);
      for await (const chunk of chunks) {
        touch();
        // Only present when the provider sends it (OpenRouter does, on the last chunk).
        usage = mergeLlmUsage(usage, extractLlmUsage(chunk));
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          sink.onDelta(delta);
        }
      }

      return { text: sink.raw(), usage };
    },
  };
}

async function prepareClaudeCall(
  config: CoachAIConfig,
  request: CompletionRequest
): Promise<PreparedCall> {
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
    once: async (signal) => {
      const message = await client.messages.create(params, { signal });
      const { text, stopReason } = extractClaudeText(message);

      return {
        text,
        stop: { source: 'claude', reason: stopReason },
        usage: extractLlmUsage(message),
      };
    },
    // A stream has no HTTP timeout to stay under, so it may ask for more tokens.
    stream: (sink) => async (signal, touch) => {
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

      return { text: sink.raw(), usage: await finalClaudeUsage(events) };
    },
  };
}

/**
 * The downloaded model or Apple's system model, picked by the engine. Both take the conversation in
 * roles; only the downloaded model reads a photo (the first: a meal of several is read one request
 * at a time) and a temperature, and its schema becomes a grammar whose text the caller still checks.
 * Apple's guided generation answers with the value itself.
 */
function prepareOnDeviceCall(config: OnDeviceConfig, request: CompletionRequest): PreparedCall {
  const { system, schema, temperature } = request;
  const messages: RoleMessage[] = [
    ...request.turns.map(toRoleMessage),
    { role: 'user', content: request.userMessage },
  ];
  const payload = {
    systemPrompt: system,
    messages,
    ...(schema ? { schema: schema.body } : {}),
  };

  if (config.engine === 'gguf') {
    const photo = request.images?.[0];

    return {
      payload,
      once: async (signal, touch) => {
        let usage: LlmUsage | null = null;
        const onUsage = (next: LlmUsage) => {
          usage = next;
        };

        // Grammar-constrained by the engine, then parsed and checked by the caller: the engine is
        // not trusted to have honoured the schema.
        const text = schema
          ? await sendLocalStructuredRaw(messages, system, schema.body, {
              signal,
              // Every token resets the timeout, so it limits a stall, not model load plus generation.
              onDelta: () => touch(),
              onUsage,
              ...(photo ? { image: `data:${photo.mimeType};base64,${photo.base64}` } : {}),
              ...(temperature === undefined ? {} : { temperature }),
            })
          : await sendLocalMessage(messages, system, signal, onUsage);

        return { text, usage };
      },
      stream: (sink) => async (signal, touch) => {
        let usage: LlmUsage | null = null;
        const streamed = await streamLocalMessage(
          messages,
          system,
          (delta) => {
            touch();
            sink.onDelta(delta);
          },
          signal,
          (next) => {
            usage = next;
          }
        );

        // The runtime's text is llama.cpp's parsed message, already cleaned; the raw stream is the
        // fallback when it parsed to nothing.
        return { text: streamed || sink.raw(), usage };
      },
    };
  }

  return {
    payload,
    unmanaged: true,
    once: async () => {
      if (schema) {
        const value = await sendOnDeviceStructured<unknown>(messages, system, schema.body);

        return { text: '', value: value ?? undefined, usage: null };
      }

      const text = await sendOnDeviceMessage(messages, system);

      return { text: text ?? '', usage: null };
    },
    stream: (sink) => async () => {
      const text = await streamOnDeviceMessage(messages, system, sink.onDelta, config.signal);

      return { text: text ?? '', usage: null };
    },
  };
}

/**
 * Sends a prepared request: retried and timed out by `withLlmRetry` (a stream is retried only until
 * its first text shows), written to the debug dump on both sides, and its cost recorded.
 */
async function runPrepared<C extends Completion>(
  config: CoachAIConfig,
  call: PreparedCall<C>,
  { operation, sink, redactDump }: Pick<CompletionRequest, 'operation' | 'sink' | 'redactDump'>
) {
  const dump = (direction: 'request' | 'response', payload: unknown) =>
    logLlmDebugEvent({
      provider: config.provider,
      direction,
      operation,
      payload,
      config,
      redact: redactDump,
    });
  await dump('request', call.payload);

  const attempt: LlmRequest<Sent<C>> = sink
    ? (signal, touch, options) => {
        sink.reset();

        return call.stream(sink)(signal, touch, options);
      }
    : call.once;
  // An unmanaged call reads the person's cancel itself and has no timeout to keep alive.
  const signal = config.signal ?? new AbortController().signal;
  const { usage, ...completion } = call.unmanaged
    ? await attempt(signal, () => {}, { signal })
    : await withLlmRetry(
        operation,
        config,
        attempt,
        sink ? { hasStreamed: sink.hasEmitted } : undefined
      );

  noteUsage(config, operation, usage);
  await dump('response', completion);

  return completion;
}

/** One request to whatever answers for this config, on the phone or off it. */
async function complete(config: CoachAIConfig, request: CompletionRequest): Promise<Completion> {
  let call: PreparedCall;
  if (isOnDeviceConfig(config)) {
    call = prepareOnDeviceCall(config, request);
  } else if (config.provider === 'gemini') {
    call = await prepareGeminiCall(config, request);
  } else if (config.provider === 'claude') {
    call = await prepareClaudeCall(config, request);
  } else {
    call = await prepareOpenAiCall(config, request);
  }

  return runPrepared(config, call, request);
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

/** Words of a reply read before any of it is shown, to tell a copy of an earlier coach turn. */
const COPY_GATE_WORDS = 12;

/**
 * One chat reply from the downloaded model that is not a copy of one of its own earlier replies
 * (`ProviderPolicy.regeneratesCopiedChatReply`). A 450M model answers "That's all you can say?" with
 * an answer pasted from five messages earlier, and no sampling setting prevents it: llama.rn does not
 * feed the prompt into the repetition penalties. So the reply is read as it is written. Its first
 * `COPY_GATE_WORDS` words are held back; when they repeat a coach turn that was sent, the generation
 * is stopped before anything was shown and the reply is written again from the person's own
 * messages alone, where there is no coach turn to copy. Without a stream the whole reply is checked
 * instead. A cancel by the person is never turned into a second attempt, and a reply that was not
 * a copy is returned as it came.
 */
async function runOnDeviceChatReply(
  config: OnDeviceConfig,
  systemPrompt: string,
  history: readonly ChatHistoryEntry[],
  userMessage: string,
  sink: StreamSink | null
): Promise<string> {
  const ask = async (
    asking: OnDeviceConfig,
    operation: string,
    turns: readonly ChatHistoryEntry[],
    message: string,
    to: StreamSink | null
  ): Promise<string> =>
    (
      await complete(asking, {
        operation,
        system: systemPrompt,
        turns,
        userMessage: message,
        task: 'chat',
        sink: to,
      })
    ).text;

  const earlierReplies = history.filter((e) => e.role === 'coach').map((e) => e.content);
  if (!providerPolicyFor(config).regeneratesCopiedChatReply || earlierReplies.length === 0) {
    return ask(config, 'sendCoachMessage', history, userMessage, sink);
  }

  // Two reasons to stop a generation: the person's cancel, and the gate finding a copy.
  const stop = new AbortController();
  const stopWithPerson = () => stop.abort();
  if (config.signal?.aborted) {
    stop.abort();
  } else {
    config.signal?.addEventListener('abort', stopWithPerson);
  }

  let copied = false;
  const gate = createCopyGate({
    earlierReplies,
    windowWords: COPY_GATE_WORDS,
    clean: stripStreamingTemplateTokens,
    release: (delta) => sink?.onDelta(delta),
    onCopied: () => {
      copied = true;
      stop.abort();
    },
  });
  const gatedSink: StreamSink | null = sink && {
    onDelta: gate.push,
    reset: () => {
      sink.reset();
      gate.reset();
      copied = false;
    },
    hasEmitted: sink.hasEmitted,
    raw: sink.raw,
  };

  let first: string | null = null;
  try {
    first = await ask(
      { ...config, signal: stop.signal },
      'sendCoachMessage',
      history,
      userMessage,
      gatedSink
    );
    if (gatedSink) {
      gate.finish();
    } else {
      copied = isCopiedReply(stripTemplateTokens(first), earlierReplies);
    }
  } catch (error) {
    // Only the gate's own stop is expected here; the person's cancel and every failure go on.
    if (!(error instanceof AiCancelledError) || !copied || config.signal?.aborted) {
      throw error;
    }
  } finally {
    config.signal?.removeEventListener('abort', stopWithPerson);
  }

  if (!copied && first !== null) {
    return first;
  }

  reportAiEvent('ai-chat-reply-copied', {
    provider: config.provider,
    operation: 'sendCoachMessage',
  });

  // The person's own messages only, run together into one the way `normalizeHistory` does, so the
  // model has no coach turn left to copy. The retry goes through the same cancel and retry rules.
  const [own] = normalizeHistory([
    ...history.filter((e) => e.role !== 'coach'),
    { role: 'user', content: userMessage },
  ]);

  return ask(config, 'sendCoachMessage:withoutCopiedReply', [], own.content, sink);
}

async function sendViaOnDevice(
  config: OnDeviceConfig,
  systemPrompt: string,
  turns: ChatHistoryEntry[],
  userMessage: string,
  stream?: CoachStream
): Promise<CoachResponse> {
  // Chat-template tokens a model leaks (`<|im_start|>assistant …`) never reach the person.
  const raw = stripTemplateTokens(
    await runOnDeviceChatReply(
      config,
      systemPrompt,
      normalizeHistory(turns),
      userMessage,
      stream ? createStreamSink(stream, 'plain') : null
    )
  );

  // An empty reply stays empty: the reply service takes the person's message back and offers a
  // retry. Saving the apology as the coach's answer put it into the history, and a small model
  // copies its own earlier replies.
  return { msg4User: raw, sumMsg: raw.slice(0, 120) };
}

// --- Helpers for insight/parsing/vision ---

const INSIGHTS_USER_MESSAGE = 'Based on the data above, provide your analysis and insights.';

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
  // The on-device engines have a small window and take alternating roles.
  const turns = isOnDeviceConfig(config)
    ? normalizeHistory(
        truncateHistoryByBudget(
          recentConversation,
          contextCharsFor(config) - sanitizedFinalUserMessage.length
        )
      )
    : recentConversation;

  return (
    await complete(config, {
      operation,
      system: systemPrompt,
      turns,
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
  /** Keeps what the request and reply say out of the debug dump. */
  redactDump?: boolean;
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
  schema: object,
  options: Pick<StructuredRequest, 'redactDump'> = {}
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
        ...options,
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
  { operation, redactDump }: Pick<StructuredRequest, 'operation' | 'redactDump'>,
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

  const repaired = await repairStructuredWithModel<T>(config, operation, checked.raw, schema, {
    redactDump,
  });
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

  return reviveLocalStructured(config, request, result, schema);
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
  { text, stop, value }: Completion
): StructuredResult<T> {
  if (value !== undefined) {
    return { kind: 'ok', value: value as T };
  }

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

  return parseStructuredJson<T>(text);
}

/** One structured request, with the schema already built in `structuredDialect(config)`. */
export async function requestStructuredOnce<T = unknown>(
  config: CoachAIConfig,
  request: StructuredRequest,
  schema: object
): Promise<StructuredResult<T>> {
  const { operation, schemaName, systemPrompt, history, userMessage } = request;
  const reply = await complete(config, {
    operation,
    system: systemPrompt,
    turns: history,
    userMessage,
    images: request.images,
    task: request.task ?? 'extraction',
    schema: { name: schemaName, body: schema },
    temperature: request.temperature,
    redactDump: request.redactDump,
  });

  // Apple's guided generation is enforced by the OS; the downloaded model's answer is checked and
  // repaired by `reviveLocalStructured`, the one place that does it.
  return readStructuredReply<T>(config, operation, reply);
}

export type NativeToolCallRequest = {
  operation: string;
  /** The whole conversation the model sees, example turns included; no system prompt is added. */
  messages: LocalChatMessage[];
  tools: LocalToolDefinition[];
  /** Keeps what the request and reply say out of the debug dump. */
  redactDump?: boolean;
};

export type NativeToolCallReply = { text: string; toolCalls: LocalToolCall[] };

/**
 * One request in the model's own tool-call format, for a provider whose policy sets
 * `nativeToolCalls` (the downloaded model): the engine renders the tools through the chat template
 * and parses the calls, and a reply with no call is plain text. Logged and retried like every other
 * request; the caller reads the reply.
 */
export async function requestNativeToolCall(
  config: CoachAIConfig,
  request: NativeToolCallRequest
): Promise<NativeToolCallReply> {
  if (!isOnDeviceConfig(config) || config.engine !== 'gguf') {
    // Only the downloaded model has a tool-call format of its own; the policy decides who calls this.
    throw new Error(`[coachAI] ${request.operation}: ${config.provider} has no native tool calls`);
  }

  const { operation, messages, tools, redactDump } = request;
  const once: LlmRequest<Sent<NativeToolCallReply>> = async (signal, touch) => {
    let usage: LlmUsage | null = null;
    const reply = await sendLocalToolCall(messages, tools, {
      signal,
      onDelta: () => touch(),
      onUsage: (next) => {
        usage = next;
      },
    });

    return { ...reply, usage };
  };

  const { text, toolCalls } = await runPrepared(
    config,
    {
      payload: { messages, tools },
      once,
      // A tool call is read whole: nothing is shown while it is written.
      stream: () => once,
    },
    { operation, redactDump }
  );

  return { text, toolCalls };
}

/** One structured job that is not a conversation turn: what is asked and what must come back. */
export type StructuredJob = {
  systemPrompt: string;
  schema: object;
  /** Names the schema for the provider and the reports. */
  schemaName?: string;
  /** Decides how hard the model reasons. Extraction unless said otherwise. */
  task?: AiTask;
  /** A review round, an arbiter or a first look added to the original request. */
  followUp?: FollowUp;
};

/**
 * One structured request that is not a conversation turn. `userMessage` is sent as given: text the
 * person (or a label) wrote goes through `wrapUserContent` or `prepareChatText` at the caller, which
 * knows which part of the message that is; text written by code (an instruction, a transcript the
 * app built) must reach the model whole and unescaped.
 */
export async function generateStructured<T>(
  config: CoachAIConfig,
  {
    systemPrompt,
    userMessage,
    schema,
    schemaName = 'response',
    task = 'extraction',
    followUp,
  }: StructuredJob & { userMessage: string }
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
      followUp ? followUpOf(original, followUp) : original
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

/**
 * The single funnel for every provider's photo request, for one photo or several of the same meal.
 * Every provider gets the photos at the detail the person chose in AI settings. Musclog Iron has
 * its own step: it also holds the photos to the Worker's limits, and refuses them while the Worker
 * has photos off. `prepared` says the photos were already prepared by `prepareMealImages`.
 */
export async function generateWithImagesStructured<T>(
  config: CoachAIConfig,
  {
    systemPrompt,
    images: rawImages,
    schema,
    schemaName = 'response',
    userMessageSuffix,
    task = 'extraction',
    prepared,
    followUp,
  }: StructuredJob & {
    images: readonly MealImage[];
    /** The person's own notes about the photos. */
    userMessageSuffix?: string;
    prepared?: boolean;
  }
): Promise<T | null> {
  const images = prepared ? [...rawImages] : await prepareMealImages(config, rawImages);

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
    followUp ? followUpOf(original, followUp) : original
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
  if (providerPolicyFor(config).omitsFoundationFoods) {
    return null;
  }

  return (await SettingsService.getSendFoundationFoodsToLlm())
    ? getFoundationFoodsPrompt(style)
    : null;
}

/**
 * How a chat request is put together and sent for one config: decided once, so the flow around it
 * (the draft, the review, a failure) never asks which provider it is talking to.
 */
type ChatTransport = {
  /** The history and the person's message as this provider is sent them. */
  history: ChatHistoryEntry[];
  message: string;
  /** A reply given without asking the model, or null. */
  cannedReply: string | null;
  systemPrompt: () => Promise<string>;
  /** Characters the earlier turns may take, given what the message and a review exchange take. */
  historyBudget: (reservedChars: number) => number;
  send: (
    systemPrompt: string,
    turns: ChatHistoryEntry[],
    message: string,
    stream?: CoachStream
  ) => Promise<CoachResponse>;
};

/**
 * The on-device engines keep their tight budget and their own date line, so no time tags are added,
 * and a message about pain or an injury is handled by their safeguard (`utils/painMention.ts`).
 */
function onDeviceChatTransport(
  config: OnDeviceConfig,
  history: ChatHistoryEntry[],
  message: string,
  context?: 'nutrition' | 'exercise' | 'general'
): ChatTransport {
  const painMentioned = mentionsPainOrInjury(message);

  return {
    history,
    message,
    cannedReply:
      painMentioned && providerPolicyFor(config).answersPainWithFixedReply
        ? i18n.t('coach.onDevicePainReply', { lng: config.language })
        : null,
    systemPrompt: () =>
      getChatMessagePromptContent(config.language, undefined, context, 'on-device', {
        painMentioned,
      }),
    historyBudget: (reservedChars) => contextCharsFor(config) - reservedChars,
    send: (...request) => sendViaOnDevice(config, ...request),
  };
}

/**
 * Gemini, Claude and every OpenAI-compatible provider (OpenAI, a custom local server, the free tier
 * through OpenRouter, and Musclog Iron). Every user turn carries the time it was sent, the newest
 * also how long the pause was.
 */
function cloudChatTransport(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  message: string,
  context?: 'nutrition' | 'exercise' | 'general'
): ChatTransport {
  const tagged = tagTurnsWithTime(history, message, Date.now());

  return {
    history: tagged.history,
    message: tagged.userMessage,
    cannedReply: null,
    systemPrompt: () => chatSystemPrompt(config, tagged.history, context),
    historyBudget: () => contextCharsFor(config),
    send: (...request) => sendViaCloud(config, ...request),
  };
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
  const transport = isOnDeviceConfig(config)
    ? onDeviceChatTransport(config, history, text, context)
    : cloudChatTransport(config, history, text, context);

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
    const { cannedReply } = transport;
    if (cannedReply !== null) {
      await logLlmDebugEvent({
        provider: config.provider,
        direction: 'response',
        operation: 'sendCoachMessage:painFixedReply',
        payload: { text: cannedReply },
        config,
      });

      return { msg4User: cannedReply, sumMsg: cannedReply.slice(0, 120) };
    }

    // Built once, from the full history (the excludes), and reused by the draft and the review.
    const systemPrompt = await transport.systemPrompt();

    // Per dispatched message: the review instruction is longer than the person's message, and a
    // review round also carries the exchange under review (`exchange`), which always stays whole.
    const dispatch = (
      message: string,
      to?: CoachStream,
      exchange: ChatHistoryEntry[] = []
    ): Promise<CoachResponse> => {
      const reserved =
        message.length + exchange.reduce((sum, turn) => sum + turn.content.length, 0);
      const turns = [
        ...truncateHistoryByBudget(
          latestChatTurns(transport.history, config),
          transport.historyBudget(reserved)
        ),
        ...exchange,
      ];

      return transport.send(systemPrompt, turns, message, to);
    };

    const level = await thinkingLevelFor(config);

    // The on-device engines answer in one request at every level (`ProviderPolicy.skipsChatReview`).
    if (!THINKING_PIPELINE[level].chatReview || providerPolicyFor(config).skipsChatReview) {
      return await dispatch(transport.message, target);
    }

    return await draftAndReviewCoachReply(config, transport.message, dispatch, target);
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
  // The downloaded model answers once at every level (`ProviderPolicy.skipsInsightFactCheck`).
  const rounds = providerPolicyFor(config).skipsInsightFactCheck ? 0 : pipeline.reviewRounds;
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
        generateStructured<GenerateMealPlanResponse>(config, {
          systemPrompt,
          userMessage,
          schema,
          schemaName: 'generateMealPlan',
          task: 'planning',
          followUp,
        }),
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
        generateStructured<GenerateWorkoutPlanResponse>(config, {
          systemPrompt,
          userMessage,
          schema,
          schemaName: 'generateWorkoutPlan',
          task: 'planning',
          followUp,
        }),
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
        generateStructured<CalculateVolumeResponse>(config, {
          systemPrompt,
          userMessage,
          schema,
          schemaName: 'calculateNextWorkoutVolume',
          task: 'planning',
          followUp,
        }),
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
      generateWithImagesStructured<MacroEstimate>(config, {
        systemPrompt,
        images: [{ base64, mimeType }],
        schema,
        schemaName: 'estimateMacros',
        userMessageSuffix,
        followUp,
      })
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
      generateStructured<MacroEstimate>(config, {
        systemPrompt,
        userMessage,
        schema,
        schemaName: 'estimateMacros',
        followUp,
      })
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
        generateStructured<{ pastWorkouts: ParsedWorkout[] }>(config, {
          systemPrompt,
          userMessage: i18n.t('coach.aiInstructions.parseWorkouts', { lng: lang }),
          schema,
          schemaName: 'parsePastWorkouts',
          followUp,
        })
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
        generateStructured<{ pastNutrition: ParsedNutrition[] }>(config, {
          systemPrompt,
          userMessage: i18n.t('coach.aiInstructions.parseNutrition', { lng: lang }),
          schema,
          schemaName: 'parsePastNutrition',
          followUp,
        })
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
        generateStructured<{ nutritionEntries: NutritionEntry[] }>(config, {
          systemPrompt,
          userMessage: i18n.t('coach.aiInstructions.parseRetrospectiveNutrition', { lng: lang }),
          schema,
          schemaName: 'parseRetrospectiveNutrition',
          followUp,
        })
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
