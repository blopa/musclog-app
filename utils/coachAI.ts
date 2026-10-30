import { Content, Part } from '@google/genai';
import OpenAI from 'openai';

import { DebugDumpService } from '@/database/services/DebugDumpService';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n, { DEFAULT_LANG } from '@/lang/lang';
import { isProduction } from '@/utils/app';

import { notifyUserFacingAiError } from './aiErrorNotice';
import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  rethrowUserFacingAiError,
  toUserFacingAiError,
} from './aiErrors';
import { buildGeminiGenerationConfig, configureBasicGenAI, extractGeminiText } from './gemini';
import { handleError } from './handleError';
import { readJsonStringField } from './jsonStringFieldStream';
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
import { wrapUserContent } from './promptSanitizer';

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
  if (error instanceof AiCreditsError) {
    return true;
  }

  const status = error?.status ?? error?.response?.status;
  const code = error?.error?.code ?? error?.code;
  const message = (error?.message ?? '').toLowerCase();
  if (status === 429) {
    return true;
  }

  if (code === 'insufficient_quota') {
    return true;
  }

  if (
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted') ||
    message.includes('billing')
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
  if (error instanceof OpenAI.APIConnectionError) {
    return true;
  }

  const message = String((error as any)?.message ?? '').toLowerCase();
  return message.startsWith('fetch failed:') || message === 'network request failed';
}

/**
 * A rate limit or exhausted quota is the provider refusing the request, not a Musclog bug: it is
 * reported to the user (see `AiCreditsError`) but must not reach Sentry, where every busy hour on a
 * shared key or the gateway's daily cap filed an unactionable `429 status code (no body)` event.
 * A dropped connection (`isAiConnectionError`) is likewise the user's network, not ours.
 */
export function reportAiError(error: unknown, context: string): void {
  handleError(error, context, {
    sendToSentry:
      !isAiCreditsError(error) &&
      !isAiConnectionError(error) &&
      // A rejected key, a timeout and a cancel are the user's configuration or network, not bugs.
      !(
        error instanceof AiInvalidKeyError ||
        error instanceof AiTimeoutError ||
        error instanceof AiCancelledError
      ),
  });
}

const RETRYABLE_LLM_STATUSES = new Set([429, 503, 529]);
const LLM_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

function getErrorStatus(error: any): number | undefined {
  return error?.status ?? error?.response?.status;
}

function getErrorCode(error: any): string {
  return String(error?.error?.code ?? error?.code ?? '').toLowerCase();
}

function getErrorMessage(error: any): string {
  return String(error?.message ?? '').toLowerCase();
}

function isQuotaStyleError(error: any): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === 'insufficient_quota') {
    return true;
  }

  return (
    message.includes('quota') ||
    message.includes('insufficient_quota') ||
    message.includes('resource_exhausted') ||
    message.includes('billing') ||
    message.includes('daily limit')
  );
}

function shouldRetryLlmError(error: any): boolean {
  const status = getErrorStatus(error);
  if (status === undefined || !RETRYABLE_LLM_STATUSES.has(status)) {
    return false;
  }

  if (status === 429 && isQuotaStyleError(error)) {
    return false;
  }

  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Image analysis uploads a photo and structured plans can think for a while: 60 s is generous but finite. */
const LLM_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Runs one request with a timeout and an optional caller cancel, handing the request an abort
 * signal. A timeout becomes `AiTimeoutError` and a cancel `AiCancelledError`, whatever the SDK
 * threw when it was aborted (each throws a different thing).
 *
 * The request also gets `touch()`. A streaming request calls it per chunk, which turns the timeout
 * into an idle timeout: a long answer that keeps flowing is never cut, a stalled one still is.
 */
async function runWithAbort<T>(
  config: CoachAIConfig,
  request: (signal: AbortSignal, touch: () => void) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS);
  };

  arm();
  const onExternalAbort = () => controller.abort();
  if (config.signal?.aborted) {
    controller.abort();
  } else {
    config.signal?.addEventListener('abort', onExternalAbort);
  }

  try {
    return await request(controller.signal, arm);
  } catch (error) {
    if (timedOut) {
      throw new AiTimeoutError();
    }

    if (config.signal?.aborted) {
      throw new AiCancelledError();
    }

    throw error;
  } finally {
    clearTimeout(timer);
    config.signal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Exported for tests; not part of the module's public surface. */
export async function withLlmRetry<T>(
  operation: string,
  config: CoachAIConfig,
  request: (signal: AbortSignal, touch: () => void) => Promise<T>,
  options?: {
    /**
     * True once a streaming request has shown text. A retry would restart the reply under the
     * user's eyes, so from then on a failure is thrown, not retried.
     */
    hasStreamed?: () => boolean;
  }
): Promise<T> {
  const provider = config.provider;
  let attempt = 0;
  let timeoutRetried = false;

  while (true) {
    try {
      return await runWithAbort(config, request);
    } catch (error) {
      if (error instanceof AiCancelledError) {
        throw error;
      }

      // A wrong key never gets better by asking again, and is not retried.
      const userFacing = toUserFacingAiError(error, provider);
      if (userFacing instanceof AiInvalidKeyError) {
        throw userFacing;
      }

      if (options?.hasStreamed?.()) {
        throw userFacing ?? error;
      }

      if (userFacing instanceof AiTimeoutError) {
        // A stalled request usually stays stalled: one more try, not three.
        if (timeoutRetried) {
          throw userFacing;
        }

        timeoutRetried = true;
        console.warn(`[coachAI] ${operation} timed out on ${provider}; retrying once`);
        continue;
      }

      if (attempt >= LLM_RETRY_DELAYS_MS.length || !shouldRetryLlmError(error)) {
        throw error;
      }

      const delayMs = LLM_RETRY_DELAYS_MS[attempt];
      const nextAttempt = attempt + 2;
      const status = getErrorStatus(error);

      console.warn(
        `[coachAI] ${operation} transient ${status ?? 'unknown'} from ${provider}; retrying in ${delayMs}ms (attempt ${nextAttempt}/${LLM_RETRY_DELAYS_MS.length + 1})`
      );

      attempt += 1;
      await sleep(delayMs);
    }
  }
}

export type CoachAIProvider = 'gemini' | 'openai' | 'on-device' | 'local' | 'gateway';

export interface ProviderConfig {
  maxCharBudget: number; // Maximum character budget for the total request context
  promptComplexity: 'minimal' | 'standard';
  enableContextInjection: boolean;
  enableFoundationFoods: boolean;
  enableMemories: boolean;
}

export const PROVIDER_CONFIGS: Record<CoachAIProvider, ProviderConfig> = {
  'on-device': {
    maxCharBudget: 4500, // Tight cap per Apple Intelligence optimization spec
    promptComplexity: 'minimal',
    enableContextInjection: true,
    enableFoundationFoods: false,
    enableMemories: false,
  },
  gemini: {
    maxCharBudget: 64000,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
  openai: {
    maxCharBudget: 64000,
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
    maxCharBudget: 64000,
    promptComplexity: 'standard',
    enableContextInjection: true,
    enableFoundationFoods: true,
    enableMemories: true,
  },
};

export type CoachAIConfig = {
  provider: CoachAIProvider;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  language?: string;
  gatewayByokAlias?: string;
  gatewayUserId?: string;
  /** Aborts the request when the caller cancels (a Cancel button). */
  signal?: AbortSignal;
  /** Overrides the default request timeout, in milliseconds. */
  timeoutMs?: number;
};

function buildOpenAIClient(config: CoachAIConfig): OpenAI {
  // In web dev mode, route gateway requests through a local CORS proxy —
  // Cloudflare AI Gateway doesn't return CORS headers for browser preflights.
  const devWebProxyFetch =
    !isProduction() && config.provider === 'gateway'
      ? (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(`http://localhost:8090?url=${encodeURIComponent(url.toString())}`, init)
      : undefined;

  return new OpenAI({
    apiKey: config.apiKey ?? 'unused',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
    defaultHeaders: config.gatewayByokAlias
      ? {
          'cf-aig-byok-alias': config.gatewayByokAlias,
          ...(config.gatewayUserId ? { 'cf-aig-user-id': config.gatewayUserId } : {}),
        }
      : undefined,
    fetch: devWebProxyFetch,
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

export type ChatHistoryEntry = {
  role: 'user' | 'coach';
  content: string;
};

export type CoachResponse = {
  msg4User: string;
  sumMsg: string;
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
      const chunks = await genModel.generateContentStream({ contents, abortSignal: signal });
      for await (const chunk of chunks) {
        touch();
        const { text } = extractGeminiText(chunk);
        if (text) {
          sink.onDelta(text);
        }
      }

      return sink.raw();
    },
    { hasStreamed: sink.hasEmitted }
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
    async (signal, touch) => {
      sink.reset();
      const chunks = await client.chat.completions.create({ ...payload, stream: true }, { signal });
      for await (const chunk of chunks) {
        touch();
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          sink.onDelta(delta);
        }
      }

      return sink.raw();
    },
    { hasStreamed: sink.hasEmitted }
  );
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

const LENGTH_SOFT_LIMIT = 50;

const baseSchemaProperties = {
  msg4User: {
    type: 'string',
    description: 'The full response to display to the user in the chat.',
  },
  sumMsg: {
    type: 'string',
    description:
      'A shortened version of msg4User trimmed to 1-2 sentences. Keep the same first-person voice and key points — write it as you would say it, not as a description of what you said.',
  },
};

const sumUserMsgProperty = {
  sumUserMsg: {
    type: 'string',
    description:
      "A shortened version of the user's message trimmed to 1 sentence. Keep their voice and key intent — write it as they would say it, not as a description of what they said.",
  },
};

const rememberMeProperty = {
  remember_me: {
    type: 'string',
    description: 'A short sentence with something important to remember about the user.',
  },
};

function buildResponseSchema(includeUserSummary: boolean) {
  const properties = {
    ...baseSchemaProperties,
    ...(includeUserSummary ? sumUserMsgProperty : {}),
    ...rememberMeProperty,
  };

  return {
    type: 'object',
    properties,
    required: includeUserSummary ? ['msg4User', 'sumMsg', 'sumUserMsg'] : ['msg4User', 'sumMsg'],
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
      sumMsg: parsed.sumMsg ?? raw,
      sumUserMsg: parsed.sumUserMsg ?? undefined,
      rememberMe: parsed.remember_me ?? undefined,
    };
  } catch {
    return { msg4User: raw, sumMsg: raw };
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

// --- Provider Implementations ---

async function sendViaGemini(
  config: CoachAIConfig,
  history: ChatHistoryEntry[],
  userMessage: string,
  context?: 'nutrition' | 'exercise' | 'general',
  stream?: CoachStream
): Promise<CoachResponse> {
  const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.gemini;
  const systemPrompt = await getChatMessagePromptContent(
    config.language,
    undefined,
    context,
    config.provider
  );
  const systemParts: Part[] = [{ text: systemPrompt }];
  const includeUserSummary = userMessage.length > LENGTH_SOFT_LIMIT;

  const truncatedHistory = truncateHistoryByBudget(history, providerConfig.maxCharBudget);
  // Gemini does not promise the schema's property order, and the reply is shown from the first
  // property while the rest is still being written.
  const responseSchema = {
    ...buildResponseSchema(includeUserSummary),
    propertyOrdering: [
      'msg4User',
      'sumMsg',
      ...(includeUserSummary ? ['sumUserMsg'] : []),
      'remember_me',
    ],
  };

  const genModel = await configureBasicGenAI(
    {
      apiKey: config.apiKey,
      model: config.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
      },
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
  const includeUserSummary = userMessage.length > LENGTH_SOFT_LIMIT;
  const providerConfig = PROVIDER_CONFIGS[config.provider] || PROVIDER_CONFIGS.openai;

  const systemPrompt = await getChatMessagePromptContent(
    config.language,
    undefined,
    context,
    config.provider
  );

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

  const schema = makeSchemaStrict(buildResponseSchema(includeUserSummary));
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages,
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

    const completion = await withLlmRetry('sendViaOpenAI', config, (signal) =>
      client.chat.completions.create(requestPayload, { signal })
    );

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'sendViaOpenAI',
      payload: completion,
      config,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    return parseCoachResponse(raw);
  } catch (error) {
    rethrowUserFacingAiError(error);
    // A reply that was already on screen is taken back by the caller; a friendly error message
    // saved as the coach's answer would sit next to half of the real one.
    if (sink?.hasEmitted()) {
      throw error;
    }

    await logLlmDebugEvent({
      provider: config.provider,
      direction: 'response',
      operation: 'sendViaOpenAI',
      payload: { error },
      config,
    });
    console.error('[coachAI] sendViaOpenAI error:', error);

    // Log detailed error for debugging but don't expose internals to user
    reportAiError(error, 'coachAI.sendViaOpenAI');

    if (isAiCreditsError(error)) {
      throw config.provider === 'gateway'
        ? new GatewayRateLimitError(i18n.t('errors.gatewayDailyLimitError'))
        : new AiCreditsError(i18n.t('errors.aiCreditsError'));
    }

    // Return a user-friendly error message without exposing internal details
    return {
      msg4User: i18n.t('errors.aiProcessingError'),
      sumMsg: i18n.t('errors.aiProcessingErrorTitle'),
    };
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
  stream?: CoachStream
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

  const client = buildOpenAIClient(config);
  const requestPayload: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.model,
    messages: [
      { role: 'system', content: promptWithLang },
      { role: 'user', content: sanitizedUserMessage },
    ],
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

  const completion = await withLlmRetry('generateText', config, (signal) =>
    client.chat.completions.create(requestPayload, { signal })
  );

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
  stream?: CoachStream
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

  const completion = await withLlmRetry('generateTextWithHistory', config, (signal) =>
    client.chat.completions.create(requestPayload, { signal })
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

export type StructuredDialect = 'openai' | 'gemini' | 'on-device';

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
 * model, Gemini, or an OpenAI-compatible endpoint. A reply that is not valid JSON comes back as
 * `malformed`; a provider failure is thrown as it happened, for the caller to classify.
 * `generateStructured` (one shot, null on bad output) and `sendStructuredChatTurn` (multi-turn,
 * typed errors) are both thin callers of this.
 */
export async function requestStructured<T = unknown>(
  config: CoachAIConfig,
  request: StructuredRequest
): Promise<StructuredResult<T>> {
  const { operation, schemaName, systemPrompt, history, userMessage } = request;

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
        // Structured extraction does not need a long chain of thought; the user's thinking-mode
        // setting is the explicit way to ask for it.
        generationConfig: buildGeminiGenerationConfig(config.model, {
          responseSchema: schema,
          thinking: (await SettingsService.getUseThinkingMode()) ? 'default' : 'low',
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

  const completion = await withLlmRetry(operation, config, (signal) =>
    client.chat.completions.create(payload, { signal })
  );
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
  schemaName: string = 'response'
): Promise<T | null> {
  const lang = config.language ?? DEFAULT_LANG;

  try {
    const result = await requestStructured<T>(config, {
      operation: 'generateStructured',
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

async function generateWithImageStructured<T>(
  config: CoachAIConfig,
  systemPrompt: string,
  base64Image: string,
  mimeType: string,
  schema: object,
  schemaName: string = 'response',
  userMessageSuffix?: string
): Promise<T | null> {
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
        // Structured extraction does not need a long chain of thought; the user's thinking-mode
        // setting is the explicit way to ask for it.
        generationConfig: buildGeminiGenerationConfig(config.model, {
          responseSchema: schema,
          thinking: (await SettingsService.getUseThinkingMode()) ? 'default' : 'low',
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

  const completion = await withLlmRetry('generateWithImageStructured', config, (signal) =>
    client.chat.completions.create(requestPayload, { signal })
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

async function trackMealWithThinking(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string
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
    meal.ingredients = await NutritionService.normalizeAiMealIngredients(meal.ingredients);
  }

  return { meals: resultMeals };
}

/**
 * Track a meal from description or base64 image
 */
export async function trackMeal(
  config: CoachAIConfig,
  userMessage: string,
  base64Image?: string
): Promise<TrackMealResponse | null> {
  try {
    const useThinkingMode = await SettingsService.getUseThinkingMode();
    if (useThinkingMode) {
      return await trackMealWithThinking(config, userMessage, base64Image);
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
      return await generateWithImageStructured<TrackMealResponse>(
        config,
        systemPrompt,
        base64,
        mimeType,
        schema,
        'trackMeal',
        userMessage
      );
    }

    return await generateStructured<TrackMealResponse>(
      config,
      systemPrompt,
      userMessage,
      schema,
      'trackMeal'
    );
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
  // Wrap user message with delimiters to prevent prompt injection attacks
  const sanitizedMessage = wrapUserContent(userMessage);

  if (config.provider === 'on-device') {
    return sendViaOnDevice(config, history, sanitizedMessage, context, stream);
  }

  if (config.provider === 'gemini') {
    return sendViaGemini(config, history, sanitizedMessage, context, stream);
  }

  // Local provider uses OpenAI-compatible API but with a custom base URL
  if (config.provider === 'local') {
    return sendViaOpenAI(config, history, sanitizedMessage, context, stream);
  }

  // Gateway uses OpenAI-compatible protocol via Cloudflare AI Gateway
  if (config.provider === 'gateway') {
    return sendViaOpenAI(config, history, sanitizedMessage, context, stream);
  }

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
      'generateMealPlan'
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
      'generateWorkoutPlan'
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
      'calculateNextWorkoutVolume'
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
  context?: MealPhotoContext | null
): Promise<TrackMealResponse | null> {
  if (config.provider === 'on-device') {
    // TODO: for now, on-device cant parse images
    return null;
  }

  try {
    const useThinkingMode = await SettingsService.getUseThinkingMode();
    if (useThinkingMode) {
      let thinkingUserMessage = 'Analyze this meal photo.';
      if (context?.description?.trim()) {
        thinkingUserMessage += `\nUser description: ${context.description.trim()}`;
      }

      if (context?.tags?.length) {
        thinkingUserMessage += `\nTags: ${context.tags.join(', ')}`;
      }

      return await trackMealWithThinking(config, thinkingUserMessage, base64Image);
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

    // Normalize ingredients if foundation foods were matched (foodId present with zero macros)
    if (parsed?.meals) {
      for (const meal of parsed.meals) {
        if (meal.ingredients) {
          meal.ingredients = await NutritionService.normalizeAiMealIngredients(meal.ingredients);
        }
      }
    }

    return parsed ?? null;
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
