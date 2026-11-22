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
import { reportPremiumFailure } from '@/services/premium/premiumTelemetry';
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
  type FlowResult,
  mintSession,
  type Signer,
} from '@/utils/premium/premiumFlows';
import type { PremiumStage } from '@/utils/premium/premiumReport';
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

async function withBaseUrl<T>(
  stage: PremiumStage,
  fn: (baseUrl: string) => Promise<PremiumResult<T>>
): Promise<PremiumResult<T>> {
  const baseUrl = hostedAiBaseUrl();

  if (!baseUrl) {
    reportPremiumFailure(stage, 'not_available');

    return { ok: false, failure: 'not_available' };
  }

  return fn(baseUrl);
}

/**
 * The session token lives in memory only: it is never stored, logged or backed up. `generation` is
 * bumped by a reset, so an enroll or session that started before it must not write the old id back.
 */
class SessionState {
  cached: { rcId: string; grant: SessionGrant } | null = null;
  inFlight: Promise<PremiumResult<SessionGrant>> | null = null;
  private generation = 0;

  begin(): number {
    return this.generation;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }

  reset(): void {
    this.generation += 1;
    this.cached = null;
    this.inFlight = null;
  }
}

const session = new SessionState();

async function remember(rcId: string, grant: SessionGrant, startedIn: number): Promise<void> {
  if (!session.isCurrent(startedIn)) {
    return;
  }

  session.cached = { rcId, grant };
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
  if (!session.isCurrent(startedIn)) {
    return;
  }

  session.cached = null;
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

async function enrollAndRemember(
  rcId: string,
  startedIn: number,
  enroll: () => Promise<FlowResult<SessionGrant>>
): Promise<PremiumResult<SessionGrant>> {
  const result = await enroll();

  if (!result.ok) {
    reportPremiumFailure('enroll', result.failure, { status: result.status });

    return { ok: false, failure: result.failure };
  }

  await remember(rcId, result.value, startedIn);

  return result;
}

/** Enrolls this device (one attempt). Use after the subscription is known to exist. */
export function enrollThisDevice(): Promise<PremiumResult<SessionGrant>> {
  return withBaseUrl('enroll', async (baseUrl) => {
    const startedIn = session.begin();
    const key = await getOrCreateDeviceKey();

    return enrollAndRemember(key.rcId, startedIn, () => enrollDevice(flowDeps(baseUrl)));
  });
}

type PurchaseStepResult =
  { rcId: string } | { failure: 'purchase_cancelled' | 'purchase_failed' | 'restore_failed' };

const STORE_ALREADY_PURCHASED = '6';
const STORE_CANCELLED = '1';

function storeErrorCodeOf(e: unknown): string | undefined {
  const code = (e as { code?: unknown } | null)?.code;

  return code === undefined || code === null ? undefined : String(code);
}

async function purchaseStep(step: 'purchase' | 'restore'): Promise<PurchaseStepResult> {
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
    const code = storeErrorCodeOf(e);

    if (step === 'purchase') {
      if (code === STORE_ALREADY_PURCHASED) {
        // The store says this account already owns it: restore under this id and carry on.
        try {
          await restorePurchases();

          return { rcId: key.rcId };
        } catch (restoreError) {
          reportPremiumFailure('restore', 'restore_failed', {
            storeErrorCode: storeErrorCodeOf(restoreError) ?? 'none',
          });

          return { failure: 'restore_failed' };
        }
      }

      if ((e as { userCancelled?: boolean }).userCancelled || code === STORE_CANCELLED) {
        return { failure: 'purchase_cancelled' };
      }

      reportPremiumFailure('purchase', 'purchase_failed', { storeErrorCode: code ?? 'none' });

      return { failure: 'purchase_failed' };
    }

    reportPremiumFailure('restore', 'restore_failed', { storeErrorCode: code ?? 'none' });

    return { failure: 'restore_failed' };
  }
}

function buyOrRestoreThenEnroll(
  step: 'purchase' | 'restore',
  onProgress?: (stage: 'store' | 'confirming') => void
): Promise<PremiumResult<SessionGrant>> {
  return withBaseUrl(step, async (baseUrl) => {
    const startedIn = session.begin();

    onProgress?.('store');
    const done = await purchaseStep(step);

    if ('failure' in done) {
      return { ok: false, failure: done.failure };
    }

    return enrollAndRemember(done.rcId, startedIn, () =>
      enrollWithRetry({ ...flowDeps(baseUrl), sleep, onProgress })
    );
  });
}

/** Subscribe under the key-derived id, then enroll. RevenueCat is configured lazily, here. */
export const purchaseAndEnroll = (onProgress?: (stage: 'store' | 'confirming') => void) =>
  buyOrRestoreThenEnroll('purchase', onProgress);

/** Store-verified restore under this device's id (this is also how a second device is added). */
export const restoreAndEnroll = (onProgress?: (stage: 'store' | 'confirming') => void) =>
  buyOrRestoreThenEnroll('restore', onProgress);

function mintAndRemember(rcId: string): Promise<PremiumResult<SessionGrant>> {
  return withBaseUrl('session', async (baseUrl) => {
    const startedIn = session.begin();
    const result = await mintSession(flowDeps(baseUrl));

    if (result.ok) {
      await remember(rcId, result.value, startedIn);

      return result;
    }

    reportPremiumFailure('session', result.failure, { status: result.status });

    if (session.isCurrent(startedIn)) {
      session.cached = null;
    }

    if (result.failure === 'unknown_device') {
      // Evicted or removed from the subscription: report it, never re-enroll silently.
      await markRemoved(startedIn);
    }

    return { ok: false, failure: result.failure };
  });
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

  const { cached } = session;

  if (
    cached &&
    cached.rcId === key.rcId &&
    !tokenNeedsRefresh(cached.grant.expiresAtMs, Date.now())
  ) {
    return { ok: true, value: cached.grant };
  }

  if (!session.inFlight) {
    const run = mintAndRemember(key.rcId);

    session.inFlight = run;

    const clear = () => {
      if (session.inFlight === run) {
        session.inFlight = null;
      }
    };

    run.then(clear, clear);
  }

  return session.inFlight;
}

/** `/v1/usage`: a percentage and a status. Retries once with a new token if the cached one died. */
export function refreshPremiumUsage(): Promise<PremiumResult<UsageSnapshot>> {
  return withBaseUrl('usage', async (baseUrl) => {
    const startedIn = session.begin();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const grant = await getSessionGrant();

      if (!grant.ok) {
        return grant;
      }

      const result = await hostedUsage(baseUrl, grant.value.sessionToken, platformFetch);

      if (result.ok) {
        const usage = parseUsage(result.body);

        if (!usage) {
          reportPremiumFailure('usage', 'invalid_response', { status: result.status });

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
        session.cached = null;
        continue;
      }

      reportPremiumFailure('usage', failure, { status: result.status });

      if (failure === 'unknown_device') {
        await markRemoved(startedIn);
      }

      return { ok: false, failure };
    }

    return { ok: false, failure: 'unknown' };
  });
}

// `/v1/config` is public and read by the Premium screen and by every hosted photo, so a burst of
// them makes one request.
const CONFIG_CACHE_MS = 5 * 60 * 1000;
let cachedConfig: { value: HostedConfig; at: number } | null = null;

export function fetchPremiumConfig(): Promise<PremiumResult<HostedConfig>> {
  return withBaseUrl('config', async (baseUrl) => {
    const now = Date.now();

    if (cachedConfig && now - cachedConfig.at < CONFIG_CACHE_MS) {
      return { ok: true, value: cachedConfig.value };
    }

    const result = await hostedConfig(baseUrl, platformFetch);

    if (!result.ok) {
      const failure = failureKindOf(result);

      reportPremiumFailure('config', failure, { status: result.status });

      return { ok: false, failure };
    }

    const config = parseHostedConfig(result.body);

    if (!config) {
      reportPremiumFailure('config', 'invalid_response', { status: result.status });

      return { ok: false, failure: 'invalid_response' };
    }

    cachedConfig = { value: config, at: now };

    return { ok: true, value: config };
  });
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
  session.reset();
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
