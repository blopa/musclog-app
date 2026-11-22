import AsyncStorage from '@react-native-async-storage/async-storage';

import { PREMIUM_DEVICE_STATE } from '@/constants/misc';
import {
  loadDeviceKeyInfo,
  getOrCreateDeviceKey,
  resetDeviceKey,
  signWithDeviceKey,
} from '@/services/premium/deviceKeyStore';
import {
  buyMonthly,
  configureRevenueCat,
  ensureRevenueCatIdentity,
  getConfiguredAppUserId,
  logInTo,
  restorePurchases,
} from '@/services/premium/revenueCat';
import {
  hostedAiBaseUrl,
  fetchPremiumConfig,
  resetPremiumConfigCache,
  getPremiumStatus,
  getSessionGrant,
  enrollThisDevice,
  purchaseAndEnroll,
  refreshPremiumUsage,
  resetPremium,
  restoreAndEnroll,
} from '@/services/premium/premiumService';
import { reportPremiumFailure } from '@/services/premium/premiumTelemetry';
import {
  EMPTY_PREMIUM_LOCAL_STATE,
  loadPremiumLocalState,
} from '@/services/premium/premiumLocalState';
import {
  bytesToHex,
  deriveRcId,
  generateDeviceKey,
  signDeviceMessage,
} from '@/utils/premium/deviceKeyCrypto';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('@/services/premium/deviceKeyStore', () => ({
  loadDeviceKeyInfo: jest.fn(),
  getOrCreateDeviceKey: jest.fn(),
  resetDeviceKey: jest.fn(),
  signWithDeviceKey: jest.fn(),
}));

jest.mock('@/services/premium/revenueCat', () => ({
  configureRevenueCat: jest.fn(),
  ensureRevenueCatIdentity: jest.fn(),
  buyMonthly: jest.fn(),
  restorePurchases: jest.fn(),
  logInTo: jest.fn(),
  getConfiguredAppUserId: jest.fn(),
  STORE_ALREADY_PURCHASED: '6',
  STORE_CANCELLED: '1',
  storeErrorCodeOf: (e: { code?: unknown } | null) =>
    e?.code === undefined || e?.code === null ? undefined : String(e.code),
}));

jest.mock('@/services/premium/premiumTelemetry', () => ({
  reportPremiumFailure: jest.fn(),
}));

const report = reportPremiumFailure as jest.Mock;

const BASE = 'https://ai.test';
const SESSION_TOKEN = 'SESSION-TOKEN-SECRET-42';
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const keyStore = {
  loadDeviceKeyInfo: loadDeviceKeyInfo as jest.Mock,
  getOrCreateDeviceKey: getOrCreateDeviceKey as jest.Mock,
  resetDeviceKey: resetDeviceKey as jest.Mock,
  signWithDeviceKey: signWithDeviceKey as jest.Mock,
};
const rc = {
  configureRevenueCat: configureRevenueCat as jest.Mock,
  ensureRevenueCatIdentity: ensureRevenueCatIdentity as jest.Mock,
  buyMonthly: buyMonthly as jest.Mock,
  restorePurchases: restorePurchases as jest.Mock,
  logInTo: logInTo as jest.Mock,
  getConfiguredAppUserId: getConfiguredAppUserId as jest.Mock,
};

let saved: Map<string, string>;
let keys: { secretKey: Uint8Array; publicKey: Uint8Array; rcId: string };
let nextKeys: { secretKey: Uint8Array; publicKey: Uint8Array; rcId: string };
let fetchMock: jest.Mock;
let order: string[];

function makeKeys(seed: number) {
  const { secretKey, publicKey } = generateDeviceKey(new Uint8Array(48).fill(seed));

  return { secretKey, publicKey, rcId: deriveRcId(publicKey) };
}

function keyInfo(k: { publicKey: Uint8Array; rcId: string }) {
  return {
    rcId: k.rcId,
    publicKeyHex: bytesToHex(k.publicKey),
    createdAtMs: NOW,
    storage: 'test',
  };
}

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function grantBody(usedPct = 10) {
  return {
    session_token: SESSION_TOKEN,
    expires_at: new Date(Date.now() + HOUR).toISOString(),
    period: { used_pct: usedPct, resets_at: '2026-12-15T00:00:00.000Z' },
    devices: { count: 1, max: 3 },
  };
}

/** Default Worker: challenge issues a nonce, enroll and session grant, usage and config answer. */
function workerFetch(overrides: Partial<Record<string, (init?: RequestInit) => unknown>> = {}) {
  let counter = 0;

  return jest.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const method = init?.method ?? 'GET';
    const override = overrides[`${method} ${path}`];

    if (override) {
      return override(init) as ReturnType<typeof jsonResponse>;
    }

    if (path === '/v1/challenge') {
      counter += 1;

      return jsonResponse(200, { nonce: `nonce-${counter}` });
    }

    if (path === '/v1/enroll' || path === '/v1/session') {
      return jsonResponse(200, grantBody());
    }

    if (path === '/v1/usage') {
      return jsonResponse(200, {
        status: 'active',
        used_pct: 33,
        resets_at: '2026-12-15T00:00:00.000Z',
        devices: { count: 1, max: 3 },
      });
    }

    if (path === '/v1/config') {
      return jsonResponse(200, {
        enabled: true,
        accepting_new: true,
        vision_enabled: false,
        image: null,
        minAppVersion: null,
      });
    }

    return jsonResponse(404, { error: { code: 'invalid_request' } });
  });
}

function requestsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname === path);
}

function authOf(call: unknown[]) {
  return ((call[1] as RequestInit).headers as Record<string, string>).authorization;
}

function stateOf(): Record<string, unknown> {
  return JSON.parse(saved.get(PREMIUM_DEVICE_STATE) ?? '{}') as Record<string, unknown>;
}

/** Signs with whichever key is current, the way the real key store does. */
function wireSigning() {
  keyStore.signWithDeviceKey.mockImplementation(
    async (purpose: 'enroll' | 'session', nonce: string) => {
      const signature = signDeviceMessage(keys.secretKey, purpose, keys.rcId, nonce);

      return {
        rcId: keys.rcId,
        publicKeyHex: bytesToHex(keys.publicKey),
        signatureHex: bytesToHex(signature),
      };
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPremiumConfigCache();
  process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL = BASE;

  saved = new Map();
  storage.getItem.mockImplementation(async (key: string) => saved.get(key) ?? null);
  storage.setItem.mockImplementation(async (key: string, value: string) => {
    saved.set(key, value);
  });
  storage.removeItem.mockImplementation(async (key: string) => {
    saved.delete(key);
  });

  keys = makeKeys(3);
  nextKeys = makeKeys(4);
  order = [];

  keyStore.loadDeviceKeyInfo.mockImplementation(async () => keyInfo(keys));
  keyStore.getOrCreateDeviceKey.mockImplementation(async () => {
    order.push('key');

    return keyInfo(keys);
  });
  keyStore.resetDeviceKey.mockImplementation(async () => {
    keys = nextKeys;

    return keyInfo(keys);
  });
  wireSigning();

  rc.configureRevenueCat.mockImplementation(async () => {
    order.push('configure');

    return { appUserID: keys.rcId, alreadyConfigured: false, matchesRequested: true };
  });
  // Mirrors the real helper: configure, then log in when the SDK answers under another id.
  rc.ensureRevenueCatIdentity.mockImplementation(async (rcId: string) => {
    const configured = await rc.configureRevenueCat(rcId);

    if (!configured.matchesRequested) {
      await rc.logInTo(rcId);
    }
  });
  rc.buyMonthly.mockImplementation(async () => {
    order.push('buy');

    return {};
  });
  rc.restorePurchases.mockImplementation(async () => {
    order.push('restore');

    return {};
  });
  rc.logInTo.mockResolvedValue(undefined);
  rc.getConfiguredAppUserId.mockReturnValue(null);

  fetchMock = workerFetch();
  global.fetch = fetchMock as unknown as typeof fetch;

  // enrollWithRetry sleeps through setTimeout: run every timer at once so no test waits.
  jest.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb();

    return 0;
  }) as unknown as typeof setTimeout);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('module load', () => {
  it('calls nothing at import time', () => {
    jest.isolateModules(() => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      require('@/services/premium/premiumService');
      const store = require('@/services/premium/deviceKeyStore');
      const harness = require('@/services/premium/revenueCat');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(store.getOrCreateDeviceKey).not.toHaveBeenCalled();
      expect(store.loadDeviceKeyInfo).not.toHaveBeenCalled();
      expect(harness.configureRevenueCat).not.toHaveBeenCalled();
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('purchaseAndEnroll', () => {
  it('creates the key, configures RevenueCat for it, buys, then enrolls', async () => {
    const result = await purchaseAndEnroll();

    expect(result.ok).toBe(true);
    expect(rc.ensureRevenueCatIdentity).toHaveBeenCalledWith(keys.rcId);
    expect(rc.configureRevenueCat).toHaveBeenCalledWith(keys.rcId);
    expect(order.slice(0, 3)).toEqual(['key', 'configure', 'buy']);
    expect(requestsTo('/v1/enroll')).toHaveLength(1);
    expect(fetchMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      rc.buyMonthly.mock.invocationCallOrder[0]
    );
  });

  it('saves the local enrollment on success', async () => {
    await purchaseAndEnroll();

    expect(await loadPremiumLocalState()).toMatchObject({
      rcId: keys.rcId,
      removed: false,
      lastStatus: 'active',
      usedPct: 10,
    });
  });

  it('reports purchase_cancelled and makes no request when the user cancels', async () => {
    rc.buyMonthly.mockRejectedValueOnce(
      Object.assign(new Error('cancel'), { userCancelled: true })
    );

    expect(await purchaseAndEnroll()).toEqual({ ok: false, failure: 'purchase_cancelled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports purchase_failed for any other purchase error', async () => {
    rc.buyMonthly.mockRejectedValueOnce(new Error('store down'));

    expect(await purchaseAndEnroll()).toEqual({ ok: false, failure: 'purchase_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('continues with a restore and enroll when the store says the product is already owned', async () => {
    rc.buyMonthly.mockRejectedValueOnce(Object.assign(new Error('owned'), { code: 6 }));

    const result = await purchaseAndEnroll();

    expect(result.ok).toBe(true);
    expect(rc.restorePurchases).toHaveBeenCalledTimes(1);
    expect(requestsTo('/v1/enroll')).toHaveLength(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports restore_failed when the already-owned restore throws', async () => {
    rc.buyMonthly.mockRejectedValueOnce(Object.assign(new Error('owned'), { code: '6' }));
    rc.restorePurchases.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 9 }));

    expect(await purchaseAndEnroll()).toEqual({ ok: false, failure: 'restore_failed' });
    expect(report).toHaveBeenCalledWith('restore', 'restore_failed', { storeErrorCode: '9' });
  });

  it('does not report a cancelled purchase', async () => {
    rc.buyMonthly.mockRejectedValueOnce(Object.assign(new Error('c'), { code: 1 }));

    expect(await purchaseAndEnroll()).toEqual({ ok: false, failure: 'purchase_cancelled' });
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a generic purchase error with its store error code', async () => {
    rc.buyMonthly.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 5 }));

    await purchaseAndEnroll();

    expect(report).toHaveBeenCalledWith('purchase', 'purchase_failed', { storeErrorCode: '5' });
  });

  it('reports a failed enroll with its HTTP status', async () => {
    fetchMock = workerFetch({
      'POST /v1/enroll': () => jsonResponse(403, { error: { code: 'subscription_required' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await purchaseAndEnroll();

    expect(result).toEqual({ ok: false, failure: 'subscription_required' });
    expect(report).toHaveBeenCalledWith('enroll', 'subscription_required', { status: 403 });
  });

  it('retries the enroll on subscription lag before succeeding', async () => {
    let attempts = 0;
    fetchMock = workerFetch({
      'POST /v1/enroll': () => {
        attempts += 1;

        return attempts < 2
          ? jsonResponse(409, { error: { code: 'subscription_required' } })
          : jsonResponse(200, grantBody());
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect((await purchaseAndEnroll()).ok).toBe(true);
    expect(requestsTo('/v1/enroll')).toHaveLength(2);
  });
});

describe('restoreAndEnroll', () => {
  it('restores, enrolls and saves the local state with removed false', async () => {
    const result = await restoreAndEnroll();

    expect(result.ok).toBe(true);
    expect(order.slice(0, 3)).toEqual(['key', 'configure', 'restore']);
    expect(await loadPremiumLocalState()).toMatchObject({ rcId: keys.rcId, removed: false });
    expect(stateOf()).toMatchObject({ rcId: keys.rcId, removed: false });
  });

  it('reports restore_failed when the store restore throws', async () => {
    rc.restorePurchases.mockRejectedValueOnce(new Error('nope'));

    expect(await restoreAndEnroll()).toEqual({ ok: false, failure: 'restore_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('without a Worker URL', () => {
  it('returns not_available with no side effects', async () => {
    delete process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL;

    expect(await purchaseAndEnroll()).toEqual({ ok: false, failure: 'not_available' });
    expect(await restoreAndEnroll()).toEqual({ ok: false, failure: 'not_available' });
    expect(await enrollThisDevice()).toEqual({ ok: false, failure: 'not_available' });
    expect(await refreshPremiumUsage()).toEqual({ ok: false, failure: 'not_available' });
    expect(await fetchPremiumConfig()).toEqual({ ok: false, failure: 'not_available' });

    expect(keyStore.getOrCreateDeviceKey).not.toHaveBeenCalled();
    expect(rc.configureRevenueCat).not.toHaveBeenCalled();
    expect(rc.buyMonthly).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(saved.size).toBe(0);
  });
});

describe('getSessionGrant', () => {
  it('is not_enrolled with no fetch when this device has not enrolled', async () => {
    expect(await getSessionGrant()).toEqual({ ok: false, failure: 'not_enrolled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not_enrolled with no fetch when the local rcId belongs to another key', async () => {
    await enrollThisDevice();
    keys = nextKeys;
    fetchMock.mockClear();

    expect(await getSessionGrant()).toEqual({ ok: false, failure: 'not_enrolled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reuses the cached token until five minutes before it expires, then mints a new one', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(NOW);

    await enrollThisDevice();
    fetchMock.mockClear();

    const expiresAt = NOW + HOUR;

    spy.mockReturnValue(expiresAt - 5 * 60_000 - 1);
    expect((await getSessionGrant()).ok).toBe(true);
    expect(requestsTo('/v1/session')).toHaveLength(0);

    spy.mockReturnValue(expiresAt - 5 * 60_000);
    expect((await getSessionGrant()).ok).toBe(true);
    expect(requestsTo('/v1/session')).toHaveLength(1);
  });

  it('shares one in-flight session request between concurrent callers', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await enrollThisDevice();
    fetchMock.mockClear();

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 2 * HOUR);

    const [a, b, c] = await Promise.all([getSessionGrant(), getSessionGrant(), getSessionGrant()]);

    expect(a.ok && b.ok && c.ok).toBe(true);
    expect(requestsTo('/v1/session')).toHaveLength(1);
    expect(requestsTo('/v1/challenge')).toHaveLength(1);
  });

  it('marks the device removed on unknown_device, and the next call fails with no fetch and no enroll', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await enrollThisDevice();

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 2 * HOUR);
    fetchMock = workerFetch({
      'POST /v1/session': () =>
        jsonResponse(401, { error: { code: 'unknown_device', message: SESSION_TOKEN } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await getSessionGrant()).toEqual({ ok: false, failure: 'unknown_device' });
    expect(stateOf()).toMatchObject({ removed: true });
    expect(await getPremiumStatus()).toBe('removed');

    fetchMock.mockClear();
    expect(await getSessionGrant()).toEqual({ ok: false, failure: 'unknown_device' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestsTo('/v1/enroll')).toHaveLength(0);
  });

  it('never leaks the session token in the failure it returns', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await enrollThisDevice();

    jest.spyOn(Date, 'now').mockReturnValue(NOW + 2 * HOUR);
    fetchMock = workerFetch({
      'POST /v1/session': () =>
        jsonResponse(401, { error: { code: 'unknown_device' }, session_token: SESSION_TOKEN }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await getSessionGrant();

    expect(JSON.stringify(result)).not.toContain(SESSION_TOKEN);
  });
});

describe('refreshPremiumUsage', () => {
  it('saves the usage into local state', async () => {
    await enrollThisDevice();

    const result = await refreshPremiumUsage();

    expect(result).toEqual({
      ok: true,
      value: {
        usedPct: 33,
        resetsAt: '2026-12-15T00:00:00.000Z',
        status: 'active',
        devices: { count: 1, max: 3 },
      },
    });
    expect(await loadPremiumLocalState()).toMatchObject({
      usedPct: 33,
      lastStatus: 'active',
      resetsAt: '2026-12-15T00:00:00.000Z',
      devices: { count: 1, max: 3 },
    });
  });

  it('retries once with a new token after a 401 unauthorized', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    await enrollThisDevice();
    fetchMock.mockClear();

    let usageCalls = 0;
    fetchMock = workerFetch({
      'GET /v1/usage': () => {
        usageCalls += 1;

        return usageCalls === 1
          ? jsonResponse(401, { error: { code: 'unauthorized' } })
          : jsonResponse(200, {
              status: 'exhausted',
              used_pct: 100,
              resets_at: '2026-12-15T00:00:00.000Z',
              devices: { count: 1, max: 3 },
            });
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshPremiumUsage();

    expect(result.ok).toBe(true);
    expect(requestsTo('/v1/session')).toHaveLength(1);

    const usages = requestsTo('/v1/usage');

    expect(usages).toHaveLength(2);
    expect(authOf(usages[0])).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(stateOf()).toMatchObject({ lastStatus: 'exhausted', usedPct: 100 });
  });

  it('does not retry a second time', async () => {
    await enrollThisDevice();
    fetchMock = workerFetch({
      'GET /v1/usage': () => jsonResponse(401, { error: { code: 'unauthorized' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await refreshPremiumUsage()).toEqual({
      ok: false,
      failure: 'unauthorized',
    });
    expect(requestsTo('/v1/usage')).toHaveLength(2);
  });

  it('marks the device removed when usage says unknown_device', async () => {
    await enrollThisDevice();
    fetchMock = workerFetch({
      'GET /v1/usage': () => jsonResponse(401, { error: { code: 'unknown_device' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await refreshPremiumUsage()).toEqual({ ok: false, failure: 'unknown_device' });
    expect(stateOf()).toMatchObject({ removed: true });
  });
});

describe('fetchPremiumConfig', () => {
  it('caches a good config for five minutes, so a burst of photos makes one request', async () => {
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(1_000_000);
    await fetchPremiumConfig();
    await fetchPremiumConfig();
    const configCalls = () =>
      fetchMock.mock.calls.filter(([url]: [string]) => String(url).endsWith('/v1/config')).length;

    expect(configCalls()).toBe(1);

    now.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1);
    await fetchPremiumConfig();

    expect(configCalls()).toBe(2);
    now.mockRestore();
  });

  it('parses the Worker config', async () => {
    expect(await fetchPremiumConfig()).toEqual({
      ok: true,
      value: {
        enabled: true,
        acceptingNew: true,
        visionEnabled: false,
        image: null,
        minAppVersion: null,
      },
    });
  });

  it('retries once after a 5xx, so a transient edge error is not reported', async () => {
    jest.useFakeTimers();
    let calls = 0;

    fetchMock = workerFetch({
      'GET /v1/config': () => {
        calls += 1;

        return calls === 1
          ? jsonResponse(504, { error: { code: 'gateway' } })
          : jsonResponse(200, {
              enabled: true,
              accepting_new: true,
              vision_enabled: false,
              image: null,
            });
      },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = fetchPremiumConfig();

    await jest.advanceTimersByTimeAsync(1000);

    expect(await pending).toMatchObject({ ok: true });
    expect(calls).toBe(2);
    expect(reportPremiumFailure).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('reports a config that keeps failing after the retry', async () => {
    jest.useFakeTimers();
    fetchMock = workerFetch({ 'GET /v1/config': () => jsonResponse(504, {}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const pending = fetchPremiumConfig();

    await jest.advanceTimersByTimeAsync(1000);

    expect(await pending).toEqual({ ok: false, failure: 'unavailable' });
    expect(reportPremiumFailure).toHaveBeenCalledWith('config', 'unavailable', { status: 504 });
    jest.useRealTimers();
  });

  it('reports invalid_response for a body that does not parse', async () => {
    fetchMock = workerFetch({ 'GET /v1/config': () => jsonResponse(200, { enabled: 'yes' }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(await fetchPremiumConfig()).toEqual({ ok: false, failure: 'invalid_response' });
  });
});

describe('getPremiumStatus', () => {
  it('is not_enrolled when there is no device key', async () => {
    keyStore.loadDeviceKeyInfo.mockResolvedValueOnce(null);

    expect(await getPremiumStatus()).toBe('not_enrolled');
  });

  it('is not_enrolled when the local state names another rcId', async () => {
    saved.set(
      PREMIUM_DEVICE_STATE,
      JSON.stringify({ ...EMPTY_PREMIUM_LOCAL_STATE, rcId: nextKeys.rcId, lastStatus: 'active' })
    );

    expect(await getPremiumStatus()).toBe('not_enrolled');
  });

  it('follows the local state once enrolled here', async () => {
    await enrollThisDevice();

    expect(await getPremiumStatus()).toBe('active');

    await refreshPremiumUsage();
    fetchMock = workerFetch({
      'GET /v1/usage': () =>
        jsonResponse(200, {
          status: 'revoked',
          used_pct: 0,
          resets_at: '2026-12-15T00:00:00.000Z',
          devices: { count: 1, max: 3 },
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await refreshPremiumUsage();

    expect(await getPremiumStatus()).toBe('revoked');
  });
});

describe('resetPremium', () => {
  beforeEach(async () => {
    await enrollThisDevice();
  });

  it('clears local state and switches to a new rcId, without logging RevenueCat in when none is configured', async () => {
    const result = await resetPremium();

    expect(result).toEqual({ rcId: nextKeys.rcId, revenueCatSwitched: false });
    expect(saved.has(PREMIUM_DEVICE_STATE)).toBe(false);
    expect(await loadPremiumLocalState()).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
    expect(rc.logInTo).not.toHaveBeenCalled();
    expect(await getPremiumStatus()).toBe('not_enrolled');
  });

  it('logs RevenueCat in to the new rcId when the SDK is configured', async () => {
    rc.getConfiguredAppUserId.mockReturnValue(keys.rcId);

    const result = await resetPremium();

    expect(rc.logInTo).toHaveBeenCalledWith(nextKeys.rcId);
    expect(result).toEqual({ rcId: nextKeys.rcId, revenueCatSwitched: true });
  });

  it('swallows a logInTo failure and still reports the new rcId', async () => {
    rc.getConfiguredAppUserId.mockReturnValue(keys.rcId);
    rc.logInTo.mockRejectedValueOnce(new Error('network'));

    await expect(resetPremium()).resolves.toEqual({
      rcId: nextKeys.rcId,
      revenueCatSwitched: false,
    });
    expect(await loadPremiumLocalState()).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
  });

  it('does not write the old id back when a reset happens during a purchase', async () => {
    let release: () => void = () => undefined;

    rc.buyMonthly.mockImplementationOnce(
      () => new Promise<void>((resolve) => (release = resolve)) as never
    );

    const pending = purchaseAndEnroll();

    await Promise.resolve();
    await resetPremium();
    release();
    await pending;

    expect(await loadPremiumLocalState()).toEqual(EMPTY_PREMIUM_LOCAL_STATE);
    expect(await getPremiumStatus()).toBe('not_enrolled');
  });
});

describe('the Worker URL scheme', () => {
  // Jest defines __DEV__ as true and read-only, so the production refusal of plain http is the
  // same expression with the flag false; here: https and the development http pass, others do not.
  it('accepts https and development http, refuses other schemes', () => {
    process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL = 'https://worker.example';
    expect(hostedAiBaseUrl()).toBe('https://worker.example');
    process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL = 'http://127.0.0.1:8787';
    expect(hostedAiBaseUrl()).toBe('http://127.0.0.1:8787');
    process.env.EXPO_PUBLIC_HOSTED_AI_BASE_URL = 'ftp://worker.example';
    expect(hostedAiBaseUrl()).toBeNull();
  });
});
