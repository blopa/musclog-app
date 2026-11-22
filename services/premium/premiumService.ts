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
  ensureRevenueCatIdentity,
  getConfiguredAppUserId,
  logInTo,
  restorePurchases,
  STORE_ALREADY_PURCHASED,
  STORE_CANCELLED,
  storeErrorCodeOf,
} from '@/services/premium/revenueCat';
import { hexToBytes } from '@/utils/premium/deviceKeyCrypto';
import {
  type FetchLike,
  hostedConfig,
  type HostedResult,
  hostedUsage,
} from '@/utils/premium/hostedClient';
import type { PremiumProgress } from '@/utils/premium/premiumActivity';
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
  type PremiumActionFailure,
  type PremiumResult,
  type PremiumStatus,
  type SessionGrant,
  tokenNeedsRefresh,
  type UsageSnapshot,
} from '@/utils/premium/premiumState';

export function hostedAiBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL;

  if (!url) {
    return null;
  }

  // The session token travels to this address: plain http is for a local Worker in development only.
  return url.startsWith('https://') || (__DEV__ && url.startsWith('http://')) ? url : null;
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
  private cached: { rcId: string; grant: SessionGrant } | null = null;
  private inFlight: Promise<PremiumResult<SessionGrant>> | null = null;
  private generation = 0;

  begin(): number {
    return this.generation;
  }

  /** Drops the cached token (it expired, was refused, or the device was removed). */
  invalidateToken(): void {
    this.cached = null;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }

  /** The cached grant for this id, when it is still worth using. */
  usableGrant(rcId: string, nowMs: number): SessionGrant | null {
    const { cached } = this;

    return cached && cached.rcId === rcId && !tokenNeedsRefresh(cached.grant.expiresAtMs, nowMs)
      ? cached.grant
      : null;
  }

  remember(rcId: string, grant: SessionGrant): void {
    this.cached = { rcId, grant };
  }

  /** The request already in flight, or `run` started now. It clears itself once settled. */
  shared(run: () => Promise<PremiumResult<SessionGrant>>): Promise<PremiumResult<SessionGrant>> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const pending = run();

    this.inFlight = pending;

    const clear = () => {
      if (this.inFlight === pending) {
        this.inFlight = null;
      }
    };

    pending.then(clear, clear);

    return pending;
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

  session.remember(rcId, grant);
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

  session.invalidateToken();
  await savePremiumLocalState({ removed: true });
}

/**
 * The Worker no longer finds a qualifying subscription (it lapsed, was cancelled or refunded): the
 * device stays enrolled (a new purchase or restore needs no re-enroll) but its last known status is
 * `revoked`. Without this the record kept saying `active` after the period ended, and the Premium
 * screens waited for usage that never came.
 */
async function markLapsed(startedIn: number): Promise<void> {
  if (!session.isCurrent(startedIn)) {
    return;
  }

  session.invalidateToken();
  await savePremiumLocalState({ lastStatus: 'revoked' });
}

/** What a refused session or usage call means for the device-local record. */
async function noteIdentityFailure(failure: PremiumActionFailure, startedIn: number) {
  if (failure === 'unknown_device') {
    // Evicted or removed from the subscription: report it, never re-enroll silently.
    await markRemoved(startedIn);
  } else if (failure === 'subscription_required') {
    await markLapsed(startedIn);
  }
}

/** The device key and the local record, and whether that record is this device's enrollment. */
async function loadEnrollment() {
  const key = await loadDeviceKeyInfo().catch(() => null);
  const local = await loadPremiumLocalState();

  return { key, local, enrolledHere: key !== null && local.rcId === key.rcId };
}

export async function getPremiumStatus(): Promise<PremiumStatus> {
  const { local, enrolledHere } = await loadEnrollment();

  return derivePremiumStatus({
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

/** Store-verified restore under the key-derived id; reports a store refusal and says it failed. */
async function restoreStep(rcId: string): Promise<PurchaseStepResult> {
  try {
    await ensureRevenueCatIdentity(rcId);
    await restorePurchases();

    return { rcId };
  } catch (e) {
    reportPremiumFailure('restore', 'restore_failed', {
      storeErrorCode: storeErrorCodeOf(e) ?? 'none',
    });

    return { failure: 'restore_failed' };
  }
}

async function purchaseStep(rcId: string): Promise<PurchaseStepResult> {
  try {
    await ensureRevenueCatIdentity(rcId);
    await buyMonthly();

    return { rcId };
  } catch (e) {
    const code = storeErrorCodeOf(e);

    if (code === STORE_ALREADY_PURCHASED) {
      // The store says this account already owns it: restore under this id and carry on.
      return restoreStep(rcId);
    }

    if ((e as { userCancelled?: boolean }).userCancelled || code === STORE_CANCELLED) {
      return { failure: 'purchase_cancelled' };
    }

    reportPremiumFailure('purchase', 'purchase_failed', { storeErrorCode: code ?? 'none' });

    return { failure: 'purchase_failed' };
  }
}

function buyOrRestoreThenEnroll(
  step: 'purchase' | 'restore',
  onProgress?: (stage: PremiumProgress) => void
): Promise<PremiumResult<SessionGrant>> {
  return withBaseUrl(step, async (baseUrl) => {
    const startedIn = session.begin();

    onProgress?.('store');
    const { rcId } = await getOrCreateDeviceKey();
    const done = await (step === 'purchase' ? purchaseStep(rcId) : restoreStep(rcId));

    if ('failure' in done) {
      return { ok: false, failure: done.failure };
    }

    return enrollAndRemember(done.rcId, startedIn, () =>
      enrollWithRetry({ ...flowDeps(baseUrl), sleep, onProgress })
    );
  });
}

/** Subscribe under the key-derived id, then enroll. RevenueCat is configured lazily, here. */
export const purchaseAndEnroll = (onProgress?: (stage: PremiumProgress) => void) =>
  buyOrRestoreThenEnroll('purchase', onProgress);

/** Store-verified restore under this device's id (this is also how a second device is added). */
export const restoreAndEnroll = (onProgress?: (stage: PremiumProgress) => void) =>
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
      session.invalidateToken();
    }

    await noteIdentityFailure(result.failure, startedIn);

    return { ok: false, failure: result.failure };
  });
}

/** A usable session token, refreshed 5 minutes before it expires. Never enrolls by itself. */
export async function getSessionGrant(): Promise<PremiumResult<SessionGrant>> {
  const { key, local, enrolledHere } = await loadEnrollment();

  if (key === null || !enrolledHere) {
    return { ok: false, failure: 'not_enrolled' };
  }

  if (local.removed) {
    return { ok: false, failure: 'unknown_device' };
  }

  const usable = session.usableGrant(key.rcId, Date.now());

  if (usable) {
    return { ok: true, value: usable };
  }

  return session.shared(() => mintAndRemember(key.rcId));
}

type GrantFailure = Extract<PremiumResult<SessionGrant>, { ok: false }>;

/**
 * Calls a session route with the cached token. A token the Worker refuses is dropped and the call
 * is made once more with a new one; any other answer (including a failure) is returned as it is.
 */
async function withSessionToken(
  call: (token: string) => Promise<HostedResult>
): Promise<{ ok: true; result: HostedResult } | { ok: false; grant: GrantFailure }> {
  const grant = await getSessionGrant();

  if (!grant.ok) {
    return { ok: false, grant };
  }

  let result = await call(grant.value.sessionToken);

  if (!result.ok && failureKindOf(result) === 'unauthorized') {
    session.invalidateToken();

    const again = await getSessionGrant();

    if (!again.ok) {
      return { ok: false, grant: again };
    }

    result = await call(again.value.sessionToken);
  }

  return { ok: true, result };
}

/** `/v1/usage`: a percentage and a status. Retries once with a new token if the cached one died. */
export function refreshPremiumUsage(): Promise<PremiumResult<UsageSnapshot>> {
  return withBaseUrl('usage', async (baseUrl) => {
    const startedIn = session.begin();
    const outcome = await withSessionToken((token) => hostedUsage(baseUrl, token, platformFetch));

    if (!outcome.ok) {
      return outcome.grant;
    }

    const { result } = outcome;

    if (!result.ok) {
      const failure = failureKindOf(result);

      reportPremiumFailure('usage', failure, { status: result.status });
      await noteIdentityFailure(failure, startedIn);

      return { ok: false, failure };
    }

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
  });
}

// `/v1/config` is public and read by the Premium screen and by every hosted photo, so a burst of
// them makes one request.
const CONFIG_CACHE_MS = 5 * 60 * 1000;
const CONFIG_RETRY_DELAY_MS = 800;
const CONFIG_RETRY_KINDS: ReadonlySet<string> = new Set(['unavailable', 'network']);
let cachedConfig: { value: HostedConfig; at: number } | null = null;

export function fetchPremiumConfig(): Promise<PremiumResult<HostedConfig>> {
  return withBaseUrl('config', async (baseUrl) => {
    const now = Date.now();

    if (cachedConfig && now - cachedConfig.at < CONFIG_CACHE_MS) {
      return { ok: true, value: cachedConfig.value };
    }

    let result = await hostedConfig(baseUrl, platformFetch);

    // `/v1/config` is public and idempotent: one quiet retry absorbs an edge 5xx or a dropped
    // connection (a 504 reached Sentry on the first day) before anything is reported.
    if (!result.ok && CONFIG_RETRY_KINDS.has(failureKindOf(result))) {
      await sleep(CONFIG_RETRY_DELAY_MS);
      result = await hostedConfig(baseUrl, platformFetch);
    }

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
