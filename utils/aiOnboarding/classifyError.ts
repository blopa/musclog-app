import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  type HostedErrorKind,
  hostedErrorKindOf,
} from '@/utils/aiErrors';
import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';
import {
  AiCreditsError,
  GatewayRateLimitError,
  isAiConnectionError,
  isAiCreditsError,
} from '@/utils/coachAI';

const HOSTED_KIND_TO_RECOVERY: Record<
  HostedErrorKind,
  Extract<
    AiOnboardingErrorKind,
    'hostedBudget' | 'hostedSubscription' | 'hostedUnavailable' | 'hostedBusy'
  >
> = {
  budget: 'hostedBudget',
  subscription: 'hostedSubscription',
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

  // Before the generic credits check: a hosted budget error is also an AiCreditsError.
  const hosted = hostedErrorKindOf(error);
  if (hosted) {
    return HOSTED_KIND_TO_RECOVERY[hosted];
  }

  if (error instanceof AiCreditsError || isAiCreditsError(error)) {
    return 'credits';
  }

  return isAiConnectionError(error) ? 'offline' : 'unknown';
}
