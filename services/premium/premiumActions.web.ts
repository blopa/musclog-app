// Web has no Premium: every action reports it, nothing is read or written.
import type { PremiumOverview } from '@/services/premium/premiumActions';
import type { PremiumResult, PremiumStatus, SessionGrant } from '@/utils/premium/premiumState';

export async function loadPremiumOverview(): Promise<PremiumOverview> {
  return {
    status: 'no_key',
    usage: null,
    config: null,
    configFailure: 'not_available',
    priceString: null,
  };
}

export function subscribe(): Promise<PremiumResult<SessionGrant>> {
  return Promise.resolve({ ok: false, failure: 'not_available' });
}

export function restore(): Promise<PremiumResult<SessionGrant>> {
  return Promise.resolve({ ok: false, failure: 'not_available' });
}

export async function setUseHostedAi(_on: boolean): Promise<void> {}

export async function resetPremiumOnThisDevice(): Promise<void> {}

export async function disableHostedIfRemoved(_status: PremiumStatus): Promise<boolean> {
  return false;
}
