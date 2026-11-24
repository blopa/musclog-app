import Anthropic from '@anthropic-ai/sdk';
import { Content, Part } from '@google/genai';
import OpenAI from 'openai';

import { MUSCLOG_GATEWAY_MAX_TOKENS, MUSCLOG_GATEWAY_PROVIDER } from '@/constants/gateway';
import { SETTINGS } from '@/constants/settingDefinitions';
import { DebugDumpService } from '@/database/services/DebugDumpService';
import { FoodService } from '@/database/services/FoodService';
import { NutritionService } from '@/database/services/NutritionService';
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
import { reviewAndRevise, runSamples } from './aiPasses';
import {
  effectiveThinkingLevel,
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
import { withGatewayProviderPin } from './gatewayRouting';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from './gemini';
import { handleError } from './handleError';
import { readJsonStringField } from './jsonStringFieldStream';
import { withLlmRetry } from './llmRetry';
import { extractLlmUsage, type LlmUsage, mergeLlmUsage, recordLlmUsage } from './llmUsage';
import {
  buildPhotoMeal,
  type FoodCandidate,
  limitFoodCandidates,
  type IdentifiedFood,
  LOCAL_FOOD_IDENTIFY_SCHEMA,
  LOCAL_PHOTO_RETRY_TEMPERATURE,
  localFoodIdentifyPrompt,
  mealTypeForHour,
  mergeFoodsAcrossPhotos,
  parseIdentifiedFoods,
  pickFoodMatch,
  searchTermsFor,
  voteIdentifiedFoods,
} from './localFoodPhoto';
import {
  checkStructuredShape,
  jsonRepairMessage,
  jsonRepairPrompt,
  parseStructuredJson,
  stripStreamingTemplateTokens,
  stripTemplateTokens,
  type StructuredResult,
} from './localReplyShape';
import { consensusMeals } from './mealConsensus';
import { type MealEstimateProgressListener } from './mealEstimateProgress';
import { MAX_MEAL_IMAGES, type MealImage, toMealImage, toMealImages } from './mealImages';
import {
  formatMealObservation,
  type MealObservation,
  parseMealObservation,
} from './mealObservation';
import { formatMealPhotoContext, type MealPhotoContext } from './mealPhotoContext';
import { ingredientMacroProblems, reconcileIngredientMacros } from './mealPlausibility';
import { applyMealReview, type MealReview } from './mealReview';
import { ungroundedFigures } from './numberGrounding';
import { sendOnDeviceMessage, sendOnDeviceStructured, streamOnDeviceMessage } from './onDeviceAi';
import { ON_DEVICE_CONTEXT_CHARS, type OnDeviceEngine } from './onDeviceEngine';
import { sendLocalMessage, sendLocalStructuredRaw, streamLocalMessage } from './onDeviceLocal';
import {
  fromLabelPer100g,
  isFiberTracked,
  medianLabel,
  type OnDeviceLabel,
  withLabelFiber,
} from './onDeviceMacros';
import { mealPlanFindings, workoutPlanFindings, workoutVolumeFindings } from './planFindings';
import {
  createWorkoutPlanPrompt,
  getActiveCustomPrompts,
  getCalculateNextWorkoutVolumeFunctions,
  getCalculateNextWorkoutVolumePrompt,
  getChatMessagePromptContent,
  getChatReviewInstruction,
  getEstimateMacrosFunctions,
  getEstimateMissingIngredientsFunctions,
  getExtractionArbiterMessage,
  getExtractMacrosFromLabelPrompt,
  getExtractMacrosFromLabelTextPrompt,
  getGenerateMealPlanFunctions,
  getGenerateMealPlanPrompt,
  getGenerateWorkoutPlanFunctions,
  getInsightFactCheckMessage,
  getMealAnalysisPrompt,
  getMealCritiquePrompt,
  getMealObservationFunctions,
  getMealObservationPrompt,
  getMealReviewFunctions,
  getMealReviewPrompt,
  getMissingIngredientsMacrosPrompt,
  getMultiPhotoMealNote,
  getNutritionInsightsPrompt,
  getOnDeviceFiberFunctions,
  getOnDeviceFiberPrompt,
  getOnDeviceLabelFunctions,
  getOnDeviceLabelPrompt,
  getOnDeviceLabelUserMessage,
  getParsePastNutritionFunctions,
  getParsePastNutritionPrompt,
  getParsePastWorkoutsFunctions,
  getParsePastWorkoutsPrompt,
  getParseRetrospectiveNutritionFunctions,
  getPlanReviewMessage,
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
import { type ChatPenalties, providerPolicyFor } from './providerPolicy';

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
  /** `on-device` only: which engine answers. Absent means Apple's system model. */
  engine?: OnDeviceEngine;
  /** `on-device` only: the engine can read a food photo (the downloaded model with its projector). */
  vision?: boolean;
  /** Set by daily background tasks, so their thinking level is capped (`effectiveThinkingLevel`). */
  background?: boolean;
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
      effort: claudeEffort(await resolveEffort(config, options.task)),
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
  const client = buildClaudeClient(config.apiKey, 0);
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
        effort: await resolveEffort(config, 'chat'),
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

  const truncatedHistory = truncateHistoryByBudget(
    latestChatTurns(history, config),
    providerConfig.maxCharBudget
  );
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
    ...providerPolicyFor(config).chatSampling,
    ...(await openAiReasoning(config, await resolveEffort(config, 'chat'))),
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
/**
 * The apologies `failedCoachReply` answers with in place of a reply. Kept apart from the type, so a
 * review round can tell a failed draft or review from a real answer without a field that would be
 * saved with the message.
 */
const FAILED_COACH_REPLIES = new WeakSet<CoachResponse>();

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

  const apology: CoachResponse = {
    msg4User: i18n.t('errors.aiProcessingError'),
    sumMsg: i18n.t('errors.aiProcessingErrorTitle'),
  };
  FAILED_COACH_REPLIES.add(apology);

  return apology;
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

/** Which engine an `on-device` config runs; Apple's system model unless the config says otherwise. */
function onDeviceEngineOf(config: CoachAIConfig): OnDeviceEngine {
  return config.engine ?? 'apple';
}

/** The context budget of the engine behind an `on-device` config. */
function onDeviceBudget(config: CoachAIConfig): number {
  return ON_DEVICE_CONTEXT_CHARS[onDeviceEngineOf(config)];
}

/**
 * One plain-text generation on the on-device engine. The downloaded model goes through
 * `withLlmRetry` (idle timeout, cancel, never retried once text is on screen); Apple's system
 * model keeps its own path.
 */
async function runOnDeviceText(
  config: CoachAIConfig,
  operation: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string | undefined,
  sink: StreamSink | null,
  penalties?: ChatPenalties
): Promise<string> {
  if (onDeviceEngineOf(config) === 'gguf') {
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
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const sink = stream ? createStreamSink(stream, 'plain') : null;
  try {
    const systemPrompt = await getChatMessagePromptContent(
      config.language,
      undefined,
      context,
      'on-device'
    );

    // The same two rules as a custom local server: only the latest turns, and (on the downloaded
    // model) a repetition penalty, so a one-word follow-up does not get the last answer back.
    const truncatedHistory = truncateHistoryByBudget(
      latestChatTurns(history, config),
      onDeviceBudget(config) - userMessage.length
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

    return {
      msg4User: raw || i18n.t('errors.aiProcessingError'),
      sumMsg: raw?.slice(0, 120) ?? '',
    };
  } catch (error) {
    return failedCoachReply(error, config, 'sendViaOnDevice', sink);
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

async function generateText(
  config: CoachAIConfig,
  systemPrompt: string,
  userMessage: string = INSIGHTS_USER_MESSAGE,
  stream?: CoachStream,
  task: AiTask = 'insight'
): Promise<string> {
  const lang = config.language ?? DEFAULT_LANG;

  return generateTextWithHistory(
    config,
    `${systemPrompt}\n\nRespond in the following language/locale: ${lang}.`,
    [],
    userMessage,
    stream,
    task,
    'generateText'
  );
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
  task: AiTask = 'insight',
  operation = 'generateTextWithHistory'
): Promise<string> {
  // Chat-template tokens a model leaks (`<|im_start|>assistant …`) are removed here, once, whichever
  // provider wrote the text.
  return stripTemplateTokens(
    await requestPlainText(
      config,
      operation,
      systemPrompt,
      recentConversation,
      finalUserMessage,
      stream,
      task
    )
  );
}

/** One plain-text reply from the configured provider, as it came back. */
async function requestPlainText(
  config: CoachAIConfig,
  operation: string,
  systemPrompt: string,
  recentConversation: ChatHistoryEntry[],
  finalUserMessage: string,
  stream: CoachStream | undefined,
  task: AiTask
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
      operation,
      payload: requestPayload,
      config,
    });

    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        generationConfig: buildGeminiGenerationConfig(config.model, {
          effort: await resolveEffort(config, task),
          json: false,
        }),
      },
      [{ text: systemPrompt } as Part]
    );
    if (stream) {
      const streamedRaw = await streamGeminiText(
        genModel,
        contents,
        operation,
        config,
        createStreamSink(stream, 'plain')
      );
      await logLlmDebugEvent({
        provider: config.provider,
        direction: 'response',
        operation,
        payload: { text: streamedRaw },
        config,
      });

      return streamedRaw;
    }

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

    const raw = extractRawText(result);
    return raw ?? '';
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
      operation,
      params,
      stream ? createStreamSink(stream, 'plain') : null
    );

    return raw;
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
    ...(await openAiReasoning(config, await resolveEffort(config, task))),
  };

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'request',
    operation,
    payload: requestPayload,
    config,
  });

  if (stream) {
    const streamedRaw = await streamOpenAiText(
      client,
      requestPayload,
      operation,
      config,
      createStreamSink(stream, 'plain')
    );
    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation,
      payload: { text: streamedRaw },
      config,
    });

    return streamedRaw;
  }

  const completion = await createOpenAiCompletion(client, operation, config, requestPayload);

  await logLlmDebugEvent({
    provider: config.provider,
    direction: 'response',
    operation,
    payload: completion,
    config,
  });

  return completion.choices[0]?.message?.content ?? '';
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
  /** Each provider takes the schema in a slightly different dialect. */
  buildSchema: (dialect: StructuredDialect) => object;
  /** What kind of job this is, which decides how hard the model reasons. Defaults to extraction. */
  task?: AiTask;
};

/**
 * Last resort for a local model's structured reply: one text-only structured request that is asked to
 * correct the broken reply against the schema, sent through the same funnel and shape check. It runs
 * only after the parser, `jsonrepair` and the schema check all failed, so a good reply never pays for
 * it. A failure of the repair call leaves the original failure; only a cancel is rethrown.
 */
async function repairStructuredWithModel<T>(
  config: CoachAIConfig,
  operation: string,
  broken: string,
  schema: object
): Promise<StructuredResult<T> | null> {
  if (!broken.trim()) {
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

    return null;
  }
}

/**
 * The shared finish for a structured reply from a provider that does not enforce its schema
 * (`repairsStructuredReplies`): a reply that is malformed or misses the schema gets one repair call.
 * A reply that parsed but missed part of the schema is kept when the repair does not do better,
 * because callers of an OpenAI-compatible endpoint have always tolerated a partial answer.
 */
async function reviveLocalStructured<T>(
  config: CoachAIConfig,
  operation: string,
  result: StructuredResult<T>,
  schema: object
): Promise<StructuredResult<T>> {
  if (!providerPolicyFor(config).repairsStructuredReplies) {
    return result;
  }

  const checked = checkStructuredShape(result, schema, operation);
  if (checked.kind === 'ok') {
    return checked;
  }

  const repaired = await repairStructuredWithModel<T>(config, operation, checked.raw, schema);
  if (repaired?.kind === 'ok') {
    return repaired;
  }

  return result.kind === 'ok' ? result : checked;
}

/** The schema dialect a structured request to this provider (and on-device, engine) is written in. */
function structuredDialect(config: CoachAIConfig): StructuredDialect {
  switch (config.provider) {
    case 'on-device':
      return onDeviceEngineOf(config) === 'gguf' ? 'gguf' : 'on-device';
    case 'gemini':
    case 'claude':
      return config.provider;
    default:
      return 'openai';
  }
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

/** One structured request, with the schema already built in `structuredDialect(config)`. */
async function requestStructuredOnce<T = unknown>(
  config: CoachAIConfig,
  request: StructuredRequest,
  schema: object
): Promise<StructuredResult<T>> {
  const { operation, schemaName, systemPrompt, history, userMessage } = request;
  const task = request.task ?? 'extraction';

  if (config.provider === 'on-device') {
    const engine = onDeviceEngineOf(config);
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
      const raw = await withLlmRetry(operation, config, (signal) =>
        sendLocalStructuredRaw(messages, systemPrompt, schema, { signal })
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

    // Apple's guided generation is enforced by the OS; the downloaded model's grammar is enforced
    // by a runtime we do not control, so its answer is checked before anything reads it.
    return engine === 'gguf' ? checkStructuredShape(result, schema, operation) : result;
  }

  if (config.provider === 'gemini') {
    const genModel = await configureBasicGenAI(
      {
        apiKey: config.apiKey,
        model: config.model,
        // How hard it thinks follows the kind of job (`utils/aiEffort.ts`); the user's thinking-mode
        // setting is the explicit way to ask for more.
        generationConfig: buildGeminiGenerationConfig(config.model, {
          responseSchema: schema,
          effort: await resolveEffort(config, task),
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
      { task, schema }
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
    ...(await openAiReasoning(config, await resolveEffort(config, task))),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema: makeSchemaStrict(schema),
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
    if (
      config.provider !== 'on-device' ||
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
  task: AiTask = 'extraction'
): Promise<T | null> {
  return generateWithImagesStructured<T>(
    config,
    systemPrompt,
    [{ base64: rawBase64Image, mimeType: rawMimeType }],
    schema,
    schemaName,
    userMessageSuffix,
    task
  );
}

/**
 * The single funnel for every provider's photo request, for one photo or several of the same meal.
 * Every provider gets the photos at the detail the person chose in AI settings. Musclog Iron has
 * its own step: it also holds the photos to the Worker's limits, and refuses them while the Worker
 * has photos off. `options.prepared` says the photos were already prepared by `prepareMealImages`.
 */
async function generateWithImagesStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  rawImages: readonly MealImage[],
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string,
  task: AiTask = 'extraction',
  options?: { prepared?: boolean }
): Promise<T | null> {
  const images = options?.prepared ? [...rawImages] : await prepareMealImages(config, rawImages);

  // Wrap user message suffix with delimiters to prevent prompt injection
  const sanitizedSuffix = userMessageSuffix?.trim()
    ? wrapUserContent(userMessageSuffix.trim())
    : '';

  const userText =
    (images.length > 1
      ? 'Analyze these images and return the structured data.'
      : 'Analyze this image and return the structured data.') +
    (sanitizedSuffix ? `\n\n${sanitizedSuffix}` : '');

  if (config.provider === 'gemini') {
    const contents: Content[] = [
      {
        parts: [
          { text: userText } as Part,
          ...images.map(
            (image) =>
              ({
                inlineData: {
                  data: image.base64,
                  mimeType: image.mimeType,
                },
              }) as Part
          ),
        ],
        role: 'user',
      },
    ];
    const requestPayload = {
      model: config.model,
      contents,
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
          effort: await resolveEffort(config, task),
        }),
      },
      [{ text: systemPrompt } as Part]
    );

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

    const read = parseStructuredJson<T>(raw);
    return read.kind === 'ok' ? read.value : null;
  }

  if (config.provider === 'claude') {
    const params = await buildClaudeParams(
      config,
      systemPrompt,
      [
        {
          role: 'user',
          content: [
            ...images.map((image) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: claudeImageType(image.mimeType),
                data: image.base64,
              },
            })),
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
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          ...images.map((image) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
          })),
        ],
      },
    ],
    ...(await openAiReasoning(config, await resolveEffort(config, task))),
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

  // The same ladder as every structured reply (fences, JSON inside text, `jsonrepair`), and for a
  // custom local server one repair call by the model.
  const read = await reviveLocalStructured(
    config,
    'generateWithImageStructured',
    parseStructuredJson<T>(raw),
    strictSchema
  );

  return read.kind === 'ok' ? read.value : null;
}

async function extractRecipe(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = [],
  observation?: MealObservation
): Promise<RecipeExtractionResponse | null> {
  const lang = config.language ?? DEFAULT_LANG;
  const providerConfig = PROVIDER_CONFIGS[config.provider] ?? PROVIDER_CONFIGS.openai;
  const includeFoundationFoods = providerConfig.enableFoundationFoods
    ? await SettingsService.getSendFoundationFoodsToLlm()
    : false;
  const systemPrompt = await getRecipeExtractionPrompt(includeFoundationFoods, lang);
  const fns = getRecipeExtractionFunctions(includeFoundationFoods);
  const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);
  // A first look is notes for the request, never a replacement for the photo or description.
  const message = observation
    ? `${userMessage}\n\n${formatMealObservation(observation)}`
    : userMessage;

  if (images.length > 0) {
    if (config.provider === 'on-device') {
      // Downloaded models identify photos through estimateNutritionFromPhoto.
      return null;
    }

    return generateWithImagesStructured<RecipeExtractionResponse>(
      config,
      systemPrompt,
      images,
      schema,
      'extractRecipe',
      message,
      'extraction',
      { prepared: true }
    );
  }

  return generateStructured<RecipeExtractionResponse>(
    config,
    systemPrompt,
    message,
    schema,
    'extractRecipe'
  );
}

/**
 * One structured "first look" at a meal (Tokenmaxxing): what is there, how big it looks, what fat,
 * sauce or drink is visible or likely, and what is unsure. No grams and no macros, so seeing stays
 * apart from estimating. A reply that cannot be read is no look (null), never a failed estimate.
 */
async function observeMeal(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = []
): Promise<MealObservation | null> {
  const systemPrompt = getMealObservationPrompt(config.language ?? DEFAULT_LANG);
  const schema = getSchemaFromFunctionDeclaration((getMealObservationFunctions() as any)[0]);

  if (images.length > 0) {
    const raw = await generateWithImagesStructured<unknown>(
      config,
      systemPrompt,
      images,
      schema,
      'observeMeal',
      userMessage,
      'extraction',
      { prepared: true }
    );

    return parseMealObservation(raw);
  }

  return parseMealObservation(
    await generateStructured<unknown>(config, systemPrompt, userMessage, schema, 'observeMeal')
  );
}

async function estimateMissingIngredients(
  config: CoachAIConfig,
  newIngredients: RecipeIngredient[],
  knownIngredients: TrackMealIngredient[],
  mealName: string
): Promise<MissingIngredientMacrosResponse | null> {
  if (config.provider === 'on-device') {
    return estimateMissingIngredientsOnDevice(config, newIngredients);
  }

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

/**
 * The on-device model is asked for a label per 100 g by name (one request); the figures are scaled
 * and made consistent in code. With fiber tracked, one more request asks for fiber per 100 g
 * (never failing the estimate).
 */
async function estimateMissingIngredientsOnDevice(
  config: CoachAIConfig,
  newIngredients: RecipeIngredient[]
): Promise<MissingIngredientMacrosResponse | null> {
  const names = newIngredients.map(({ name }) => name);
  const labelFns = getOnDeviceLabelFunctions();

  const askForLabels = () =>
    generateStructured<{ foods: OnDeviceLabel[] }>(
      config,
      getOnDeviceLabelPrompt(names),
      getOnDeviceLabelUserMessage(),
      getSchemaFromFunctionDeclaration((labelFns as any)[0]),
      'estimateMissingIngredients'
    );
  // From High up each label is asked for more than once and every figure is the median.
  const readings = extractionSamples(await thinkingLevelFor(config));
  const replies =
    readings <= 1
      ? [await askForLabels()].filter((reply) => reply != null)
      : await runSamples(config, readings, askForLabels);
  if (replies.length === 0) {
    return null;
  }

  let computed = newIngredients.flatMap((target, index) => {
    const label = medianLabel(
      replies.flatMap((reply) => {
        const found = estimateFor(target, index, newIngredients.length, reply.foods ?? []);
        return found ? [found] : [];
      })
    );

    return label ? [fromLabelPer100g({ ...label, name: target.name }, target.grams)] : [];
  });
  if (computed.length === 0) {
    return { ingredients: [] };
  }

  if (isFiberTracked(await SettingsService.getNutritionDisplay())) {
    try {
      const fiberFns = getOnDeviceFiberFunctions();
      const fiberReply = await generateStructured<{ foods: { name: string; fiber: number }[] }>(
        config,
        getOnDeviceFiberPrompt(computed.map(({ name }) => name)),
        getOnDeviceLabelUserMessage(),
        getSchemaFromFunctionDeclaration((fiberFns as any)[0]),
        'estimateFiber'
      );
      const replies = fiberReply?.foods ?? [];
      computed = computed.map((ingredient, index) => {
        const reply = estimateFor(ingredient, index, computed.length, replies);

        return reply ? withLabelFiber(ingredient, reply.fiber) : ingredient;
      });
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      reportAiError(error, 'coachAI.estimateOnDeviceFiber');
    }
  }

  return { ingredients: computed };
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
function estimateFor<T extends { name: string }>(
  target: { name: string },
  index: number,
  count: number,
  estimates: T[]
): T | undefined {
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
 * estimate replaces the original only when it has fewer problems. Whatever is still implausible
 * afterwards (the retry was as bad, found nothing or failed) goes through
 * `reconcileIngredientMacros`, so the figures shown never contradict each other; a failed
 * re-estimate is never a reason to fail the estimate.
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
        return reconcileIngredientMacros(ingredient);
      }

      const better = withEstimatedMacros(ingredient, estimate);
      return reconcileIngredientMacros(
        ingredientMacroProblems(better).length < ingredientMacroProblems(ingredient).length
          ? better
          : ingredient
      );
    });
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, 'coachAI.recheckImplausibleIngredients');
    return ingredients.map((ingredient) =>
      suspects.includes(ingredient) ? reconcileIngredientMacros(ingredient) : ingredient
    );
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
 * The verified meal estimate, used from the Medium thinking level up: it separates what the model can
 * read (the recipe: meals, ingredients, grams, the foods of the person it recognises) from what it
 * must work out (the numbers of what is left), checking each claimed food id against the database
 * in between. Slower than one request, with more of the work done by code and less left to chance.
 */
async function trackMealVerified(
  config: CoachAIConfig,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener,
  observation?: MealObservation
): Promise<TrackMealResponse | null> {
  const recipeResponse = await extractRecipe(config, userMessage, images, observation);
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
    const claimed = normalizedClaimed.filter((i) => i.foodId);
    // What the model named without a (confirmed) id is looked up by name in the person's own foods
    // before it is estimated, so a food they already have is never re-estimated.
    const byName = await matchIngredientsToOwnFoods([
      ...meal.ingredients.filter((i) => !i.foodId),
      ...normalizedClaimed.filter((i) => !i.foodId).map((i) => ({ name: i.name, grams: i.grams })),
    ]);
    const matched = [...claimed, ...byName.matched];
    const newIngredients = byName.unmatched;

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
 * The meal estimate of High and Tokenmaxxing. Samples of the verified path (Tokenmaxxing runs
 * several and code keeps what most of them agree on), then rounds of review: the model, shown the
 * estimate beside the description or photo, names what is missing or off, code applies it and
 * estimates what was added, and the result replaces the estimate only when it has no more
 * implausible figures than before. Medium is one sample and no review: the verified path itself.
 */
async function trackMealThinking(
  config: CoachAIConfig,
  level: ThinkingLevel,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  const pipeline = THINKING_PIPELINE[level];
  // The on-device model has no first look: a small model invents detail when asked to describe.
  const mealLooks = config.provider === 'on-device' ? null : pipeline.mealLooks;

  // Each first look is its own request, so a mistake in one never reaches every sample. A look that
  // fails or reads as nothing is left out; with none left the estimate goes on without looks (an
  // extra request can only help, never fail the estimate), and a cancel stops everything.
  let looks: MealObservation[] = [];
  if (mealLooks) {
    reportMealProgress(onProgress, {
      step: 'observing',
      photo: images.length > 0,
      photoCount: images.length,
    });
    try {
      looks = await runSamples(config, mealLooks.looks, () =>
        observeMeal(config, userMessage, images)
      );
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      reportAiError(error, 'coachAI.observeMeal');
    }
  }

  // With looks: `samplesPerLook` samples per look, sample `i` reading look `floor(i / perLook)`, and
  // `lookOf` remembers which look each ANSWERED sample read (`runSamples` leaves failed ones out).
  const perLook = mealLooks?.samplesPerLook ?? 1;
  const total = looks.length > 0 ? looks.length * perLook : pipeline.samples;
  const lookOf: number[] = [];
  // Only the first sample reports its steps: several samples at once would interleave their lines.
  const samples = await runSamples(config, total, async (index) => {
    const look = looks.length > 0 ? Math.floor(index / perLook) : -1;
    const answer = await trackMealVerified(
      config,
      userMessage,
      images,
      index === 0 ? onProgress : undefined,
      look >= 0 ? looks[look] : undefined
    );
    if (answer) {
      lookOf[index] = look;
    }

    return answer;
  });
  if (samples.length === 0) {
    return null;
  }

  let draft = samples[0];
  if (samples.length > 1) {
    reportMealProgress(onProgress, { step: 'comparing', count: samples.length });
    // `lookOf` is indexed by request, so keep the entries of the samples that answered, in order.
    const answeredLooks = lookOf.filter((look) => look !== undefined);
    draft = consensusMeals(samples, looks.length > 1 ? answeredLooks : undefined);
  }

  if (pipeline.reviewRounds === 0) {
    return draft;
  }

  return reviewAndRevise<TrackMealResponse>({
    draft,
    rounds: pipeline.reviewRounds,
    critique: async (current) => {
      reportMealProgress(onProgress, { step: 'reviewing' });
      const meals: TrackedMeal[] = [];
      for (const meal of current.meals) {
        meals.push(await reviewTrackedMeal(config, meal, userMessage, images, onProgress));
      }

      return { ...current, meals };
    },
    accept: (current, revised) => countMealProblems(revised) <= countMealProblems(current),
    onError: (error) => reportAiError(error, 'coachAI.reviewTrackedMeal'),
  });
}

function countMealProblems(response: TrackMealResponse): number {
  return response.meals.reduce(
    (total, meal) =>
      total +
      meal.ingredients
        .filter((ingredient) => !ingredient.foodId)
        .reduce((sum, ingredient) => sum + ingredientMacroProblems(ingredient).length, 0),
    0
  );
}

async function requestMealReview(
  config: CoachAIConfig,
  meal: TrackedMeal,
  userMessage: string,
  images: readonly MealImage[] = []
): Promise<MealReview | null> {
  const systemPrompt = getMealReviewPrompt(meal, config.language ?? DEFAULT_LANG);
  const schema = getSchemaFromFunctionDeclaration((getMealReviewFunctions() as any)[0]);

  if (images.length > 0 && config.provider !== 'on-device') {
    return generateWithImagesStructured<MealReview>(
      config,
      systemPrompt,
      images,
      schema,
      'reviewMealEstimate',
      userMessage,
      'extraction',
      { prepared: true }
    );
  }

  return generateStructured<MealReview>(
    config,
    systemPrompt,
    userMessage,
    schema,
    'reviewMealEstimate'
  );
}

async function reviewTrackedMeal(
  config: CoachAIConfig,
  meal: TrackedMeal,
  userMessage: string,
  images: readonly MealImage[] = [],
  onProgress?: MealEstimateProgressListener
): Promise<TrackedMeal> {
  const review = await requestMealReview(config, meal, userMessage, images);
  const { meal: corrected, added } = applyMealReview(meal, review);
  if (added.length === 0) {
    return corrected;
  }

  const mealName = corrected.mealName ?? corrected.mealType;
  // An addition the person already has a food for is taken from it, not estimated.
  const { matched: addedFromOwnFoods, unmatched: addedToEstimate } =
    await matchIngredientsToOwnFoods(added);
  let estimates: MissingIngredientMacrosResponse['ingredients'] = [];
  if (addedToEstimate.length > 0) {
    const estimated = await estimateMissingIngredients(
      config,
      addedToEstimate,
      [...corrected.ingredients.filter((ingredient) => ingredient.foodId), ...addedFromOwnFoods],
      mealName
    );
    estimates = estimated?.ingredients ?? [];
  }

  const additions = [
    ...addedFromOwnFoods,
    ...addedToEstimate.flatMap((item, index) => {
      const estimate = estimateFor(item, index, addedToEstimate.length, estimates);

      return estimate
        ? [
            withEstimatedMacros(
              { name: item.name, grams: item.grams, kcal: 0, protein: 0, carbs: 0, fat: 0 },
              estimate
            ),
          ]
        : [];
    }),
  ];
  if (additions.length === 0) {
    return corrected;
  }

  const normalized = await NutritionService.normalizeAiMealIngredients([
    ...corrected.ingredients,
    ...additions,
  ]);

  return {
    ...corrected,
    ingredients: await recheckImplausibleIngredients(config, mealName, normalized, onProgress),
  };
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
  if (config.provider === 'on-device' && base64Image) {
    return estimateNutritionFromPhoto(
      config,
      base64Image,
      { description: userMessage, tags: [] },
      onProgress
    );
  }

  try {
    reportMealProgress(onProgress, { step: 'reading', photo: Boolean(base64Image) });
    // One photo of the chat, prepared once for every request that follows.
    const images = base64Image ? await prepareMealImages(config, [toMealImage(base64Image)]) : [];
    const level = await thinkingLevelFor(config);
    if (THINKING_PIPELINE[level].verifiedMeal) {
      return await trackMealThinking(config, level, userMessage, images, onProgress);
    }

    const lang = config.language ?? DEFAULT_LANG;
    const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;
    const includeFoundationFoods = providerConfig.enableFoundationFoods
      ? await SettingsService.getSendFoundationFoodsToLlm()
      : false;
    const systemPrompt = await getMealAnalysisPrompt(includeFoundationFoods, lang);
    const fns = getTrackMealFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    if (images.length > 0) {
      const fromPhoto = await generateWithImagesStructured<TrackMealResponse>(
        config,
        systemPrompt,
        images,
        schema,
        'trackMeal',
        userMessage,
        'extraction',
        { prepared: true }
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
  const onDevice = config.provider === 'on-device';
  let sendHistory = history;
  let sendText = text;

  if (!onDevice) {
    // Every user turn carries the time it was sent, the newest also how long the pause was.
    const tagged = tagTurnsWithTime(history, text, Date.now());
    sendHistory = tagged.history;
    sendText = tagged.userMessage;
  }

  const dispatch = (message: string, target?: CoachStream): Promise<CoachResponse> => {
    if (onDevice) {
      return sendViaOnDevice(config, sendHistory, message, context, target);
    }

    if (config.provider === 'gemini') {
      return sendViaGemini(config, sendHistory, message, context, target);
    }

    if (config.provider === 'claude') {
      return sendViaClaude(config, sendHistory, message, context, target);
    }

    // OpenAI, local (custom base URL), gateway (the free tier, via OpenRouter) and hosted all speak
    // the OpenAI-compatible protocol.
    return sendViaOpenAI(config, sendHistory, message, context, target);
  };

  const level = await thinkingLevelFor(config);

  if (!THINKING_PIPELINE[level].chatReview) {
    return dispatch(sendText, stream);
  }

  return draftAndReviewCoachReply(config, sendText, dispatch, stream);
}

/**
 * The highest thinking level answers twice: the first reply is drafted unseen, then a review
 * request, with the same system prompt and history, checks it against the history and the app data
 * and writes the final reply, which is the one streamed. A failing review (not a cancel) keeps the
 * draft.
 */
async function draftAndReviewCoachReply(
  config: CoachAIConfig,
  message: string,
  dispatch: (message: string, target?: CoachStream) => Promise<CoachResponse>,
  stream?: CoachStream
): Promise<CoachResponse> {
  stream?.onPhase?.('reviewing');
  const draft = await dispatch(message);

  // A draft that failed is the apology a single request would have given: nothing to review.
  if (FAILED_COACH_REPLIES.has(draft) || !draft.msg4User.trim()) {
    return draft;
  }

  try {
    const instruction = getChatReviewInstruction(
      config.language ?? DEFAULT_LANG,
      message,
      draft.msg4User
    );
    const reviewed = await dispatch(instruction, stream);

    if (FAILED_COACH_REPLIES.has(reviewed) || !reviewed.msg4User.trim()) {
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
  const ask = (message: string, target?: CoachStream) =>
    recentConversation?.length
      ? generateTextWithHistory(config, systemPrompt, recentConversation, message, target)
      : generateText(config, systemPrompt, message, target);
  const rounds = THINKING_PIPELINE[await thinkingLevelFor(config)].reviewRounds;
  if (rounds === 0) {
    return ask(userMessage, stream);
  }

  stream?.onPhase?.('reviewing');
  const draft = await ask(userMessage);
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
      ask(
        getInsightFactCheckMessage(
          userMessage,
          current,
          ungroundedFigures(current, data),
          round > 0
        )
      ),
    accept: (current, revised) =>
      revised.trim() !== '' &&
      ungroundedFigures(revised, data).length <= ungroundedFigures(current, data).length,
    onError: (error) => reportAiError(error, 'coachAI.factCheckInsight'),
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
  request: (extra?: string) => Promise<T | null | undefined>,
  findingsOf: (answer: T) => string[]
): Promise<T | null> {
  const draft = await request();
  if (draft == null) {
    return null;
  }

  const rounds = THINKING_PIPELINE[await thinkingLevelFor(config)].reviewRounds;
  if (rounds === 0) {
    return draft;
  }

  return reviewAndRevise<T>({
    draft,
    rounds,
    critique: (current) => request(getPlanReviewMessage(current, findingsOf(current))),
    accept: (current, revised) => findingsOf(revised).length <= findingsOf(current).length,
    onError: (error) => reportAiError(error, 'coachAI.reviewPlan'),
  });
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
  try {
    const lang = config.language ?? DEFAULT_LANG;
    const systemPrompt = await getNutritionInsightsPrompt(startDate, endDate, lang, {
      context,
      provider: config.provider,
    });

    const finalUserMessage = userRemarks?.trim()
      ? `User's remarks before analysis: ${userRemarks.trim()}\n\nProvide your analysis.`
      : INSIGHTS_USER_MESSAGE;

    const text = await generateInsight(
      config,
      systemPrompt,
      finalUserMessage,
      recentConversation,
      stream
    );
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
    return await generatePlan<GenerateMealPlanResponse>(
      config,
      (extra) =>
        generateStructured<GenerateMealPlanResponse>(
          config,
          systemPrompt,
          withExtra(userMessage, extra),
          schema,
          'generateMealPlan',
          'planning'
        ),
      (plan) => mealPlanFindings(plan, macroTargets)
    );
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
    return await generatePlan<GenerateWorkoutPlanResponse>(
      config,
      (extra) =>
        generateStructured<GenerateWorkoutPlanResponse>(
          config,
          systemPrompt,
          withExtra(userMessage, extra),
          schema,
          'generateWorkoutPlan',
          'planning'
        ),
      workoutPlanFindings
    );
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
    return await generatePlan<CalculateVolumeResponse>(
      config,
      (extra) =>
        generateStructured<CalculateVolumeResponse>(
          config,
          systemPrompt,
          withExtra(userMessage, extra),
          schema,
          'calculateNextWorkoutVolume',
          'planning'
        ),
      workoutVolumeFindings
    );
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
    const text = await generateInsight(config, systemPrompt, INSIGHTS_USER_MESSAGE);
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
    const text = await generateInsight(
      config,
      systemPrompt,
      INSIGHTS_USER_MESSAGE,
      undefined,
      stream
    );
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

    const text = await generateInsight(
      config,
      systemPrompt,
      finalUserMessage,
      recentConversation,
      stream
    );
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
    const text = await generateInsight(config, systemPrompt, INSIGHTS_USER_MESSAGE);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getWorkoutVolumeInsights error:', error);
    return null;
  }
}

export type { MealPhotoContext };

/**
 * Foods this phone already has whose names share a word with `name`, merged and deduplicated and
 * capped at `MAX_FOOD_CANDIDATES` (best candidates first, so the cap never changes the match). A food
 * whose numbers are per serving is left out: a match is scaled by grams from per-100 g numbers.
 */
async function candidateFoodsFor(name: string): Promise<FoodCandidate[]> {
  const byId = new Map<string, FoodCandidate>();
  for (const term of searchTermsFor(name)) {
    for (const food of await FoodService.searchFoods(term)) {
      if (food.nutritionBasis === 'per_serving') {
        continue;
      }

      byId.set(food.id, {
        id: food.id,
        name: food.name,
        kcal: food.calories ?? 0,
        protein: food.protein ?? 0,
        carbs: food.carbs ?? 0,
        fat: food.fat ?? 0,
        fiber: food.fiber ?? 0,
      });
    }
  }

  return limitFoodCandidates(name, [...byId.values()]);
}

/**
 * Ingredients with no food id, looked up BY NAME in the foods this phone has (the person's own,
 * saved and foundation foods), whichever provider made the estimate: a model sees at most 200
 * foundation foods and a local server none, so the ids it claims miss almost everything the person
 * actually eats. A match (`pickFoodMatch`: every significant word, the fewest extra words, a tie is
 * no match) keeps the model's name and grams and takes that food's own numbers scaled to the grams;
 * everything else is returned unchanged for the estimate request. The model's wording is kept so the
 * person reads their own language. Best effort: a failed lookup leaves every ingredient unmatched,
 * which only costs the estimate it would have saved.
 */
async function matchIngredientsToOwnFoods(
  ingredients: readonly { name: string; grams: number }[]
): Promise<{
  matched: TrackMealIngredient[];
  unmatched: { name: string; grams: number }[];
}> {
  const stubs: TrackMealIngredient[] = [];
  const unmatched: { name: string; grams: number }[] = [];

  try {
    for (const { name, grams } of ingredients) {
      const match = pickFoodMatch(name, await candidateFoodsFor(name));
      if (match) {
        stubs.push({ name, grams, foodId: match.id, kcal: 0, protein: 0, carbs: 0, fat: 0 });
      } else {
        unmatched.push({ name, grams });
      }
    }

    if (stubs.length === 0) {
      return { matched: [], unmatched };
    }

    const normalized = await NutritionService.normalizeAiMealIngredients(stubs);
    const matched = normalized.filter((ingredient) => ingredient.foodId);
    // An id the lookup dropped (the food vanished meanwhile) goes back to the estimate.
    for (const ingredient of normalized.filter((item) => !item.foodId)) {
      unmatched.push({ name: ingredient.name, grams: ingredient.grams });
    }

    return { matched, unmatched };
  } catch (error) {
    reportAiError(error, 'coachAI.matchIngredientsToOwnFoods');

    return {
      matched: [],
      unmatched: ingredients.map(({ name, grams }) => ({ name, grams })),
    };
  }
}

/**
 * Reads a meal photo with the downloaded on-device model: it names what it sees and guesses grams
 * (grammar-constrained, never asked for calories), the names are matched to foods this phone has,
 * and anything unmatched is estimated by name through the same follow-up the cloud path uses.
 * Returns null when nothing recognisable is in the photo; the review screen takes it from there.
 */
async function estimateMealFromPhotoOnDevice(
  config: CoachAIConfig,
  rawImages: readonly MealImage[],
  context?: MealPhotoContext | null,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  reportMealProgress(onProgress, { step: 'reading', photo: true, photoCount: rawImages.length });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiImage: typeof import('@/utils/aiImage') = require('@/utils/aiImage');
  // The engine takes one image per request, so every photo is prepared (and later read) alone.
  const images: MealImage[] = [];
  for (const raw of rawImages) {
    images.push(await aiImage.prepareOnDeviceImage(raw.base64, raw.mimeType));
  }

  const systemPrompt = localFoodIdentifyPrompt();
  const formattedContext = formatMealPhotoContext(context);
  const details = formattedContext ? wrapUserContent(formattedContext) : '';
  const messages = [
    {
      role: 'user' as const,
      content: details
        ? `What foods are in this photo?\nMeal notes: ${details}`
        : 'What foods are in this photo?',
    },
  ];
  await logLlmDebugEvent({
    provider: 'on-device',
    direction: 'request',
    operation: 'estimateNutritionFromPhoto',
    payload: { systemPrompt, messages, schema: LOCAL_FOOD_IDENTIFY_SCHEMA },
    config,
  });

  const askForPhoto = (image: MealImage, temperature?: number) =>
    withLlmRetry('estimateNutritionFromPhoto', config, (signal) =>
      sendLocalStructuredRaw(messages, systemPrompt, LOCAL_FOOD_IDENTIFY_SCHEMA, {
        image: `data:${image.mimeType};base64,${image.base64}`,
        signal,
        ...(temperature === undefined ? {} : { temperature }),
      })
    );

  const readPhotoReply = (text: string) =>
    checkStructuredShape(
      parseStructuredJson<unknown>(text),
      LOCAL_FOOD_IDENTIFY_SCHEMA,
      'estimateNutritionFromPhoto'
    );

  // One reading of the photo. `firstTemperature` lets a further sample differ from the first.
  const identifyFoods = async (
    image: MealImage,
    firstTemperature?: number
  ): Promise<IdentifiedFood[]> => {
    let raw = await askForPhoto(image, firstTemperature);
    let parsed = readPhotoReply(raw);
    if (parsed.kind !== 'ok') {
      // Syntax is the grammar's job and the schema check is ours; a reply that fails both gets one
      // warmer second try (temperature 0 would repeat itself) before the person is told it failed.
      const firstRaw = raw;
      raw = await askForPhoto(image, LOCAL_PHOTO_RETRY_TEMPERATURE);
      parsed = readPhotoReply(raw);

      // Last resort before giving up: one text-only call that is asked to correct the broken reply
      // (no photo, so the projector stays unloaded), read by the same parser and schema check. It
      // only ever runs after both photo attempts failed, so a good run never pays for it.
      const broken = [raw, firstRaw].find((text) => text.trim() !== '');
      if (parsed.kind !== 'ok' && broken) {
        const repaired = await repairStructuredWithModel<unknown>(
          config,
          'estimateNutritionFromPhoto',
          broken,
          LOCAL_FOOD_IDENTIFY_SCHEMA
        );
        if (repaired?.kind === 'ok') {
          parsed = repaired;
        }
      }
    }

    return parsed.kind === 'ok' ? parseIdentifiedFoods(parsed.value) : [];
  };

  // From High up the photo is read more than once, one reading after another (the phone has one
  // engine), and a food stays only when at least half the readings name it.
  const readings = extractionSamples(await thinkingLevelFor(config));
  const identifyPhoto = async (image: MealImage): Promise<IdentifiedFood[]> =>
    readings <= 1
      ? identifyFoods(image)
      : voteIdentifiedFoods(
          await runSamples(config, readings, async (index) => {
            const found = await identifyFoods(
              image,
              index === 0 ? undefined : LOCAL_PHOTO_RETRY_TEMPERATURE
            );
            return found.length > 0 ? found : null;
          })
        );

  // Each photo is read on its own, one after another (the phone has one engine), and the lists are
  // merged in code: a food in several photos is one food, at its largest estimated portion. A photo
  // that fails is left out; only when none was readable does the estimate fail (a cancel stops all).
  const perPhoto: IdentifiedFood[][] = [];
  let failure: unknown;
  for (const [index, image] of images.entries()) {
    if (images.length > 1) {
      reportMealProgress(onProgress, {
        step: 'identifying',
        index: index + 1,
        count: images.length,
      });
    }

    try {
      perPhoto.push(await identifyPhoto(image));
    } catch (error) {
      if (error instanceof AiCancelledError || images.length === 1) {
        throw error;
      }

      failure ??= error;
      reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
    }
  }

  const foods = mergeFoodsAcrossPhotos(perPhoto);
  if (foods.length === 0 && failure && perPhoto.length === 0) {
    throw failure;
  }

  if (foods.length === 0) {
    return null;
  }

  const matches = new Map<string, FoodCandidate | null>();
  for (const food of foods) {
    matches.set(food.name, pickFoodMatch(food.name, await candidateFoodsFor(food.name)));
  }

  const hour = new Date().getHours();
  const meal = buildPhotoMeal(foods, matches, mealTypeForHour(hour));
  return refineTrackedMeals(config, meal, onProgress);
}

/**
 * Estimate nutrition from a meal photo.
 * Returns a TrackMealResponse with ingredients breakdown, similar to trackMeal.
 */
export async function estimateNutritionFromPhoto(
  config: CoachAIConfig,
  photos: string | readonly string[],
  context?: MealPhotoContext | null,
  onProgress?: MealEstimateProgressListener
): Promise<TrackMealResponse | null> {
  // One photo or up to `MAX_MEAL_IMAGES` of the same meal, as data URLs or bare base64.
  const rawImages = toMealImages(photos).slice(0, MAX_MEAL_IMAGES);
  if (rawImages.length === 0) {
    return null;
  }

  const photoCount = rawImages.length;
  if (config.provider === 'on-device') {
    if (onDeviceEngineOf(config) !== 'gguf') {
      throw new OnDeviceUnavailableError('photosUnsupported');
    }

    if (!config.vision) {
      throw new OnDeviceUnavailableError('photosNotInstalled');
    }

    try {
      return await estimateMealFromPhotoOnDevice(config, rawImages, context, onProgress);
    } catch (error) {
      reportAiError(error, 'coachAI.estimateNutritionFromPhoto');
      throw error;
    }
  }

  try {
    reportMealProgress(onProgress, { step: 'reading', photo: true, photoCount });
    // Prepared once: every look, sample and review below reuses these, never re-encodes them.
    const images = await prepareMealImages(config, rawImages);
    const multiPhotoNote = getMultiPhotoMealNote(photoCount);
    const contextText = formatMealPhotoContext(context);
    const level = await thinkingLevelFor(config);
    if (THINKING_PIPELINE[level].verifiedMeal) {
      const thinkingUserMessage = [
        photoCount > 1 ? 'Analyze these meal photos.' : 'Analyze this meal photo.',
        multiPhotoNote,
        contextText,
      ]
        .filter(Boolean)
        .join('\n');

      return await trackMealThinking(config, level, thinkingUserMessage, images, onProgress);
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

    // Use getTrackMealFunctions to get an array of meals with ingredients breakdown
    const fns = getTrackMealFunctions(includeFoundationFoods);
    const schema = getSchemaFromFunctionDeclaration((fns as any)[0]);

    const userMessageSuffix = [multiPhotoNote, contextText].filter(Boolean).join('\n') || undefined;

    const parsed = await generateWithImagesStructured<TrackMealResponse>(
      config,
      systemPrompt,
      images,
      schema,
      'trackMeal',
      userMessageSuffix,
      'extraction',
      { prepared: true }
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
 * One extraction (a label, past workouts, a food log) at the person's thinking level. Off and
 * Medium make the single request they always made; High reads the input twice and Tokenmaxxing
 * three times (`extractionSamples`), and code combines the readings field by field
 * (`combineExtractions`). Only when they disagree is one more request made: the same request with
 * the readings and the disputed fields appended, whose answer is used when it parses. A failed
 * arbiter keeps the combined readings; a cancel stops everything.
 */
async function extractWithConsensus<T>(
  config: CoachAIConfig,
  request: (extra?: string) => Promise<T | null | undefined>
): Promise<T | null> {
  const samples = extractionSamples(await thinkingLevelFor(config));
  if (samples <= 1) {
    return (await request()) ?? null;
  }

  const readings = await runSamples(config, samples, () => request());
  if (readings.length <= 1) {
    return readings[0] ?? null;
  }

  const { value, disputed } = combineExtractions(readings);
  if (disputed.length === 0) {
    return value as T;
  }

  try {
    return (await request(getExtractionArbiterMessage(readings, disputed))) ?? (value as T);
  } catch (error) {
    if (error instanceof AiCancelledError) {
      throw error;
    }

    reportAiError(error, 'coachAI.arbitrateExtraction');
    return value as T;
  }
}

/** The user message with an arbiter's note appended, when there is one. */
function withExtra(message: string, extra?: string): string {
  return extra ? `${message}\n\n${extra}` : message;
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

    return await extractWithConsensus<MacroEstimate>(config, (extra) =>
      generateWithImageStructured<MacroEstimate>(
        config,
        systemPrompt,
        base64,
        mimeType,
        schema,
        'estimateMacros',
        extra ? withExtra(userMessageSuffix ?? '', extra).trim() : userMessageSuffix
      )
    );
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

    return await extractWithConsensus<MacroEstimate>(config, (extra) =>
      generateStructured<MacroEstimate>(
        config,
        systemPrompt,
        withExtra(userMessage, extra),
        schema,
        'estimateMacros'
      )
    );
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
    const parsed = await extractWithConsensus<{ pastWorkouts: ParsedWorkout[] }>(config, (extra) =>
      generateStructured<{ pastWorkouts: ParsedWorkout[] }>(
        config,
        systemPrompt,
        withExtra(i18n.t('coach.aiInstructions.parseWorkouts', { lng: lang }), extra),
        schema,
        'parsePastWorkouts'
      )
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
    const parsed = await extractWithConsensus<{ pastNutrition: ParsedNutrition[] }>(
      config,
      (extra) =>
        generateStructured<{ pastNutrition: ParsedNutrition[] }>(
          config,
          systemPrompt,
          withExtra(i18n.t('coach.aiInstructions.parseNutrition', { lng: lang }), extra),
          schema,
          'parsePastNutrition'
        )
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
    const parsed = await extractWithConsensus<{ nutritionEntries: NutritionEntry[] }>(
      config,
      (extra) =>
        generateStructured<{ nutritionEntries: NutritionEntry[] }>(
          config,
          systemPrompt,
          withExtra(
            i18n.t('coach.aiInstructions.parseRetrospectiveNutrition', { lng: lang }),
            extra
          ),
          schema,
          'parseRetrospectiveNutrition'
        )
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
    const text = await generateInsight(config, systemPrompt, finalUserMessage, undefined, stream);
    return text || null;
  } catch (error) {
    notifyUserFacingAiError(error);
    console.error('[coachAI] getMealCritique error:', error);
    return null;
  }
}
