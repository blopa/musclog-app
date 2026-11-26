import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  isAiConnectionError,
} from '@/utils/aiErrors';
import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';
import { AiCreditsError, GatewayRateLimitError, isAiCreditsError } from '@/utils/coachAI';
import { type HostedErrorKind, hostedErrorKindOf } from '@/utils/hostedAiError';

const HOSTED_KIND_TO_RECOVERY: Record<
  HostedErrorKind,
  Extract<
    AiOnboardingErrorKind,
    'hostedBudget' | 'hostedSubscription' | 'hostedUnavailable' | 'hostedBusy'
  >
> = {
  budget: 'hostedBudget',
  dailyLimit: 'hostedBudget',
  subscription: 'hostedSubscription',
  consentRequired: 'hostedUnavailable',
  removed: 'hostedSubscription',
  unavailable: 'hostedUnavailable',
  dailyFull: 'hostedUnavailable',
  busy: 'hostedBusy',
  alreadyProcessed: 'hostedBusy',
};

/** Maps whatever a provider call threw to what the person is told and which exits we offer. */
export function classifyAiOnboardingError(error: unknown): AiOnboardingErrorKind {
  if (error instanceof AiCancelledError) {
    return 'cancelled';
  }

  if (error instanceof AiInvalidKeyError) {
    return 'invalidKey';
  }

  if (error instanceof AiTimeoutError) {
    return 'timeout';
  }

  if (error instanceof GatewayRateLimitError) {
    return 'gatewayLimit';
  }

  // Before the generic credits check: a hosted budget error counts as a credits error too.
  const hosted = hostedErrorKindOf(error);
  if (hosted) {
    return HOSTED_KIND_TO_RECOVERY[hosted];
  }

  if (error instanceof AiCreditsError || isAiCreditsError(error)) {
    return 'credits';
  }

  return isAiConnectionError(error) ? 'offline' : 'unknown';
}
