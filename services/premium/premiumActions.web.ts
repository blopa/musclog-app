// Web has no Premium: every action reports it, nothing is read or written.
import type { PremiumOverview } from '@/services/premium/premiumActions';
import type { PremiumStatus } from '@/utils/premium/premiumState';

export async function loadPremiumOverview(): Promise<PremiumOverview> {
  return {
    status: 'no_key',
    usage: null,
    config: null,
    configFailure: 'not_available',
    priceString: null,
  };
}

export async function resetPremiumOnThisDevice(): Promise<void> {}

export async function disableHostedIfRemoved(_status: PremiumStatus): Promise<boolean> {
  return false;
}
