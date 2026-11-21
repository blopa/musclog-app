// The orchestration the Premium screens call (plan 11 item 7). Nothing here runs at import or at
// boot: each function is called by a screen action. Consent comes before the switch goes on, so
// subscribe/restore only return the result; the screen turns the setting on after the consent.
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { loadDeviceKeyInfo } from '@/services/premium/deviceKeyStore';
import {
  fetchPremiumConfig,
  getPremiumStatus,
  refreshPremiumUsage,
  resetPremium,
} from '@/services/premium/premiumService';
import { getMonthlyPriceString } from '@/services/premium/revenueCat';
import type {
  HostedConfig,
  PremiumActionFailure,
  PremiumStatus,
  UsageSnapshot,
} from '@/utils/premium/premiumState';

export type PremiumOverview = {
  status: PremiumStatus;
  usage: UsageSnapshot | null;
  config: HostedConfig | null;
  configFailure: PremiumActionFailure | null;
  priceString: string | null;
};

/** Reads everything the Premium screen shows. Called only when the screen asks, never at boot. */
export async function loadPremiumOverview(): Promise<PremiumOverview> {
  const [status, configResult] = await Promise.all([getPremiumStatus(), fetchPremiumConfig()]);
  const config = configResult.ok ? configResult.value : null;
  const configFailure = configResult.ok ? null : configResult.failure;

  let usage: UsageSnapshot | null = null;

  if (status === 'active' || status === 'exhausted') {
    const result = await refreshPremiumUsage();

    usage = result.ok ? result.value : null;
  }

  let priceString: string | null = null;

  if ((status === 'no_key' || status === 'not_enrolled') && config?.acceptingNew === true) {
    const key = await loadDeviceKeyInfo().catch(() => null);

    priceString = key ? await getMonthlyPriceString(key.rcId) : null;
  }

  return { status, usage, config, configFailure, priceString };
}

/** Forgets the enrollment on this device and switches hosted AI off with it. */
export async function resetPremiumOnThisDevice(): Promise<void> {
  await resetPremium();
  await SettingsService.set(SETTINGS.useHostedAi, false);
}

/**
 * A removed or revoked subscription must stop the app routing requests through it. The caller
 * shows the matching notice; this only switches the setting off. Returns whether it did.
 */
export async function disableHostedIfRemoved(status: PremiumStatus): Promise<boolean> {
  if (status !== 'removed' && status !== 'revoked') {
    return false;
  }

  await SettingsService.set(SETTINGS.useHostedAi, false);

  return true;
}
