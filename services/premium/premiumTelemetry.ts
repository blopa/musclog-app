// Sends Premium failures to Sentry (consent is checked inside `captureMessage`). Fire and forget:
// reporting must never change what the person sees or throw into a purchase.
import {
  premiumFailureReport,
  type PremiumReportDetail,
  type PremiumStage,
} from '@/utils/premium/premiumReport';
import type { PremiumActionFailure } from '@/utils/premium/premiumState';
import { captureMessage } from '@/utils/sentry';

export function reportPremiumFailure(
  stage: PremiumStage,
  failure: PremiumActionFailure,
  detail?: PremiumReportDetail
): void {
  try {
    const report = premiumFailureReport(stage, failure, detail);

    if (!report) {
      return;
    }

    void captureMessage(report.message, {
      level: report.level,
      tags: report.tags,
      fingerprint: report.fingerprint,
    }).catch(() => {});
  } catch {
    // Never throws.
  }
}
