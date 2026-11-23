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

/**
 * Everything one provider does differently around a request, so the shared retry loop and the
 * request builders carry no `provider === 'x'` branch. Only providers with their own rules have an
 * entry in `PROVIDER_POLICIES`; every other provider gets none and follows the shared rules.
 */
export type ProviderPolicy = {
  /** Headers of one logical request, built once and sent on every attempt (an idempotency key). */
  requestHeaders?: () => Record<string, string>;
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
  /** The OpenAI SDK's own retry count: 0 when this provider's retries are `withLlmRetry`'s alone. */
  sdkMaxRetries?: number;
  /**
   * The `reasoning_effort` this provider's requests carry for a job's effort, or undefined to send
   * none. Only providers that take the field have it: a local server, the free tier and any model
   * that might reject it send nothing.
   */
  reasoningEffort?: (effort: AiEffort) => Promise<ReasoningEffortValue | undefined>;
  /**
   * This provider's own photo step, in place of the default one every provider gets (the detail the
   * person chose in AI settings, with no provider limit above it).
   */
  prepareImage?: (
    base64: string,
    mimeType: string
  ) => Promise<{ base64: string; mimeType: string }>;
};

/**
 * Musclog Iron. A hosted request carries one idempotency key for every attempt, so the Worker
 * recognises a retry; it retries only the statuses the Worker says are safe; and its SDK retries are
 * off, since the SDK would repeat a 503 that must not be repeated (`daily_full`, `hosted_disabled`).
 */
const HOSTED_POLICY: ProviderPolicy = {
  requestHeaders: () => ({ 'Idempotency-Key': randomUUID() }),
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
  sdkMaxRetries: 0,
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
  prepareImage: (base64, mimeType) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const hostedImage: typeof import('@/utils/hostedImage') = require('@/utils/hostedImage');

    return hostedImage.prepareHostedImage(base64, mimeType);
  },
};

/** OpenAI itself takes the field on every model it lists (`OPENAI_MODELS`). */
const OPENAI_POLICY: ProviderPolicy = {
  reasoningEffort: async (effort) => reasoningEffortValue(effort),
};

const PROVIDER_POLICIES: Partial<Record<CoachAIProvider, ProviderPolicy>> = {
  hosted: HOSTED_POLICY,
  openai: OPENAI_POLICY,
};

/** The provider's own rules, or an empty policy when it follows the shared ones. */
export function providerPolicyFor(provider: CoachAIProvider): ProviderPolicy {
  return PROVIDER_POLICIES[provider] ?? {};
}
