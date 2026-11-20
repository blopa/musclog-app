// The orchestration the Premium screens call (plan 11 item 7). Nothing here runs at import or at
// boot: each function is called by a screen action. Consent comes before the switch goes on, so
// subscribe/restore only return the result; the screen turns the setting on after the consent.
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { loadDeviceKeyInfo } from '@/services/premium/deviceKeyStore';
import {
  fetchPremiumConfig,
  getPremiumStatus,
  purchaseAndEnroll,
  refreshPremiumUsage,
  resetPremium,
  restoreAndEnroll,
} from '@/services/premium/premiumService';
import { getMonthlyPriceString } from '@/services/premium/revenueCatHarness';
import type {
  HostedConfig,
  PremiumActionFailure,
  PremiumResult,
  PremiumStatus,
  SessionGrant,
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
  const status = await getPremiumStatus();
  const configResult = await fetchPremiumConfig();
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

/** Buys a month, then enrolls this device. The caller turns hosted AI on only after consent. */
export function subscribe(): Promise<PremiumResult<SessionGrant>> {
  return purchaseAndEnroll();
}

/** Store-verified restore under this device's id; also how a second device is added. */
export function restore(): Promise<PremiumResult<SessionGrant>> {
  return restoreAndEnroll();
}

export async function setUseHostedAi(on: boolean): Promise<void> {
  await SettingsService.set(SETTINGS.useHostedAi, on);
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
