// App-facing Premium identity and session service (plan 6.1, 11). Native only (web stub beside it).
// Nothing here runs at module scope or at boot: every entry point is called by a user action or by
// a feature that already checked the setting. Premium status always comes from the Worker's answers.
import {
  getOrCreateDeviceKey,
  loadDeviceKeyInfo,
  resetDeviceKey,
  signWithDeviceKey,
} from '@/services/premium/deviceKeyStore';
import {
  clearPremiumLocalState,
  loadPremiumLocalState,
  savePremiumLocalState,
} from '@/services/premium/premiumLocalState';
import {
  buyMonthly,
  configureRevenueCat,
  getConfiguredAppUserId,
  logInTo,
  restorePurchases,
} from '@/services/premium/revenueCat';
import { hexToBytes } from '@/utils/premium/deviceKeyCrypto';
import { type FetchLike, hostedConfig, hostedUsage } from '@/utils/premium/hostedClient';
import {
  enrollDevice,
  enrollWithRetry,
  type FlowDeps,
  mintSession,
  type Signer,
} from '@/utils/premium/premiumFlows';
import {
  derivePremiumStatus,
  failureKindOf,
  type HostedConfig,
  parseHostedConfig,
  parseUsage,
  type PremiumResult,
  type PremiumStatus,
  type SessionGrant,
  tokenNeedsRefresh,
  type UsageSnapshot,
} from '@/utils/premium/premiumState';

export function hostedAiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL;

  return url ? url : null;
}

/** The platform `fetch`, read at call time (tests replace it), typed for the pure flows. */
const platformFetch: FetchLike = (url, init) => fetch(url, init) as ReturnType<FetchLike>;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Adapts the key store (hex strings) to the pure flows (bytes). */
const signer: Signer = async (purpose, nonce) => {
  const signed = await signWithDeviceKey(purpose, nonce);

  return {
    rcId: signed.rcId,
    publicKey: hexToBytes(signed.publicKeyHex),
    signature: hexToBytes(signed.signatureHex),
  };
};

function flowDeps(baseUrl: string): FlowDeps {
  return { baseUrl, fetch: platformFetch, sign: signer };
}

// The token lives in memory only: it is never stored, logged or backed up.
let cached: { rcId: string; grant: SessionGrant } | null = null;
let inFlightSession: Promise<PremiumResult<SessionGrant>> | null = null;
// Bumped by a reset: an enroll or session that started before it must not write the old id back.
let generation = 0;

async function remember(rcId: string, grant: SessionGrant, startedIn: number): Promise<void> {
  if (startedIn !== generation) {
    return;
  }

  cached = { rcId, grant };
  await savePremiumLocalState({
    rcId,
    removed: false,
    lastStatus: 'active',
    usedPct: grant.usedPct,
    resetsAt: grant.resetsAt,
    devices: grant.devices,
  });
}

async function markRemoved(startedIn: number): Promise<void> {
  if (startedIn !== generation) {
    return;
  }

  cached = null;
  await savePremiumLocalState({ removed: true });
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  const key = await loadDeviceKeyInfo().catch(() => null);
  const local = await loadPremiumLocalState();
  const enrolledHere = key !== null && local.rcId === key.rcId;

  return derivePremiumStatus({
    hasKey: key !== null,
    enrolledRcId: enrolledHere ? local.rcId : null,
    removed: enrolledHere && local.removed,
    lastStatus: local.lastStatus,
  });
}

/** Enrolls this device (one attempt). Use after the subscription is known to exist. */
export async function enrollThisDevice(): Promise<PremiumResult<SessionGrant>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    return { ok: false, failure: 'not_available' };
  }

  const startedIn = generation;
  const key = await getOrCreateDeviceKey();
  const result = await enrollDevice(flowDeps(baseUrl));

  if (!result.ok) {
    return { ok: false, failure: result.failure };
  }

  await remember(key.rcId, result.value, startedIn);

  return result;
}

async function purchaseStep(
  step: 'purchase' | 'restore'
): Promise<
  { rcId: string } | { failure: 'purchase_cancelled' | 'purchase_failed' | 'restore_failed' }
> {
  const key = await getOrCreateDeviceKey();

  try {
    await configureRevenueCat(key.rcId);

    if (step === 'purchase') {
      await buyMonthly();
    } else {
      await restorePurchases();
    }

    return { rcId: key.rcId };
  } catch (e) {
    if (step === 'purchase') {
      return {
        failure: (e as { userCancelled?: boolean }).userCancelled
          ? 'purchase_cancelled'
          : 'purchase_failed',
      };
    }

    return { failure: 'restore_failed' };
  }
}

async function buyOrRestoreThenEnroll(
  step: 'purchase' | 'restore'
): Promise<PremiumResult<SessionGrant>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    return { ok: false, failure: 'not_available' };
  }

  const startedIn = generation;
  const done = await purchaseStep(step);

  if ('failure' in done) {
    return { ok: false, failure: done.failure };
  }

  const result = await enrollWithRetry({ ...flowDeps(baseUrl), sleep });

  if (!result.ok) {
    return { ok: false, failure: result.failure };
  }

  await remember(done.rcId, result.value, startedIn);

  return result;
}

/** Subscribe under the key-derived id, then enroll. RevenueCat is configured lazily, here. */
export const purchaseAndEnroll = () => buyOrRestoreThenEnroll('purchase');

/** Store-verified restore under this device's id (this is also how a second device is added). */
export const restoreAndEnroll = () => buyOrRestoreThenEnroll('restore');

async function mintAndRemember(rcId: string): Promise<PremiumResult<SessionGrant>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    return { ok: false, failure: 'not_available' };
  }

  const startedIn = generation;
  const result = await mintSession(flowDeps(baseUrl));

  if (result.ok) {
    await remember(rcId, result.value, startedIn);

    return result;
  }

  if (startedIn === generation) {
    cached = null;
  }

  if (result.failure === 'unknown_device') {
    // Evicted or removed from the subscription: report it, never re-enroll silently.
    await markRemoved(startedIn);
  }

  return { ok: false, failure: result.failure };
}

/** A usable session token, refreshed 5 minutes before it expires. Never enrolls by itself. */
export async function getSessionGrant(): Promise<PremiumResult<SessionGrant>> {
  const key = await loadDeviceKeyInfo().catch(() => null);
  const local = await loadPremiumLocalState();

  if (key === null || local.rcId !== key.rcId) {
    return { ok: false, failure: 'not_enrolled' };
  }

  if (local.removed) {
    return { ok: false, failure: 'unknown_device' };
  }

  if (
    cached &&
    cached.rcId === key.rcId &&
    !tokenNeedsRefresh(cached.grant.expiresAtMs, Date.now())
  ) {
    return { ok: true, value: cached.grant };
  }

  if (!inFlightSession) {
    const run = mintAndRemember(key.rcId);

    inFlightSession = run;

    const clear = () => {
      if (inFlightSession === run) {
        inFlightSession = null;
      }
    };

    run.then(clear, clear);
  }

  return inFlightSession;
}

/** `/v1/usage`: a percentage and a status. Retries once with a new token if the cached one died. */
export async function refreshPremiumUsage(): Promise<PremiumResult<UsageSnapshot>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    return { ok: false, failure: 'not_available' };
  }

  const startedIn = generation;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const grant = await getSessionGrant();

    if (!grant.ok) {
      return grant;
    }

    const result = await hostedUsage(baseUrl, grant.value.sessionToken, platformFetch);

    if (result.ok) {
      const usage = parseUsage(result.body);

      if (!usage) {
        return { ok: false, failure: 'invalid_response' };
      }

      await savePremiumLocalState({
        lastStatus: usage.status,
        usedPct: usage.usedPct,
        resetsAt: usage.resetsAt,
        devices: usage.devices,
      });

      return { ok: true, value: usage };
    }

    const failure = failureKindOf(result);

    if (failure === 'unauthorized' && attempt === 0) {
      cached = null;
      continue;
    }

    if (failure === 'unknown_device') {
      await markRemoved(startedIn);
    }

    return { ok: false, failure };
  }

  return { ok: false, failure: 'unknown' };
}

// `/v1/config` is public and read by the Premium screen and by every hosted photo, so a burst of
// them makes one request.
const CONFIG_CACHE_MS = 5 * 60 * 1000;
let cachedConfig: { value: HostedConfig; at: number } | null = null;

export async function fetchPremiumConfig(): Promise<PremiumResult<HostedConfig>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    return { ok: false, failure: 'not_available' };
  }

  const now = Date.now();

  if (cachedConfig && now - cachedConfig.at < CONFIG_CACHE_MS) {
    return { ok: true, value: cachedConfig.value };
  }

  const result = await hostedConfig(baseUrl, platformFetch);

  if (!result.ok) {
    return { ok: false, failure: failureKindOf(result) };
  }

  const config = parseHostedConfig(result.body);

  if (!config) {
    return { ok: false, failure: 'invalid_response' };
  }

  cachedConfig = { value: config, at: now };

  return { ok: true, value: config };
}

export function resetPremiumConfigCache(): void {
  cachedConfig = null;
}

/**
 * "Reset Premium on this device": forget the enrollment, make a new key (so a new `rc_id`) and
 * point RevenueCat at it. The person then restores and enrolls again. The old device row ages
 * out of the subscription's device allowance. If the SDK was never configured in this run, nothing
 * is configured here (it is configured lazily by the next purchase or restore).
 */
export async function resetPremium(): Promise<{ rcId: string; revenueCatSwitched: boolean }> {
  generation += 1;
  cached = null;
  inFlightSession = null;
  await clearPremiumLocalState();

  const fresh = await resetDeviceKey();
  let revenueCatSwitched = false;

  if (getConfiguredAppUserId() !== null) {
    try {
      // identified -> identified: RevenueCat documents no merge or transfer (plan A1, G2 step 16).
      await logInTo(fresh.rcId);
      revenueCatSwitched = true;
    } catch {
      // The next restore reconfigures from the new key; a failure here must not undo the reset.
    }
  }

  return { rcId: fresh.rcId, revenueCatSwitched };
}
