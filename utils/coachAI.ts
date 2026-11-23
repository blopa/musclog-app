import Anthropic from '@anthropic-ai/sdk';
import { Content, Part } from '@google/genai';
import OpenAI from 'openai';

import { MUSCLOG_GATEWAY_MAX_TOKENS, MUSCLOG_GATEWAY_PROVIDER } from '@/constants/gateway';
import { DebugDumpService } from '@/database/services/DebugDumpService';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n, { DEFAULT_LANG } from '@/lang/lang';
import { type HostedErrorKind, hostedErrorKindOf } from '@/utils/hostedAiError';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';

import { type AiEffort, type AiTask, effortFor } from './aiEffort';
import { notifyUserFacingAiError } from './aiErrorNotice';
import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  rethrowUserFacingAiError,
} from './aiErrors';
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
import { withGatewayProviderPin } from './gatewayRouting';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from './gemini';
import { handleError } from './handleError';
import { providerPolicyFor } from './hostedProviderPolicy';
import { readJsonStringField } from './jsonStringFieldStream';
import { withLlmRetry } from './llmRetry';
import { extractLlmUsage, type LlmUsage, mergeLlmUsage, recordLlmUsage } from './llmUsage';
import { type MealEstimateProgressListener } from './mealEstimateProgress';
import { ingredientMacroProblems } from './mealPlausibility';
import { sendOnDeviceMessage, sendOnDeviceStructured, streamOnDeviceMessage } from './onDeviceAi';
import {
  createWorkoutPlanPrompt,
  getActiveCustomPrompts,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getChatMessagePromptContent,
  getEstimateMacrosFunctions,
  getEstimateMissingIngredientsFunctions,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getGenerateMealPlanFunctions,
  getGenerateMealPlanPrompt,
  getGenerateWorkoutPlanFunctions,
  getMealAnalysisPrompt,
  getMealCritiquePrompt,
  getMissingIngredientsMacrosPrompt,
  getNutritionInsightsPrompt,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getRecentWorkoutInsightsPromptByLogId,
  getRecentWorkoutsInsightsPrompt,
  getRecipeExtractionFunctions,
  getRecipeExtractionPrompt,
  getRetrospectiveNutritionPrompt,
  getTrackMealFunctions,
  getWorkoutInsightsPrompt,
  getWorkoutVolumeInsightsPrompt,
} from './prompts';
import { prepareChatText, wrapUserContent } from './promptSanitizer';

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
 * The request never got a response: the device dropped the connection (flaky mobile data, a
 * backgrounded app, `unexpected end of stream` from OkHttp). The OpenAI SDK has already retried
 * these twice (`maxRetries` defaults to 2) by the time one surfaces, so it is the user's network,
 * not a Musclog bug. Covers the OpenAI SDK's wrapper (and its timeout subclass) plus the raw fetch
 * failures the Gemini SDK lets through: expo/fetch's `fetch failed: …` and RN's
 * `Network request failed`.
 */
export function isAiConnectionError(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionError || error instanceof Anthropic.APIConnectionError) {
    return true;
  }

  const message = String((error as any)?.message ?? '').toLowerCase();
  return message.startsWith('fetch failed:') || message === 'network request failed';
}

/**
 * Hosted Premium kinds that reach Sentry: `unavailable` (the Worker failed: 5xx, hosted_disabled,
 * an expired session) and `alreadyProcessed` (the app's idempotency key is broken). Every other
 * hosted kind (budget, daily limit, subscription, removed, daily full, busy) is the subscriber's
 * normal state or a retry the app already handles, so it stays out.
 */
const HOSTED_KINDS_REPORTED = new Set<HostedErrorKind>(['unavailable', 'alreadyProcessed']);

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
    maxCharBudget: 4500, // Tight cap per Apple Intelligence optimization spec
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
    enableFoundationFoods: false,
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
};

/**
 * A config that can send, or a hosted one whose session token could not be minted (built by
 * `AiService`): the second carries why, and its requests fail with the matching hosted error
 * without being sent, so the data recipient never changes silently. The failure exists only on the
 * hosted variant.
 */
export type CoachAIConfig =
  | (CoachAIConfigFields & { hostedGrantFailure?: undefined })
  | (Omit<CoachAIConfigFields, 'provider' | 'apiKey' | 'baseUrl'> & {
      provider: 'hosted';
      hostedGrantFailure: PremiumActionFailure;
      apiKey?: undefined;
      baseUrl?: undefined;
    });

/** The effort a job gets: its row of `AI_TASK_EFFORT`, or `high` when "Use thinking mode" is on. */
async function resolveEffort(task: AiTask): Promise<AiEffort> {
  return effortFor(task, await SettingsService.getUseThinkingMode());
}

/**
 * OpenAI's own reasoning control, sent only to the provider that is OpenAI itself: a local server,
 * the free tier and Musclog Iron speak the same protocol but their models may reject the field.
 * `low`, `medium` and `high` are the values every OpenAI reasoning model takes; `minimal` is sent as
 * `low` because not every model lists anything below it.
 */
function openAiReasoning(
  config: CoachAIConfig,
  effort: AiEffort
): { reasoning_effort?: 'low' | 'medium' | 'high' } {
  if (config.provider !== 'openai') {
    return {};
  }

  return { reasoning_effort: effort === 'minimal' ? 'low' : effort };
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
    // A provider whose retries are `withLlmRetry`'s alone turns the SDK's own off (hosted policy).
    // Per-request headers (the hosted idempotency key) are passed per call through the `options` that
    // `withLlmRetry` hands the request, never as client defaults.
    maxRetries: providerPolicyFor(config.provider).sdkMaxRetries,
    fetch: pinFetch,
  });
}

async function logLlmDebugEvent(params: {
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
export type CoachStream = { onText: (textSoFar: string) => void };

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
      const visible = mode === 'plain' ? raw.trimStart() : readJsonStringField(raw, 'msg4User');
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

type GeminiModel = Awaited<ReturnType<typeof configureBasicGenAI>>;

async function streamGeminiText(
  genModel: GeminiModel,
  contents: Content[],
  operation: string,
  config: CoachAIConfig,
  sink: StreamSink
): Promise<string> {
  return withLlmRetry(
    operation,
    config,
    async (signal, touch) => {
      sink.reset();
      let usage: LlmUsage | null = null;
      const chunks = await genModel.generateContentStream({ contents, abortSignal: signal });
      for await (const chunk of chunks) {
        touch();
        usage = mergeLlmUsage(usage, extractLlmUsage(chunk));
        const { text } = extractGeminiText(chunk);
        if (text) {
          sink.onDelta(text);
        }
      }

      noteUsage(config, operation, usage);
      return sink.raw();
    },
    { hasStreamed: sink.hasEmitted }
  );
}

/** One non-streaming OpenAI-compatible completion, retried and timed out by `withLlmRetry`. */
function createOpenAiCompletion(
  client: OpenAI,
  operation: string,
  config: CoachAIConfig,
  payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
) {
  return withLlmRetry(operation, config, (_signal, _touch, options) =>
    client.chat.completions.create(payload, options)
  );
}

async function streamOpenAiText(
  client: OpenAI,
  payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  operation: string,
  config: CoachAIConfig,
  sink: StreamSink
): Promise<string> {
  return withLlmRetry(
    operation,
    config,
    async (_signal, touch, options) => {
      sink.reset();
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

      noteUsage(config, operation, usage);
      return sink.raw();
    },
    { hasStreamed: sink.hasEmitted }
  );
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
      effort: claudeEffort(await resolveEffort(options.task)),
      ...(options.schema
        ? { format: { type: 'json_schema', schema: makeSchemaStrict(options.schema) } }
        : {}),
    },
  };
}

/**
 * Sends a Claude request and returns the reply text, logging both sides for the debug dump. With a
 * `sink` the reply is streamed into it (and `max_tokens` is raised, since a stream has no HTTP
 * timeout to stay under); without one it is a single request.
 */
async function runClaude(
  config: CoachAIConfig,
  operation: string,
  params: ClaudeParams,
  sink?: StreamSink | null
): Promise<string> {
  const client = buildClaudeClient(config.apiKey);
  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation,
    payload: params,
    config,
  });

  let text: string;
  if (sink) {
    text = await withLlmRetry(
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

        noteUsage(config, operation, await finalClaudeUsage(events));
        return sink.raw();
      },
      { hasStreamed: sink.hasEmitted }
    );
  } else {
    const message = await withLlmRetry(operation, config, (signal) =>
      client.messages.create(params, { signal })
    );
    noteUsage(config, operation, extractLlmUsage(message));
    text = extractClaudeText(message).text;
  }

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation,
    payload: { text },
    config,
  });

  return text;
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
export function normalizeHistory(history: ChatHistoryEntry[]): ChatHistoryEntry[] {
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

function extractRawText(response: any): string {
  const { text, finishReason, blockReason, thoughtOnly } = extractGeminiText(response);
  if (!text.trim()) {
    // An empty answer has several different causes; say which, so "analyzing forever" is debuggable.
    console.warn(
      `[coachAI] Gemini returned no answer text (finishReason=${finishReason ?? 'none'}, blockReason=${blockReason ?? 'none'}, thoughtOnly=${thoughtOnly})`
    );
  }

  return text;
}

function parseCoachResponse(raw: string): CoachResponse {
  try {
    // Handle cases where the model might wrap JSON in markdown blocks
    const cleanJson = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    return {
      msg4User: parsed.msg4User ?? raw,
      sumMsg: parsed.sumMsg ?? undefined,
      sumUserMsg: parsed.sumUserMsg ?? undefined,
      rememberMe: parsed.remember_me ?? undefined,
    };
  } catch {
    return { msg4User: raw };
  }
}

function buildGeminiContents(history: ChatHistoryEntry[], userMessage: string): Content[] {
  const normalized = normalizeHistory(history);
  const historyContents: Content[] = normalized.map((entry) => ({
    parts: [{ text: entry.content } as Part],
    role: entry.role === 'coach' ? 'model' : 'user',
  }));

  return [...historyContents, { parts: [{ text: userMessage } as Part], role: 'user' }];
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

async function sendViaGemini(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.gemini;
  const systemPrompt = await chatSystemPrompt(config, history, context);
  const systemParts: Part[] = [{ text: systemPrompt }];

  const truncatedHistory = truncateHistoryByBudget(history, providerConfig.maxCharBudget);
  // Gemini does not promise the schema's property order, and the reply is shown from the first
  // property while the rest is still being written.
  const responseSchema = {
    ...buildResponseSchema(),
    propertyOrdering: ['msg4User', 'remember_me'],
  };

  const genModel = await configureBasicGenAI(
    {
      apiKey: config.apiKey,
      model: config.model,
      generationConfig: buildGeminiGenerationConfig(config.model, {
        responseSchema,
        effort: await resolveEffort('chat'),
      }),
    },
    systemParts
  );

  const contents = buildGeminiContents(truncatedHistory, userMessage);
  const requestPayload = {
    model: config.model,
    contents,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      systemInstruction: {
        parts: systemParts,
      },
    },
  };

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation: 'sendViaGemini',
    payload: requestPayload,
    config,
  });

  if (stream) {
    const streamedRaw = await streamGeminiText(
      genModel,
      contents,
      'sendViaGemini',
      config,
      createStreamSink(stream, 'coachJson')
    );
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'sendViaGemini',
      payload: { text: streamedRaw },
      config,
    });

    return parseCoachResponse(streamedRaw);
  }

  const result = await withLlmRetry('sendViaGemini', config, (signal) =>
    genModel.generateContent({ contents, abortSignal: signal })
  );

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: 'sendViaGemini',
    payload: result,
    config,
  });

  noteUsage(config, 'sendViaGemini', extractLlmUsage(result));
  const raw = extractRawText(result);
  return parseCoachResponse(raw);
}

async function sendViaOpenAI(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const client = buildOpenAIClient(config);
  const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;

  const systemPrompt = await chatSystemPrompt(config, history, context);

  const truncatedHistory = truncateHistoryByBudget(history, providerConfig.maxCharBudget);
  const normalized = normalizeHistory(truncatedHistory);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...normalized.map((entry) => ({
      role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: entry.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const schema = makeSchemaStrict(buildResponseSchema());
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages,
    ...openAiReasoning(config, await resolveEffort('chat')),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'coach_response',
        strict: true,
        schema,
      },
    },
  };

  const sink = stream ? createStreamSink(stream, 'coachJson') : null;
  try {
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'request',
      operation: 'sendViaOpenAI',
      payload: requestPayload,
      config,
    });

    if (sink) {
      const streamedRaw = await streamOpenAiText(
        client,
        requestPayload,
        'sendViaOpenAI',
        config,
        sink
      );

      await logLlmDebugEvent({
        provider: config.provider,
        direction: 'response',
        operation: 'sendViaOpenAI',
        payload: { text: streamedRaw },
        config,
      });

      return parseCoachResponse(streamedRaw || '{}');
    }

    const completion = await createOpenAiCompletion(
      client,
      'sendViaOpenAI',
      config,
      requestPayload
    );

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'sendViaOpenAI',
      payload: completion,
      config,
    });

    noteUsage(config, 'sendViaOpenAI', extractLlmUsage(completion));
    const raw = completion.choices[0]?.message?.content ?? '{}';
    return parseCoachResponse(raw);
  } catch (error) {
    return failedCoachReply(error, config, 'sendViaOpenAI', sink);
  }
}

/**
 * What a chat request that threw turns into: a typed, user-actionable error is rethrown; a reply
 * that was already on screen is taken back by the caller (a friendly error message saved as the
 * coach's answer would sit next to half of the real one); a spent quota is an `AiCreditsError`;
 * anything else becomes a generic apology without the internals.
 */
async function failedCoachReply(
  error: unknown,
  config: CoachAIConfig,
  operation: string,
  sink: StreamSink | null
): Promise<CoachResponse> {
  rethrowUserFacingAiError(error);
  if (sink?.hasEmitted()) {
    throw error;
  }

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation,
    payload: { error },
    config,
  });
  console.error(`[coachAI] ${operation} error:`, error);

  // Log detailed error for debugging but don't expose internals to user
  reportAiError(error, `coachAI.${operation}`);

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

async function sendViaClaude(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const systemPrompt = await chatSystemPrompt(config, history, context);
  const truncatedHistory = truncateHistoryByBudget(history, PROVIDER_CONFIGS.claude.maxCharBudget);
  const params = await buildClaudeParams(
    config,
    systemPrompt,
    buildClaudeMessages(truncatedHistory, userMessage),
    { task: 'chat', schema: buildResponseSchema(), cache: true }
  );

  const sink = stream ? createStreamSink(stream, 'coachJson') : null;
  try {
    const raw = await runClaude(config, 'sendViaClaude', params, sink);
    return parseCoachResponse(raw || '{}');
  } catch (error) {
    return failedCoachReply(error, config, 'sendViaClaude', sink);
  }
}

async function sendViaOnDevice(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const sink = stream ? createStreamSink(stream, 'plain') : null;
  try {
    const providerConfig = PROVIDER_CONFIGS['on-device'];
    const systemPrompt = await getChatMessagePromptContent(
      config.language,
      undefined,
      context,
      'on-device'
    );

    const truncatedHistory = truncateHistoryByBudget(
      history,
      providerConfig.maxCharBudget - userMessage.length
    );
    const normalized = normalizeHistory(truncatedHistory);

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

    const raw = sink
      ? await streamOnDeviceMessage(messages, systemPrompt, sink.onDelta, config.signal)
      : await sendOnDeviceMessage(messages, systemPrompt);

    await logLlmDebugEvent({
      provider: 'on-device',
      direction: 'response',
      operation: 'sendCoachMessage',
      payload: { text: raw },
      config,
    });

    return {
      msg4User: raw || i18n.t('errors.aiProcessingError'),
      sumMsg: raw?.slice(0, 120) ?? '',
    };
  } catch (error) {
    reportAiError(error, 'coachAI.sendViaOnDevice');
    if (sink?.hasEmitted()) {
      throw error;
    }

    return {
      msg4User: i18n.t('errors.aiProcessingError'),
      sumMsg: i18n.t('errors.aiProcessingErrorTitle'),
    };
  }
}

// --- Helpers for insight/parsing/vision ---

const INSIGHTS_USER_MESSAGE = 'Based on the data above, provide your analysis and insights.';

/**
 * The plain-text path for Apple's on-device model. It used to fall through to the OpenAI client
 * (no base URL, key "unused"), which sent the prompt — workout and nutrition data — to OpenAI,
 * was rejected, and left every insight feature broken on-device.
 */
async function generateTextOnDevice(
  config: CoachAIConfig,
  systemPrompt: string,
  history: ChatHistoryEntry[],
  userMessage: string,
  stream?: CoachStream
): Promise<string> {
  const truncatedHistory = truncateHistoryByBudget(
    history,
    PROVIDER_CONFIGS['on-device'].maxCharBudget - userMessage.length
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
  const raw = sink
    ? await streamOnDeviceMessage(messages, systemPrompt, sink.onDelta, config.signal)
    : await sendOnDeviceMessage(messages, systemPrompt);

  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'response',
    operation: 'generateText',
    payload: { text: raw },
    config,
  });

  return (raw ?? '').trim();
}

async function generateText(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string = INSIGHTS_USER_MESSAGE,
  stream?: CoachStream,
  task: AiTask = 'insight'
): Promise<string> {
  // Wrap user message with delimiters to prevent prompt injection
  const sanitizedUserMessage = wrapUserContent(userMessage);
  const lang = config.language ?? DEFAULT_LANG;
  const promptWithLang = `${systemPrompt}\n\nRespond in the following language/locale: ${lang}.`;
  if (config.provider === 'on-device') {
    return generateTextOnDevice(config, promptWithLang, [], sanitizedUserMessage, stream);
  }

  if (config.provider === 'gemini') {
    const requestPayload = {
      model: config.model,
      contents: [{ parts: [{ text: sanitizedUserMessage } as Part], role: 'user' }],
      config: {
        systemInstruction: {
          parts: [{ text: promptWithLang } as Part],
        },
      },
    };

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'request',
      operation: 'generateText',
      payload: requestPayload,
      config,
    });

    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: buildGeminiGenerationConfig(config.model, {
          effort: await resolveEffort(task),
          json: false,
        }),
      },
      [{ text: promptWithLang } as Part]
    );

    const contents: Content[] = [{ parts: [{ text: sanitizedUserMessage } as Part], role: 'user' }];
    if (stream) {
      const streamedRaw = await streamGeminiText(
        genModel,
        contents,
        'generateText',
        config,
        createStreamSink(stream, 'plain')
      );
      await logLlmDebugEvent({
        provider: config.provider,
        direction: 'response',
        operation: 'generateText',
        payload: { text: streamedRaw },
        config,
      });

      return streamedRaw.trim();
    }

    const result = await withLlmRetry('generateText', config, (signal) =>
      genModel.generateContent({ contents, abortSignal: signal })
    );

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'generateText',
      payload: result,
      config,
    });

    const raw = extractRawText(result);
    return raw?.trim() ?? '';
  }

  if (config.provider === 'claude') {
    const params = await buildClaudeParams(
      config,
      promptWithLang,
      [{ role: 'user', content: sanitizedUserMessage }],
      { task }
    );
    const raw = await runClaude(
      config,
      'generateText',
      params,
      stream ? createStreamSink(stream, 'plain') : null
    );

    return raw.trim();
  }

  const client = buildOpenAIClient(config);
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: promptWithLang },
      { role: 'user', content: sanitizedUserMessage },
    ],
    ...openAiReasoning(config, await resolveEffort(task)),
  };

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation: 'generateText',
    payload: requestPayload,
    config,
  });

  if (stream) {
    const streamedRaw = await streamOpenAiText(
      client,
      requestPayload,
      'generateText',
      config,
      createStreamSink(stream, 'plain')
    );
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'generateText',
      payload: { text: streamedRaw },
      config,
    });

    return streamedRaw.trim();
  }

  const completion = await createOpenAiCompletion(client, 'generateText', config, requestPayload);

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: 'generateText',
    payload: completion,
    config,
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  return raw.trim();
}

/**
 * Generate text with recent conversation history so the model keeps context.
 * Sends system prompt, then history (last N messages), then final user message.
 */
async function generateTextWithHistory(
  config: CoachAIConfig,
  systemPrompt: string,
  recentConversation: ChatHistoryEntry[],
  finalUserMessage: string,
  stream?: CoachStream,
  task: AiTask = 'insight'
): Promise<string> {
  // Wrap user message with delimiters to prevent prompt injection
  const sanitizedFinalUserMessage = wrapUserContent(finalUserMessage);
  if (config.provider === 'on-device') {
    return generateTextOnDevice(
      config,
      systemPrompt,
      recentConversation,
      sanitizedFinalUserMessage,
      stream
    );
  }

  if (config.provider === 'gemini') {
    const contents = buildGeminiContents(recentConversation, sanitizedFinalUserMessage);
    const requestPayload = {
      model: config.model,
      contents,
      config: {
        systemInstruction: {
          parts: [{ text: systemPrompt } as Part],
        },
      },
    };

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'request',
      operation: 'generateTextWithHistory',
      payload: requestPayload,
      config,
    });

    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: buildGeminiGenerationConfig(config.model, {
          effort: await resolveEffort(task),
          json: false,
        }),
      },
      [{ text: systemPrompt } as Part]
    );
    if (stream) {
      const streamedRaw = await streamGeminiText(
        genModel,
        contents,
        'generateTextWithHistory',
        config,
        createStreamSink(stream, 'plain')
      );
      await logLlmDebugEvent({
        provider: config.provider,
        direction: 'response',
        operation: 'generateTextWithHistory',
        payload: { text: streamedRaw },
        config,
      });

      return streamedRaw.trim();
    }

    const result = await withLlmRetry('generateTextWithHistory', config, (signal) =>
      genModel.generateContent({ contents, abortSignal: signal })
    );

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'generateTextWithHistory',
      payload: result,
      config,
    });

    const raw = extractRawText(result);
    return raw?.trim() ?? '';
  }

  if (config.provider === 'claude') {
    const params = await buildClaudeParams(
      config,
      systemPrompt,
      buildClaudeMessages(recentConversation, sanitizedFinalUserMessage),
      { task }
    );
    const raw = await runClaude(
      config,
      'generateTextWithHistory',
      params,
      stream ? createStreamSink(stream, 'plain') : null
    );

    return raw.trim();
  }

  const client = buildOpenAIClient(config);
  const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = recentConversation.map((e) => ({
    role: (e.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: e.content,
  }));

  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: sanitizedFinalUserMessage },
    ],
    ...openAiReasoning(config, await resolveEffort(task)),
  };

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation: 'generateTextWithHistory',
    payload: requestPayload,
    config,
  });

  if (stream) {
    const streamedRaw = await streamOpenAiText(
      client,
      requestPayload,
      'generateTextWithHistory',
      config,
      createStreamSink(stream, 'plain')
    );
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'generateTextWithHistory',
      payload: { text: streamedRaw },
      config,
    });

    return streamedRaw.trim();
  }

  const completion = await createOpenAiCompletion(
    client,
    'generateTextWithHistory',
    config,
    requestPayload
  );

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: 'generateTextWithHistory',
    payload: completion,
    config,
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  return raw.trim();
}

function getSchemaFromFunctionDeclaration(fn: {
  parameters?: { type?: string; properties?: object; required?: string[] };
}): object {
  const p = fn.parameters;
  if (!p || typeof p !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }

  return {
    type: p.type ?? 'object',
    properties: p.properties ?? {},
    required: p.required ?? [],
  };
}

export type StructuredDialect = 'openai' | 'gemini' | 'claude' | 'on-device';

export type StructuredRequest = {
  /** Names the call in debug dumps and retry logs. */
  operation: string;
  schemaName: string;
  /** Already carries any language note. */
  systemPrompt: string;
  /** The conversation so far, without the message being sent. */
  history: ChatHistoryEntry[];
  userMessage: string;
  /** Each provider takes the schema in a slightly different dialect. */
  buildSchema: (dialect: StructuredDialect) => object;
  /** What kind of job this is, which decides how hard the model reasons. Defaults to extraction. */
  task?: AiTask;
};

export type StructuredResult<T = unknown> =
  { kind: 'ok'; value: T } | { kind: 'malformed'; raw: string };

const MALFORMED_RAW_PREVIEW_CHARS = 500;

function parseStructuredJson<T>(raw: string): StructuredResult<T> {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    if (clean) {
      return { kind: 'ok', value: JSON.parse(clean) as T };
    }
  } catch {
    // Not JSON: reported as malformed below.
  }

  return { kind: 'malformed', raw: raw.slice(0, MALFORMED_RAW_PREVIEW_CHARS) };
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
  const { operation, schemaName, systemPrompt, history, userMessage } = request;
  const task = request.task ?? 'extraction';

  if (config.provider === 'on-device') {
    const messages = [
      ...history.map((entry) => ({
        role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: entry.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];
    const schema = request.buildSchema('on-device');
    await logLlmDebugEvent({
      provider: 'on-device',
      direction: 'request',
      operation,
      payload: { systemPrompt, messages, schema },
      config,
    });

    const value = await sendOnDeviceStructured<T>(messages, systemPrompt, schema);
    await logLlmDebugEvent({
      provider: 'on-device',
      direction: 'response',
      operation,
      payload: value,
      config,
    });

    return value === null || value === undefined
      ? { kind: 'malformed', raw: '' }
      : { kind: 'ok', value };
  }

  if (config.provider === 'gemini') {
    const schema = request.buildSchema('gemini');
    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        // How hard it thinks follows the kind of job (`utils/aiEffort.ts`); the user's thinking-mode
        // setting is the explicit way to ask for more.
        generationConfig: buildGeminiGenerationConfig(config.model, {
          responseSchema: schema,
          effort: await resolveEffort(task),
        }),
      },
      [{ text: systemPrompt } as Part]
    );
    const contents = buildGeminiContents(history, userMessage);
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'request',
      operation,
      payload: { model: config.model, contents, systemPrompt, schema },
      config,
    });

    const result = await withLlmRetry(operation, config, (signal) =>
      genModel.generateContent({ contents, abortSignal: signal })
    );
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation,
      payload: result,
      config,
    });

    return parseStructuredJson<T>(extractRawText(result));
  }

  if (config.provider === 'claude') {
    const params = await buildClaudeParams(
      config,
      systemPrompt,
      buildClaudeMessages(history, userMessage),
      { task, schema: request.buildSchema('claude') }
    );

    return parseStructuredJson<T>(await runClaude(config, operation, params));
  }

  const client = buildOpenAIClient(config);
  const payload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((entry) => ({
        role: (entry.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: entry.content,
      })),
      { role: 'user', content: userMessage },
    ],
    ...openAiReasoning(config, await resolveEffort(task)),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: makeSchemaStrict(request.buildSchema('openai')),
      },
    },
  };
  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation,
    payload,
    config,
  });

  const completion = await createOpenAiCompletion(client, operation, config, payload);
  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation,
    payload: completion,
    config,
  });

  return parseStructuredJson<T>(completion.choices[0]?.message?.content ?? '');
}

async function generateStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string,
  schema: object,
  schemaName: string = 'response',
  task: AiTask = 'extraction'
): Promise<T | null> {
  const lang = config.language ?? DEFAULT_LANG;

  try {
    const result = await requestStructured<T>(config, {
      operation: 'generateStructured',
      task,
      schemaName,
      systemPrompt: `${systemPrompt}\n\nRespond in the following language/locale: ${lang}. All user-facing content in the structured output (e.g. titles, descriptions) must be in this language.`,
      history: [],
      // Wrap user message with delimiters to prevent prompt injection
      userMessage: wrapUserContent(userMessage),
      buildSchema: () => schema,
    });

    return result.kind === 'ok' ? result.value : null;
  } catch (error) {
    // The on-device model has no retry layer to classify its failures, so a bad run is "no answer".
    if (config.provider !== 'on-device') {
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
 * pattern of `utils/hostedProviderPolicy.ts` and `services/premium/revenueCat.ts`).
 */
function prepareOwnKeyImageLazily(
  base64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiImage: typeof import('@/utils/aiImage') = require('@/utils/aiImage');

  return aiImage.prepareOwnKeyImage(base64, mimeType);
}

async function generateWithImageStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  rawBase64Image: string,
  rawMimeType: string,
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string,
  task: AiTask = 'extraction'
): Promise<T | null> {
  // Every provider gets the photo at the detail the person chose in AI settings. Musclog Iron has
  // its own step: it also holds the photo to the Worker's limits, and refuses it while the Worker
  // has photos off.
  const prepareImage = providerPolicyFor(config.provider).prepareImage ?? prepareOwnKeyImageLazily;
  const { base64: base64Image, mimeType } = await prepareImage(rawBase64Image, rawMimeType);

  // Wrap user message suffix with delimiters to prevent prompt injection
  const sanitizedSuffix = userMessageSuffix?.trim()
    ? wrapUserContent(userMessageSuffix.trim())
    : '';

  const userText =
    'Analyze this image and return the structured data.' +
    (sanitizedSuffix ? `\n\n${sanitizedSuffix}` : '');

  if (config.provider === 'gemini') {
    const requestPayload = {
      model: config.model,
      contents: [
        {
          parts: [
            { text: userText } as Part,
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            } as Part,
          ],
          role: 'user',
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: {
          parts: [{ text: systemPrompt } as Part],
        },
      },
    };

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'request',
      operation: 'generateWithImageStructured',
      payload: requestPayload,
      config,
    });

    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: buildGeminiGenerationConfig(config.model, {
          responseSchema: schema,
          effort: await resolveEffort(task),
        }),
      },
      [{ text: systemPrompt } as Part]
    );

    const contents: Content[] = [
      {
        parts: [
          { text: userText } as Part,
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          } as Part,
        ],
        role: 'user',
      },
    ];

    const result = await withLlmRetry('generateWithImageStructured', config, (signal) =>
      genModel.generateContent({ contents, abortSignal: signal })
    );

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'generateWithImageStructured',
      payload: result,
      config,
    });

    const raw = extractRawText(result);
    if (!raw?.trim()) {
      return null;
    }

    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(clean) as T;
    } catch {
      return null;
    }
  }

  if (config.provider === 'claude') {
    const params = await buildClaudeParams(
      config,
      systemPrompt,
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: claudeImageType(mimeType), data: base64Image },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
      { task, schema }
    );
    const result = parseStructuredJson<T>(
      await runClaude(config, 'generateWithImageStructured', params)
    );

    return result.kind === 'ok' ? result.value : null;
  }

  const client = buildOpenAIClient(config);
  const strictSchema = makeSchemaStrict(schema);
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    ...openAiReasoning(config, await resolveEffort(task)),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: strictSchema,
      },
    },
  };

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation: 'generateWithImageStructured',
    payload: requestPayload,
    config,
  });

  const completion = await createOpenAiCompletion(
    client,
    'generateWithImageStructured',
    config,
    requestPayload
  );

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation: 'generateWithImageStructured',
    payload: completion,
    config,
  });

  const raw = completion.choices[0]?.message?.content ?? '';
  if (!raw?.trim()) {
    return null;
  }

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}

async function extractRecipe(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string
): Promise<RecipeExtractionResponse | null> {
  const lang = config.language ?? DEFAULT_LANG;
  const providerConfig = PROVIDER_CONFIGS[config.provider] ?? PROVIDER_CONFIGS.openai;
  const includeFoundationFoods = providerConfig.enableFoundationFoods
    ? await SettingsService.getSendFoundationFoodsToLlm()
    : false;
  const systemPrompt = await getRecipeExtractionPrompt(includeFoundationFoods, lang);
  const fns = getRecipeExtractionFunctions(includeFoundationFoods);
  const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

  if (base64Image) {
    if (config.provider === 'on-device') {
      // TODO: for now, on-device cant parse images
      return null;
    }

    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    return generateWithImageStructured<RecipeExtractionResponse>(
      config,
      systemPrompt,
      base64,
      mimeType,
      schema,
      'extractRecipe',
      userMessage
    );
  }

  return generateStructured<RecipeExtractionResponse>(
    config,
    systemPrompt,
    userMessage,
    schema,
    'extractRecipe'
  );
}

async function estimateMissingIngredients(
  config: CoachAIConfig,
  newIngredients: RecipeIngredient[],
  knownIngredients: TrackMealIngredient[],
  mealName: string
): Promise<MissingIngredientMacrosResponse | null> {
  const systemPrompt = getMissingIngredientsMacrosPrompt(
    mealName,
    knownIngredients,
    newIngredients
  );
  const fns = getEstimateMissingIngredientsFunctions();
  const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

  return generateStructured<MissingIngredientMacrosResponse>(
    config,
    systemPrompt,
    `Estimate macros for the missing ingredients in "${mealName}".`,
    schema,
    'estimateMissingIngredients'
  );
}

/** Progress is a courtesy to the screen: a listener that throws must never fail an estimate. */
function reportMealProgress(
  listener: MealEstimateProgressListener | undefined,
  progress: Parameters<MealEstimateProgressListener>[0]
): void {
  try {
    listener?.(progress);
  } catch {
    // Ignored on purpose.
  }
}

/** An ingredient with no numbers at all: the model named it but gave no energy or macros. */
function hasNoNumbers(ingredient: TrackMealIngredient): boolean {
  return !(
    ingredient.kcal > 0 ||
    ingredient.protein > 0 ||
    ingredient.carbs > 0 ||
    ingredient.fat > 0
  );
}

/** The estimate for `target`: the one with its name, else the one in its place when counts agree. */
function estimateFor(
  target: { name: string },
  index: number,
  count: number,
  estimates: TrackMealIngredient[]
): TrackMealIngredient | undefined {
  const key = target.name.trim().toLowerCase();
  return (
    estimates.find((estimate) => estimate.name.trim().toLowerCase() === key) ??
    (estimates.length === count ? estimates[index] : undefined)
  );
}

function withEstimatedMacros(
  target: TrackMealIngredient,
  estimate: TrackMealIngredient
): TrackMealIngredient {
  return {
    ...target,
    kcal: estimate.kcal,
    protein: estimate.protein,
    carbs: estimate.carbs,
    fat: estimate.fat,
    fiber: estimate.fiber,
  };
}

/**
 * Re-estimates the ingredients of a meal whose numbers cannot all be true (`mealPlausibility`):
 * energy that the macros do not add up to, macros that weigh more than the ingredient, and so on.
 * Only ingredients without a match in the person's own foods are checked, since a match's numbers
 * come from the database. It is one extra request, made only when something is off, and an
 * estimate replaces the original only when it has fewer problems. A failed re-estimate leaves the
 * meal as it was: this is a refinement, never a reason to fail the estimate.
 */
async function recheckImplausibleIngredients(
  config: CoachAIConfig,
  mealName: string,
  ingredients: TrackMealIngredient[],
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealIngredient[]> {
  const suspects = ingredients.filter(
    (ingredient) => !ingredient.foodId && ingredientMacroProblems(ingredient).length > 0
  );
  if (suspects.length === 0) {
    return ingredients;
  }

  reportMealProgress(onProgress, { step: 'rechecking', count: suspects.length });

  try {
    const estimated = await estimateMissingIngredients(
      config,
      suspects.map(({ name, grams }) => ({ name, grams })),
      ingredients.filter((ingredient) => ingredient.foodId),
      mealName
    );
    const estimates = estimated?.ingredients ?? [];

    return ingredients.map((ingredient) => {
      const suspectIndex = suspects.indexOf(ingredient);
      if (suspectIndex < 0) {
        return ingredient;
      }

      const estimate = estimateFor(ingredient, suspectIndex, suspects.length, estimates);
      if (!estimate) {
        return ingredient;
      }

      const better = withEstimatedMacros(ingredient, estimate);
      return ingredientMacroProblems(better).length < ingredientMacroProblems(ingredient).length
        ? better
        : ingredient;
    });
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, 'coachAI.recheckImplausibleIngredients');
    return ingredients;
  }
}

/**
 * What a one-request estimate gets before it is shown or logged. The model may name a food id
 * this database does not have (it invents ids, or sends the string "null"); the lookup then drops
 * the id and keeps the model's numbers, which for a foundation-food match are zeros, so the
 * ingredient would be logged at 0 kcal. Those ingredients are estimated in a follow-up request, the
 * same step the verified path makes; then every ingredient that is not the person's own food gets
 * the plausibility check. With nothing to fix it makes no request.
 */
async function refineTrackedMeals(
  config: CoachAIConfig,
  response: TrackMealResponse,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse> {
  const meals: TrackedMeal[] = [];

  for (const meal of response.meals ?? []) {
    const original = meal.ingredients ?? [];
    const claimedFoodId = original.map((ingredient) => Boolean(ingredient.foodId));
    // Deliberately unguarded: a failed lookup must reject, never leave every id looking unmatched.
    let ingredients = await NutritionService.normalizeAiMealIngredients(original);

    const unnumbered = ingredients.filter(
      (ingredient, index) => claimedFoodId[index] && !ingredient.foodId && hasNoNumbers(ingredient)
    );
    if (unnumbered.length > 0) {
      const matched = ingredients.filter((ingredient) => ingredient.foodId);
      reportMealProgress(onProgress, {
        step: 'estimating',
        count: unnumbered.length,
        matched: matched.length,
      });

      try {
        const estimated = await estimateMissingIngredients(
          config,
          unnumbered.map(({ name, grams }) => ({ name, grams })),
          matched,
          meal.mealName ?? meal.mealType
        );
        const estimates = estimated?.ingredients ?? [];
        ingredients = ingredients.map((ingredient) => {
          const index = unnumbered.indexOf(ingredient);
          const estimate =
            index < 0 ? undefined : estimateFor(ingredient, index, unnumbered.length, estimates);
          return estimate ? withEstimatedMacros(ingredient, estimate) : ingredient;
        });
      } catch (error) {
        if (error instanceof AiCancelledError) {
          throw error;
        }

        reportAiError(error, 'coachAI.refineTrackedMeals');
      }
    }

    meals.push({
      ...meal,
      ingredients: await recheckImplausibleIngredients(
        config,
        meal.mealName ?? meal.mealType,
        ingredients,
        onProgress
      ),
    });
  }

  return { ...response, meals };
}

/**
 * The verified meal estimate, used when "Use thinking mode" is on: it separates what the model can
 * read (the recipe: meals, ingredients, grams, the foods of the person it recognises) from what it
 * must work out (the numbers of what is left), checking each claimed food id against the database
 * in between. Slower than one request, with more of the work done by code and less left to chance.
 */
async function trackMealVerified(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  const recipeResponse = await extractRecipe(config, userMessage, base64Image);
  if (!recipeResponse?.meals?.length) {
    return null;
  }

  const resultMeals: TrackedMeal[] = [];

  for (const meal of recipeResponse.meals) {
    const claimedStubs: TrackMealIngredient[] = meal.ingredients
      .filter((i) => i.foodId)
      .map((i) => ({
        name: i.name,
        grams: i.grams,
        foodId: i.foodId,
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      }));

    // A claimed foodId only counts once the database confirms it: the model sometimes
    // sends the string "null" or an invented id, and treating those as matches would
    // skip estimation and log the ingredient at 0 kcal.
    const normalizedClaimed = await NutritionService.normalizeAiMealIngredients(claimedStubs);
    const matched = normalizedClaimed.filter((i) => i.foodId);
    const newIngredients = [
      ...meal.ingredients.filter((i) => !i.foodId),
      ...normalizedClaimed.filter((i) => !i.foodId).map((i) => ({ name: i.name, grams: i.grams })),
    ];

    let fullIngredients: TrackMealIngredient[] = matched;

    if (newIngredients.length > 0) {
      reportMealProgress(onProgress, {
        step: 'estimating',
        count: newIngredients.length,
        matched: matched.length,
      });
      const estimated = await estimateMissingIngredients(
        config,
        newIngredients,
        matched,
        meal.mealName
      );

      fullIngredients = [
        ...matched,
        ...(estimated?.ingredients ??
          newIngredients.map((i) => ({
            name: i.name,
            grams: i.grams,
            kcal: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          }))),
      ];
    }

    resultMeals.push({
      mealType: meal.mealType,
      mealName: meal.mealName,
      ingredients: fullIngredients,
    });
  }

  for (const meal of resultMeals) {
    const normalized = await NutritionService.normalizeAiMealIngredients(meal.ingredients);
    meal.ingredients = await recheckImplausibleIngredients(
      config,
      meal.mealName ?? meal.mealType,
      normalized,
      onProgress
    );
  }

  return { meals: resultMeals };
}

/**
 * Track a meal from description or base64 image
 */
export async function trackMeal(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  try {
    reportMealProgress(onProgress, { step: 'reading', photo: Boolean(base64Image) });
    const useThinkingMode = await SettingsService.getUseThinkingMode();
    if (useThinkingMode) {
      return await trackMealVerified(config, userMessage, base64Image, onProgress);
    }

    const lang = config.language ?? DEFAULT_LANG;
    const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;
    const includeFoundationFoods = providerConfig.enableFoundationFoods
      ? await SettingsService.getSendFoundationFoodsToLlm()
      : false;
    const systemPrompt = await getMealAnalysisPrompt(includeFoundationFoods, lang);
    const fns = getTrackMealFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    if (base64Image) {
      if (config.provider === 'on-device') {
        // TODO: for now, on-device cant parse images
        return null;
      }

      const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const fromPhoto = await generateWithImageStructured<TrackMealResponse>(
        config,
        systemPrompt,
        base64,
        mimeType,
        schema,
        'trackMeal',
        userMessage
      );
      return fromPhoto ? await refineTrackedMeals(config, fromPhoto, onProgress) : null;
    }

    const parsed = await generateStructured<TrackMealResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'trackMeal'
    );
    return parsed ? await refineTrackedMeals(config, parsed, onProgress) : null;
  } catch (error) {
    notifyUserFacingAiError(error);
    reportAiError(error, 'coachAI.trackMeal');
    return null;
  }
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
  if (config.provider === 'on-device') {
    return sendViaOnDevice(config, history, text, context, stream);
  }

  // Every user turn carries the time it was sent, the newest also how long the pause was.
  const tagged = tagTurnsWithTime(history, text, Date.now());
  history = tagged.history;
  const sanitizedMessage = tagged.userMessage;

  if (config.provider === 'gemini') {
    return sendViaGemini(config, history, sanitizedMessage, context, stream);
  }

  if (config.provider === 'claude') {
    return sendViaClaude(config, history, sanitizedMessage, context, stream);
  }

  // OpenAI, local (custom base URL), gateway (the free tier, via OpenRouter) and hosted all speak
  // the OpenAI-compatible protocol.
  return sendViaOpenAI(config, history, sanitizedMessage, context, stream);
}

/**
 * AI FUNCTION DISPATCHERS
 * These delegate to provider-specific implementations
 */

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
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getNutritionInsightsPrompt(startDate, endDate, lang, {
      context,
      provider: config.provider,
    });

    const finalUserMessage = userRemarks?.trim()
      ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
      : INSIGHTS_USER_MESSAGE;

    if (recentConversation?.length) {
      const text = await generateTextWithHistory(
        config,
        systemPrompt,
        recentConversation,
        finalUserMessage,
        stream
      );
      return text || null;
    }

    const text = await generateText(config, systemPrompt, finalUserMessage, stream);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getNutritionInsights error:', error);
    return null;
  }
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
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;
    const includeFoundationFoods = providerConfig.enableFoundationFoods
      ? await SettingsService.getSendFoundationFoodsToLlm()
      : false;
    const systemPrompt = await getGenerateMealPlanPrompt(
      lang,
      macroTargets,
      undefined,
      context,
      includeFoundationFoods
    );

    const userMessage =
      history.map((e) => `${e.role === 'user' ? 'User' : 'Coach'}: ${e.content}`).join('\n\n') +
      '\n\nGenerate the meal plan.';

    const fns = getGenerateMealPlanFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<GenerateMealPlanResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'generateMealPlan',
      'planning'
    );
    return parsed ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    reportAiError(error, 'coachAI.generateMealPlan');
    return null;
  }
}

/**
 * Generate a workout plan from conversation history
 */
export async function generateWorkoutPlan(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  context: 'nutrition' | 'exercise' | 'general' = 'exercise'
): Promise<GenerateWorkoutPlanResponse | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await createWorkoutPlanPrompt(lang, undefined, context);
    const instruction =
      history.length > 0
        ? i18n.t('coach.aiInstructions.generateWorkoutPlanWithHistory', { lng: lang })
        : i18n.t('coach.aiInstructions.generateWorkoutPlanDefault', { lng: lang });

    const userMessage =
      history.length > 0
        ? history.map((e) => `${e.role === 'user' ? 'User' : 'Coach'}: ${e.content}`).join('\n\n') +
          '\n\n' +
          instruction
        : instruction;

    const fns = getGenerateWorkoutPlanFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<GenerateWorkoutPlanResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'generateWorkoutPlan',
      'planning'
    );
    return parsed ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    reportAiError(error, 'coachAI.generateWorkoutPlan');
    return null;
  }
}

/**
 * Calculate next workout volume based on performance
 */
export async function calculateNextWorkoutVolume(
  config: CoachAIConfig,
  workoutTitle: string,
  completedWorkoutData: any
): Promise<CalculateVolumeResponse | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getCalculateNextWorkoutVolumePrompt(workoutTitle, lang);
    const userMessage =
      typeof completedWorkoutData === 'string'
        ? completedWorkoutData
        : JSON.stringify(completedWorkoutData ?? {}, null, 2);
    const fns = getCalculateNextWorkoutVolumeFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<CalculateVolumeResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'calculateNextWorkoutVolume',
      'planning'
    );
    return parsed ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] calculateNextWorkoutVolume error:', error);
    return null;
  }
}

/**
 * Get insights about an upcoming workout
 */
export async function getWorkoutInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getWorkoutInsightsPrompt(workoutTitle, lang, {
      provider: config.provider,
    });
    const text = await generateText(config, systemPrompt);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getWorkoutInsights error:', error);
    return null;
  }
}

/**
 * Get feedback on a recently completed workout (by workout log id).
 */
export async function getRecentWorkoutInsights(
  config: CoachAIConfig,
  workoutLogId: string,
  stream?: CoachStream
): Promise<string | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getRecentWorkoutInsightsPromptByLogId(workoutLogId, lang, {
      provider: config.provider,
    });
    const text = await generateText(config, systemPrompt, undefined, stream);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getRecentWorkoutInsights error:', error);
    return null;
  }
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
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getRecentWorkoutsInsightsPrompt(startDate, endDate, lang, {
      context,
      provider: config.provider,
    });

    const finalUserMessage = userRemarks?.trim()
      ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
      : INSIGHTS_USER_MESSAGE;

    if (recentConversation?.length) {
      const text = await generateTextWithHistory(
        config,
        systemPrompt,
        recentConversation,
        finalUserMessage,
        stream
      );
      return text || null;
    }

    const text = await generateText(config, systemPrompt, finalUserMessage, stream);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getRecentWorkoutsInsights error:', error);
    return null;
  }
}

/**
 * Get volume trend analysis for a specific workout
 */
export async function getWorkoutVolumeInsights(
  config: CoachAIConfig,
  workoutTitle: string
): Promise<string | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getWorkoutVolumeInsightsPrompt(workoutTitle, lang, {
      provider: config.provider,
    });
    const text = await generateText(config, systemPrompt);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getWorkoutVolumeInsights error:', error);
    return null;
  }
}

/**
 * Optional context from the user to improve meal photo estimation (e.g. description + tags).
 */
export type MealPhotoContext = {
  description: string;
  tags: string[];
};

/**
 * Estimate nutrition from a meal photo.
 * Returns a TrackMealResponse with ingredients breakdown, similar to trackMeal.
 */
export async function estimateNutritionFromPhoto(
  config: CoachAIConfig,
  base64Image: string,
  context?: MealPhotoContext | null,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  if (config.provider === 'on-device') {
    // TODO: for now, on-device cant parse images
    return null;
  }

  try {
    reportMealProgress(onProgress, { step: 'reading', photo: true });
    const useThinkingMode = await SettingsService.getUseThinkingMode();
    if (useThinkingMode) {
      let thinkingUserMessage = 'Analyze this meal photo.';
      if (context?.description?.trim()) {
        thinkingUserMessage += `\nUser description: ${context.description.trim()}`;
      }

      if (context?.tags?.length) {
        thinkingUserMessage += `\nTags: ${context.tags.join(', ')}`;
      }

      return await trackMealVerified(config, thinkingUserMessage, base64Image, onProgress);
    }

    const customPrompts = await getActiveCustomPrompts();
    const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;
    const includeFoundationFoods = providerConfig.enableFoundationFoods
      ? await SettingsService.getSendFoundationFoodsToLlm()
      : false;

    const baseSystemPrompt = await getMealAnalysisPrompt(includeFoundationFoods);
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;

    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    // Use getTrackMealFunctions to get an array of meals with ingredients breakdown
    const fns = getTrackMealFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    let userMessageSuffix: string | undefined;
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }

      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }

      userMessageSuffix = parts.join('\n');
    }

    const parsed = await generateWithImageStructured<TrackMealResponse>(
      config,
      systemPrompt,
      base64,
      mimeType,
      schema,
      'trackMeal',
      userMessageSuffix
    );

    // Foundation-food matches arrive with zero macros: the lookup fills the real values in, and an
    // id the database does not have is estimated in a follow-up request instead of logged at 0 kcal.
    return parsed?.meals ? await refineTrackedMeals(config, parsed, onProgress) : (parsed ?? null);
  } catch (error) {
    notifyUserFacingAiError(error);
    reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
    return null;
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
  try {
    const customPrompts = await getActiveCustomPrompts();
    const baseSystemPrompt = getExtractMacrosFromLabelPrompt();
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;
    const base64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const fns = getEstimateMacrosFunctions(true);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    let userMessageSuffix: string | undefined;
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }

      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }

      userMessageSuffix = parts.join('\n');
    }

    const parsed = await generateWithImageStructured<MacroEstimate>(
      config,
      systemPrompt,
      base64,
      mimeType,
      schema,
      'estimateMacros',
      userMessageSuffix
    );
    return parsed ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] extractMacrosFromLabelPhoto error:', error);
    return null;
  }
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
  try {
    const hasContext = context && (context.description.trim() || context.tags.length > 0);
    if (!ocrText.trim() && !hasContext) {
      return null;
    }

    const customPrompts = await getActiveCustomPrompts();
    const baseSystemPrompt = getExtractMacrosFromLabelTextPrompt();
    const systemPrompt = customPrompts
      ? `${baseSystemPrompt}\n\n${customPrompts}`
      : baseSystemPrompt;
    const fns = getEstimateMacrosFunctions(true);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    let userMessage = ocrText.trim() || 'No text extracted from the label.';
    if (context && (context.description.trim() || context.tags.length > 0)) {
      const parts: string[] = [];
      if (context.description.trim()) {
        parts.push(`User description: ${context.description.trim()}`);
      }

      if (context.tags.length > 0) {
        parts.push(`Tags: ${context.tags.join(', ')}`);
      }

      userMessage += '\n\n' + parts.join('\n');
    }

    const parsed = await generateStructured<MacroEstimate>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'estimateMacros'
    );

    return parsed ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] extractMacrosFromLabelText error:', error);
    return null;
  }
}

/**
 * Parse past workouts from natural language
 */
export async function parsePastWorkouts(
  config: CoachAIConfig,
  userMessage: string,
  exerciseNames: string[]
): Promise<ParsedWorkout[] | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getParsePastWorkoutsPrompt(userMessage, exerciseNames, lang);
    const fns = getParsePastWorkoutsFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastWorkouts: ParsedWorkout[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseWorkouts', { lng: lang }),
      schema,
      'parsePastWorkouts'
    );
    return parsed?.pastWorkouts ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] parsePastWorkouts error:', error);
    return null;
  }
}

/**
 * Parse past nutrition from natural language
 */
export async function parsePastNutrition(
  config: CoachAIConfig,
  userMessage: string
): Promise<ParsedNutrition[] | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getParsePastNutritionPrompt(userMessage, lang);
    const fns = getParsePastNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ pastNutrition: ParsedNutrition[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseNutrition', { lng: lang }),
      schema,
      'parsePastNutrition'
    );
    return parsed?.pastNutrition ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] parsePastNutrition error:', error);
    return null;
  }
}

/**
 * Parse nutrition from a natural language description of a past day
 */
export async function parseRetrospectiveNutrition(
  config: CoachAIConfig,
  userMessage: string,
  targetDate: string
): Promise<NutritionEntry[] | null> {
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getRetrospectiveNutritionPrompt(targetDate, userMessage, lang);
    const fns = getParseRetrospectiveNutritionFunctions();
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
    const parsed = await generateStructured<{ nutritionEntries: NutritionEntry[] }>(
      config,
      systemPrompt,
      i18n.t('coach.aiInstructions.parseRetrospectiveNutrition', { lng: lang }),
      schema,
      'parseRetrospectiveNutrition'
    );

    return parsed?.nutritionEntries ?? null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] parseRetrospectiveNutrition error:', error);
    return null;
  }
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
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getMealCritiquePrompt(mealType, foods, totals, lang, {
      context: 'nutrition',
      provider: config.provider,
    });
    const finalUserMessage = userRemarks?.trim()
      ? userRemarks.trim()
      : 'Please critique this meal.';
    const text = await generateText(config, systemPrompt, finalUserMessage, stream);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getMealCritique error:', error);
    return null;
  }
}
