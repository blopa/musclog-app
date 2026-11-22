import type { PremiumNotice } from '@/utils/premium/premiumUiState';

/** What a notice looks like: info is neutral, warning and error are the status hues. */
export type PremiumNoticeTone = 'info' | 'warning' | 'error';

/** One entry per notice: its whole translation key (so the translation check sees each string) and its tone. */
export const PREMIUM_NOTICES: Record<PremiumNotice, { key: string; tone: PremiumNoticeTone }> = {
  offline: { key: 'premium.notice.offline', tone: 'warning' },
  purchase_cancelled: { key: 'premium.notice.purchase_cancelled', tone: 'info' },
  purchase_failed: { key: 'premium.notice.purchase_failed', tone: 'error' },
  restore_nothing: { key: 'premium.notice.restore_nothing', tone: 'info' },
  confirming: { key: 'premium.notice.confirming', tone: 'info' },
  removed: { key: 'premium.notice.removed', tone: 'warning' },
  revoked: { key: 'premium.notice.revoked', tone: 'warning' },
  exhausted: { key: 'premium.notice.exhausted', tone: 'warning' },
  at_capacity: { key: 'premium.notice.at_capacity', tone: 'info' },
  unavailable: { key: 'premium.notice.unavailable', tone: 'error' },
  not_accepting: { key: 'premium.notice.not_accepting', tone: 'info' },
  not_available: { key: 'premium.notice.not_available', tone: 'info' },
  warning80: { key: 'premium.notice.warning80', tone: 'warning' },
};

/**
 * The translation key and placeholders of a notice. Only the used-up allowance depends on
 * something else (the renewal date, which may be unknown), so the choice lives here, not in the modal.
 */
export function premiumNoticeCopy(
  notice: PremiumNotice,
  renewalDate: string | null
): { key: string; params?: { date: string } } {
  if (notice !== 'exhausted') {
    return { key: PREMIUM_NOTICES[notice].key };
  }

  return renewalDate
    ? { key: PREMIUM_NOTICES.exhausted.key, params: { date: renewalDate } }
    : { key: 'premium.notice.exhaustedNoDate' };
}
