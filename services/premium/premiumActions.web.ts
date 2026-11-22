// Web has no Premium: every action reports it, nothing is read or written.
import type { PremiumOverview } from '@/services/premium/premiumActions';
import type { PremiumProgress } from '@/utils/premium/premiumActivity';
import type { PremiumResult, PremiumStatus, SessionGrant } from '@/utils/premium/premiumState';

export async function loadPremiumOverview(): Promise<PremiumOverview> {
  return {
    status: 'not_enrolled',
    usage: null,
    config: null,
    configFailure: 'not_available',
    priceString: null,
  };
}

export async function subscribeToPremium(
  _onProgress: (stage: PremiumProgress) => void
): Promise<PremiumResult<SessionGrant>> {
  return { ok: false, failure: 'not_available' };
}

export async function restorePremiumAccess(
  _onProgress: (stage: PremiumProgress) => void
): Promise<PremiumResult<SessionGrant>> {
  return { ok: false, failure: 'not_available' };
}

export async function recordPremiumConsent(): Promise<void> {}

export async function resetPremiumOnThisDevice(): Promise<void> {}

export async function disableHostedIfRemoved(_status: PremiumStatus): Promise<boolean> {
  return false;
}
