// Pure description of what a Premium failure reports to Sentry. No React Native, no storage.
// Tags carry only the stage, the failure kind, an HTTP status and a store error code: never an
// rc_id, a token, a key, a price or any message text.

import type { PremiumActionFailure } from './premiumState';

export type PremiumStage =
  'purchase' | 'restore' | 'enroll' | 'session' | 'usage' | 'config' | 'price';

/** What the person did that led to an enroll: bought, restored, or enrolled a device known to be subscribed. */
export type PremiumFlow = 'purchase' | 'restore' | 'enroll';

export type PremiumReportDetail = { status?: number; storeErrorCode?: string; flow?: PremiumFlow };

export type PremiumFailureReport = {
  message: string;
  level: 'error' | 'warning';
  tags: Record<string, string>;
  fingerprint: string[];
};

const NOT_REPORTED: ReadonlySet<PremiumActionFailure> = new Set([
  'purchase_cancelled',
  'network',
  'not_enrolled',
]);

/**
 * RevenueCat's PURCHASE_NOT_ALLOWED_ERROR: this device or account cannot buy at all (Google Play
 * billing unavailable, as on an emulator with no account, or purchases restricted). Nothing in
 * Musclog can fix it, whatever stage hit it.
 */
const STORE_PURCHASE_NOT_ALLOWED = '3';

const WARNING_FAILURES: ReadonlySet<PremiumActionFailure> = new Set([
  'stale_nonce',
  'unknown_device',
  'unauthorized',
  'unavailable',
]);

export function premiumFailureReport(
  stage: PremiumStage,
  failure: PremiumActionFailure,
  detail: PremiumReportDetail = {}
): PremiumFailureReport | null {
  if (NOT_REPORTED.has(failure) || detail.storeErrorCode === STORE_PURCHASE_NOT_ALLOWED) {
    return null;
  }

  // A restore that finds no subscription is the answer to "do I own Iron?", not a fault: anyone can
  // tap Restore, since there is no account. A purchase that ends here is a real problem and is kept.
  if (stage === 'enroll' && failure === 'subscription_required' && detail.flow === 'restore') {
    return null;
  }

  const tags: Record<string, string> = { premium_stage: stage, premium_failure: failure };

  if (typeof detail.status === 'number') {
    tags.http_status = String(detail.status);
  }

  if (detail.storeErrorCode) {
    tags.store_error_code = detail.storeErrorCode;
  }

  if (detail.flow) {
    tags.premium_flow = detail.flow;
  }

  return {
    message: `premium-${stage}-${failure}`,
    level: WARNING_FAILURES.has(failure) ? 'warning' : 'error',
    tags,
    fingerprint: ['premium', stage, failure],
  };
}
