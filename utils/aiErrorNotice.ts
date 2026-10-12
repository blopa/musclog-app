import i18n from '@/lang/lang';

import { describeAiError } from './aiErrors';
import { showSnackbar } from './snackbarService';

/** One notice per this long: a failing screen retries, and a stack of identical toasts helps nobody. */
const NOTICE_COOLDOWN_MS = 5000;
let lastNoticeAt = 0;

/**
 * Tells the user about an error they can act on (a rejected key, a timeout) when the failing call
 * has no error channel of its own — most `coachAI` functions return `null` on failure, so without
 * this a bad key looked identical to "the model had nothing to say". A cancel is deliberately
 * silent. Anything that is not a typed error is left to the caller's own fallback.
 */
export function notifyUserFacingAiError(error: unknown, now: number = Date.now()): void {
  const message = describeAiError(error, (key, options) => i18n.t(key, options) as string);
  if (!message || now - lastNoticeAt < NOTICE_COOLDOWN_MS) {
    return;
  }

  lastNoticeAt = now;
  showSnackbar('error', message);
}

/** Test seam: forget the cooldown. */
export function resetAiErrorNoticeCooldown(): void {
  lastNoticeAt = 0;
}
