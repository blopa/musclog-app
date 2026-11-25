import { randomUUID } from 'expo-crypto';

import { type AiEffort, type ReasoningEffortValue, reasoningEffortValue } from './aiEffort';
import type { CoachAIConfig, CoachAIProvider } from './coachAI';
import {
  hostedGrantError,
  isRetryableHostedError,
  noteHostedError,
  toHostedAiError,
} from './hostedAiError';
import type { RetryDecision, RetryState } from './llmRetryTypes';
import { setHostedSignal } from './premium/hostedSignal';
import { whileHostedBackingOff } from './premium/hostedWait';

/** Repetition penalties for a free-chat reply, in the OpenAI field names. */
export type ChatPenalties = { frequency_penalty: number; presence_penalty: number };

/**
 * Everything one provider does differently around a request, so the shared retry loop and the
 * request builders carry no `provider === 'x'` branch. Only providers with their own rules have an
 * entry in `PROVIDER_POLICIES`; every other provider gets none and follows the shared rules.
 */
export type ProviderPolicy = {
  /** Headers of one logical request, built once and sent on every attempt (an idempotency key). */
  requestHeaders?: (config: CoachAIConfig) => Record<string, string>;
  /** Throws before anything is sent when the config can never answer. */
  assertUsable?: (config: CoachAIConfig) => void;
  /**
   * Decides what a failed attempt means, or `null` when the failure is not this provider's own and
   * the shared rules apply.
   */
  classifyFailure?: (
    operation: string,
    error: unknown,
    state: RetryState,
    options: { hasStreamed: boolean; delayMs: number | undefined }
  ) => RetryDecision | null;
  onSuccess?: () => void;
  /** Wraps the wait before a retry. */
  backOff?: (wait: () => Promise<void>) => Promise<void>;
  /**
   * False when a failure this policy's `classifyFailure` did not claim (a dropped connection, a
   * 408 or a bare 5xx the Worker did not answer) is thrown instead of retried by the shared rules.
   * Defaults to true. A provider SDK's own retries are off for every provider (`withLlmRetry` is the
   * one retry loop), so this is the only place a provider opts out of the shared transient retries.
   */
  retriesTransientFailures?: boolean;
  /**
   * The `reasoning_effort` this provider's requests carry for a job's effort, or undefined to send
   * none. Only providers that take the field have it: a local server, the free tier and any model
   * that might reject it send nothing.
   */
  reasoningEffort?: (effort: AiEffort) => Promise<ReasoningEffortValue | undefined>;
  /**
   * Sampling fields added to a free-chat reply only (never to structured extraction, where a
   * repetition penalty would fight the repeated keys and numbers of a JSON answer).
   */
  chatSampling?: ChatPenalties;
  /** The most turns of history a free-chat reply is sent, for a model that copies its own replies. */
  maxChatHistoryTurns?: number;
  /**
   * A finished-workout card goes into the chat history as one line, never as the full session JSON.
   * The JSON took most of a small model's history budget, and a model that copies what it sees
   * started answering in JSON. The session is still in its own prompt's recent-workouts block.
   */
  compactWorkoutCards?: boolean;
  /**
   * The free-chat reply is never drafted and reviewed (the Tokenmaxxing chat review), at any
   * thinking level: one request answers. A small model cannot follow the review checklist; a 450M
   * model answered it with "I'm Loggy.", with a copy of an earlier reply, or with the checklist
   * itself ("1. Facts: ..."), and the review's output is what the person reads.
   */
  skipsChatReview?: boolean;
  /**
   * What happens to a structured reply from this provider. Absent: it is used as it came (the free
   * tier, whose schema cannot be relied on but whose replies were never repaired, and Apple's engine,
   * whose guided generation the OS enforces).
   * - `enforced`: the provider's server enforces the schema, so a reply that stopped at the token
   *   limit is a failure to report, never something to patch with the JSON repair ladder
   *   (`jsonrepair` would close the braces and return a half-empty object as an answer).
   * - `repaired`: nothing on the provider's side enforces the schema (a small local model), so a
   *   reply is shape-checked here and, when malformed or missing the schema, gets one repair call.
   */
  structuredReplies?: 'enforced' | 'repaired';
  /**
   * A reply that parsed but missed part of the schema is kept when the repair does not do better,
   * because callers of an OpenAI-compatible endpoint have always tolerated a partial answer. The
   * downloaded model is held to its schema instead, so it does not set this.
   */
  keepsPartialStructuredReply?: boolean;
  /**
   * A small model invents detail when asked to describe a meal before estimating it, so the first
   * look of the highest thinking level is never made for it.
   */
  skipsMealFirstLook?: boolean;
  /**
   * Missing ingredients are asked for as a nutrition label per 100 g by name (one request), scaled
   * and made consistent in code, instead of as a full estimate a tiny model cannot make.
   */
  estimatesFoodsFromLabels?: boolean;
  /**
   * This engine has no retry layer that classifies its failures, so a structured request that fails
   * (other than a cancel or "not ready") is reported and read as "no answer" instead of thrown.
   */
  structuredFailureIsNoAnswer?: boolean;
  /**
   * One engine answers one request at a time (the on-device model, a local server), so the samples
   * of a job run one after another instead of queueing behind each other or fighting for memory.
   */
  runsSamplesSequentially?: boolean;
  /**
   * This provider's own photo step, in place of the default one every provider gets (the detail the
   * person chose in AI settings, with no provider limit above it).
   */
  prepareImage?: (
    base64: string,
    mimeType: string,
    /** How many photos the request carries, so they can share its size budget. */
    count?: number
  ) => Promise<{ base64: string; mimeType: string }>;
};

/**
 * Musclog Iron. A hosted request carries one idempotency key for every attempt, so the Worker
 * recognises a retry, and it retries only the statuses the Worker says are safe (never a 503 that
 * must not be repeated: `daily_full`, `hosted_disabled`). A failure the Worker did not answer is not
 * handed to the shared transient rules.
 */
const HOSTED_POLICY: ProviderPolicy = {
  requestHeaders: (config) => ({
    'Idempotency-Key': randomUUID(),
    ...(config.hostedConsentVersion === undefined
      ? {}
      : { 'X-Musclog-Consent-Version': String(config.hostedConsentVersion) }),
  }),
  assertUsable: (config) => {
    // A session token that could not be minted sends nothing: the typed error says why.
    if (config.hostedGrantFailure) {
      const grantError = hostedGrantError(config.hostedGrantFailure);
      noteHostedError(grantError);
      throw grantError;
    }
  },
  classifyFailure: (operation, error, state, { hasStreamed, delayMs }) => {
    const hosted = toHostedAiError(error);
    if (!hosted) {
      return null;
    }

    noteHostedError(hosted);
    if (!isRetryableHostedError(hosted) || hasStreamed || delayMs === undefined) {
      return { error: hosted };
    }

    return {
      delayMs,
      spends: 'attempt',
      log: `[coachAI] ${operation} hosted ${hosted.hostedKind}; retrying in ${delayMs}ms with the same idempotency key`,
    };
  },
  onSuccess: () => setHostedSignal('ok'),
  backOff: (wait) => whileHostedBackingOff(wait),
  retriesTransientFailures: false,
  structuredReplies: 'enforced',
  // The Worker keeps its own ceiling per feature and clamps what is asked, but an older Worker has no
  // such field and answers an unknown one with a 400. So the app sends it only once `/v1/config`
  // (cached for five minutes) says this Worker takes it, and never lets a config problem block a request.
  reasoningEffort: async (effort) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const premium: typeof import('@/services/premium/premiumService') = require('@/services/premium/premiumService');
      const result = await premium.fetchPremiumConfig();

      return result.ok && result.value.reasoningEffort ? reasoningEffortValue(effort) : undefined;
    } catch {
      return undefined;
    }
  },
  // Holds the person's chosen detail to the Worker's limits and refuses photos while the Worker has
  // them off. Loaded inline because it reads the Worker's config, which text requests never need (the
  // pattern of services/premium/revenueCat.ts).
  prepareImage: (base64, mimeType, count) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hostedImage: typeof import('@/utils/hostedImage') = require('@/utils/hostedImage');

    return hostedImage.prepareHostedImage(base64, mimeType, count);
  },
};

/** OpenAI itself takes the field on every model it lists (`OPENAI_MODELS`). */
const OPENAI_POLICY: ProviderPolicy = {
  reasoningEffort: async (effort) => reasoningEffortValue(effort),
  structuredReplies: 'enforced',
};

/** Gemini and Claude enforce the schema server-side and say why a reply stopped. */
const GEMINI_POLICY: ProviderPolicy = { structuredReplies: 'enforced' };
const CLAUDE_POLICY: ProviderPolicy = { structuredReplies: 'enforced' };

/**
 * A small model: a custom local server or the downloaded on-device one. Left alone it copies its own
 * earlier replies, so a one-word follow-up ("ok", "thanks") gets the previous answer back, over and
 * over. A repetition penalty and a short history break that. Nothing enforces its schema either, so
 * its structured replies are checked and repaired here.
 */
const SMALL_MODEL_POLICY: ProviderPolicy = {
  chatSampling: { frequency_penalty: 0.4, presence_penalty: 0.4 },
  maxChatHistoryTurns: 6,
  compactWorkoutCards: true,
  structuredReplies: 'repaired',
  runsSamplesSequentially: true,
};

/** What both on-device engines share beyond being small: the meal pipeline is shorter for them. */
const ON_DEVICE_CAPABILITIES: ProviderPolicy = {
  skipsMealFirstLook: true,
  estimatesFoodsFromLabels: true,
  structuredFailureIsNoAnswer: true,
  skipsChatReview: true,
};

/** The downloaded model: the small-model rules, and its schema is a hard requirement. */
const GGUF_ON_DEVICE_POLICY: ProviderPolicy = { ...SMALL_MODEL_POLICY, ...ON_DEVICE_CAPABILITIES };

/**
 * A custom local server: the small-model rules, but a partial structured answer has always been
 * accepted from it.
 */
const LOCAL_SERVER_POLICY: ProviderPolicy = {
  ...SMALL_MODEL_POLICY,
  keepsPartialStructuredReply: true,
};

/**
 * Apple's on-device model: the same short history, but its engine takes no sampling fields and the
 * OS enforces its guided generation.
 */
const APPLE_ON_DEVICE_POLICY: ProviderPolicy = {
  maxChatHistoryTurns: SMALL_MODEL_POLICY.maxChatHistoryTurns,
  compactWorkoutCards: SMALL_MODEL_POLICY.compactWorkoutCards,
  runsSamplesSequentially: true,
  ...ON_DEVICE_CAPABILITIES,
};

const PROVIDER_POLICIES: Partial<Record<CoachAIProvider, ProviderPolicy>> = {
  hosted: HOSTED_POLICY,
  openai: OPENAI_POLICY,
  gemini: GEMINI_POLICY,
  claude: CLAUDE_POLICY,
  local: LOCAL_SERVER_POLICY,
};

/**
 * The rules of the provider (and, on-device, the engine) behind a config, or an empty policy when
 * it follows the shared ones.
 */
export function providerPolicyFor(
  config: Pick<CoachAIConfig, 'provider' | 'engine'>
): ProviderPolicy {
  if (config.provider === 'on-device') {
    return config.engine === 'gguf' ? GGUF_ON_DEVICE_POLICY : APPLE_ON_DEVICE_POLICY;
  }

  return PROVIDER_POLICIES[config.provider] ?? {};
}
