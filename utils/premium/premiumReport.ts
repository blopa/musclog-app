// Pure description of what a Premium failure reports to Sentry. No React Native, no storage.
// Tags carry only the stage, the failure kind, an HTTP status and a store error code: never an
// rc_id, a token, a key, a price or any message text.

import type { PremiumActionFailure } from './premiumState';

export type PremiumStage =
  'purchase' | 'restore' | 'enroll' | 'session' | 'usage' | 'config' | 'price';

export type PremiumReportDetail = { status?: number; storeErrorCode?: string };

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
  if (NOT_REPORTED.has(failure)) {
    return null;
  }

  const tags: Record<string, string> = { premium_stage: stage, premium_failure: failure };

  if (typeof detail.status === 'number') {
    tags.http_status = String(detail.status);
  }

  if (detail.storeErrorCode) {
    tags.store_error_code = detail.storeErrorCode;
  }

  return {
    message: `premium-${stage}-${failure}`,
    level: WARNING_FAILURES.has(failure) ? 'warning' : 'error',
    tags,
    fingerprint: ['premium', stage, failure],
  };
}
