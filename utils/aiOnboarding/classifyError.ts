import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '@/utils/aiErrors';
import type { AiOnboardingErrorKind } from '@/utils/aiOnboarding/chatState';
import {
  AiCreditsError,
  GatewayRateLimitError,
  isAiConnectionError,
  isAiCreditsError,
} from '@/utils/coachAI';

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

  if (error instanceof AiCreditsError || isAiCreditsError(error)) {
    return 'credits';
  }

  return isAiConnectionError(error) ? 'offline' : 'unknown';
}
