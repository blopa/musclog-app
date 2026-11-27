// The orchestration the Premium screens call (plan 11 item 7). Nothing here runs at import or at
// boot: each function is called by a screen action. Consent comes before the switch goes on: a
// purchase or restore turns hosted AI on only when the consent for this version is already on file;
// otherwise the screen asks and turns it on after the answer.
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { recordAiConsent } from '@/services/aiConsentRecord';
import { getOrCreateDeviceKey } from '@/services/premium/deviceKeyStore';
import {
  fetchPremiumConfig,
  getPremiumStatus,
  purchaseAndEnroll,
  refreshPremiumUsage,
  resetPremium,
  restoreAndEnroll,
} from '@/services/premium/premiumService';
import { getMonthlyPriceString } from '@/services/premium/revenueCat';
import type { PremiumProgress } from '@/utils/premium/premiumActivity';
import { needsPremiumConsent, PREMIUM_CONSENT_VERSION } from '@/utils/premium/premiumConsent';
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
  const [storedStatus, configResult] = await Promise.all([
    getPremiumStatus(),
    fetchPremiumConfig(),
  ]);
  const config = configResult.ok ? configResult.value : null;
  const configFailure = configResult.ok ? null : configResult.failure;

  let status = storedStatus;
  let usage: UsageSnapshot | null = null;

  if (status === 'active' || status === 'exhausted') {
    const result = await refreshPremiumUsage();

    usage = result.ok ? result.value : null;
    // The usage call records what the Worker answered (a new period status, a lapsed subscription,
    // a removed device): read the status again so this screen shows it, not the stored guess.
    status = await getPremiumStatus();
  }

  // The paywall names the store's price. A device that has never subscribed has no key yet, so the
  // key is made here (it would be made by the purchase anyway) to ask the store under its id.
  let priceString: string | null = null;

  if ((status === 'not_enrolled' || status === 'revoked') && config?.acceptingNew === true) {
    const key = await getOrCreateDeviceKey().catch(() => null);

    priceString = key ? await getMonthlyPriceString(key.rcId) : null;
  }

  return { status, usage, config, configFailure, priceString };
}

/** Turns hosted AI on when this version's consent is already on file; otherwise leaves it off. */
async function switchOnWhenConsented(): Promise<void> {
  const storedVersion = await SettingsService.get(SETTINGS.premiumConsentVersion);

  if (!needsPremiumConsent({ storedVersion, nextValue: true })) {
    await SettingsService.set(SETTINGS.useHostedAi, true);
  }
}

async function enrollThenSwitchOn(
  enroll: Promise<PremiumResult<SessionGrant>>
): Promise<PremiumResult<SessionGrant>> {
  const result = await enroll;

  if (result.ok) {
    await switchOnWhenConsented().catch(() => undefined);
  }

  return result;
}

/** Subscribes under this device's id and enrolls it. */
export function subscribeToPremium(
  onProgress: (stage: PremiumProgress) => void
): Promise<PremiumResult<SessionGrant>> {
  return enrollThenSwitchOn(purchaseAndEnroll(onProgress));
}

/** Store-verified restore under this device's id (also how a second device is added). */
export function restorePremiumAccess(
  onProgress: (stage: PremiumProgress) => void
): Promise<PremiumResult<SessionGrant>> {
  return enrollThenSwitchOn(restoreAndEnroll(onProgress));
}

export async function recordPremiumConsent(): Promise<void> {
  await SettingsService.set(SETTINGS.premiumConsentVersion, PREMIUM_CONSENT_VERSION);
  await recordAiConsent('hosted', PREMIUM_CONSENT_VERSION);
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
