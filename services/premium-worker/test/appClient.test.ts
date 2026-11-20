// The app's premium client (utils/premium) driven against the real Worker handlers. The fetch
// adapter forwards every request into createApp with the injected fakes, so each flow runs the
// app's own challenge -> sign -> enroll/session code and the Worker's own checks.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { type Harness, harness, highS } from './fakes/device';
import { wipe } from './fakes/seed';
import {
  ENROLL_RETRY_DELAYS_MS,
  type FlowDeps,
  type FlowResult,
  enrollDevice,
  enrollWithRetry,
  mintSession,
  type Signer,
} from '../../../utils/premium/premiumFlows';
import {
  deriveRcId,
  generateDeviceKey,
  isLowS,
  signDeviceMessage,
} from '../../../utils/premium/deviceKeyCrypto';
import { type FetchLike, hostedConfig, hostedUsage } from '../../../utils/premium/hostedClient';
import { parseHostedConfig, parseUsage } from '../../../utils/premium/premiumState';

const BASE = 'https://worker.test';

beforeEach(() => wipe(env.DB));

type Dev = { secretKey: Uint8Array; publicKey: Uint8Array; rcId: string };
let seedCounter = 0;

/** A device key from a 48-byte seed that differs for every device in this file. */
function device(): Dev {
  seedCounter += 1;
  const { secretKey, publicKey } = generateDeviceKey(new Uint8Array(48).fill(seedCounter));
  return { secretKey, publicKey, rcId: deriveRcId(publicKey) };
}

/** Signs as `d`, recording every signature it produces when `seen` is given. */
function honest(d: Dev, seen?: Uint8Array[]): Signer {
  return async (purpose, nonce) => {
    const signature = signDeviceMessage(d.secretKey, purpose, d.rcId, nonce);
    seen?.push(signature);
    return { rcId: d.rcId, publicKey: d.publicKey, signature };
  };
}

/** Forwards app requests into the Worker; counts paths; can pin the nonce the challenge returns. */
function network(h: Harness) {
  const paths: string[] = [];
  const net: { fetch: FetchLike; paths: string[]; pinNonce: string | null } = {
    paths,
    pinNonce: null,
    fetch: async (url, init) => {
      const path = url.slice(BASE.length);
      paths.push(path);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path === '/v1/challenge' && net.pinNonce !== null) {
        return { status: 200, ok: true, json: async () => ({ nonce: net.pinNonce }) };
      }
      // Mirrors Harness.nonce(): strictly increasing nonces.
      if (method === 'GET' && path === '/v1/challenge') h.deps.advance(1);
      const res = await h.call(path, { method, headers: init?.headers, body: init?.body });
      return { status: res.status, ok: res.ok, json: () => res.json() };
    },
  };
  return net;
}

function flows(h: Harness, sign: Signer) {
  const net = network(h);
  const deps: FlowDeps = { baseUrl: BASE, fetch: net.fetch, sign };
  return { net, deps };
}

function value<T>(r: FlowResult<T>): T {
  if (!r.ok) throw new Error(`flow failed: ${r.failure} (${r.status})`);
  return r.value;
}

const countRows = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n;

describe('app client against the Worker', () => {
  it('1. enrolls with a seeded subscription and the usage reads back active', async () => {
    const h = harness();
    const d = device();
    h.rc.addSubscription(d.rcId, { id: 'sub_main' });
    const { net, deps } = flows(h, honest(d));
    const r = await enrollDevice(deps);
    expect(r.ok).toBe(true);
    const grant = value(r);
    expect(grant.sessionToken).toMatch(/^v1\./);
    expect(Number.isFinite(grant.expiresAtMs)).toBe(true);
    expect(grant.devices).toEqual({ count: 1, max: 3 });
    expect(grant.usedPct).toBe(0);
    const usage = await hostedUsage(BASE, grant.sessionToken, net.fetch);
    expect(usage.ok).toBe(true);
    expect(parseUsage(usage.body)).toMatchObject({
      status: 'active',
      devices: { count: 1, max: 3 },
    });
  });

  it('2. mints a new session after enrolling; a re-used nonce is stale_nonce', async () => {
    const h = harness();
    const d = device();
    h.rc.addSubscription(d.rcId, { id: 'sub_main' });
    const seen: string[] = [];
    const sign: Signer = async (purpose, nonce) => {
      seen.push(nonce);
      return honest(d)(purpose, nonce);
    };
    const { net, deps } = flows(h, sign);
    const first = value(await enrollDevice(deps));
    const minted = value(await mintSession(deps));
    expect(minted.sessionToken).not.toBe(first.sessionToken);
    expect(minted.sessionToken).toMatch(/^v1\./);
    // The Worker has now seen the nonce of the mint; the challenge hands it out again.
    net.pinNonce = seen[1] ?? null;
    expect(net.pinNonce).not.toBeNull();
    const replay = await mintSession(deps);
    expect(replay).toEqual({ ok: false, failure: 'stale_nonce', status: 401 });
  });

  it('3. another device key signing, or the wrong rc_id, is refused with the Worker kind', async () => {
    const h = harness();
    const d = device();
    const other = device();
    h.rc.addSubscription(d.rcId, { id: 'sub_main' });
    const foreignSig: Signer = async (purpose, nonce) => ({
      rcId: d.rcId,
      publicKey: d.publicKey,
      signature: signDeviceMessage(other.secretKey, purpose, d.rcId, nonce),
    });
    const wrongId: Signer = async (purpose, nonce) => ({
      rcId: other.rcId,
      publicKey: d.publicKey,
      signature: signDeviceMessage(d.secretKey, purpose, other.rcId, nonce),
    });
    const a = await enrollDevice(flows(h, foreignSig).deps);
    expect(a).toEqual({ ok: false, failure: 'bad_signature', status: 401 });
    const b = await enrollDevice(flows(h, wrongId).deps);
    expect(b).toEqual({ ok: false, failure: 'id_key_mismatch', status: 400 });
    expect(h.rc.calls.listCustomerSubscriptions).toBe(0);
    expect(await countRows('SELECT COUNT(*) AS n FROM devices')).toBe(0);
  });

  it('4. a high-S signature is refused, and every app signature is low-S', async () => {
    const h = harness();
    const d = device();
    h.rc.addSubscription(d.rcId, { id: 'sub_main' });
    const seen: Uint8Array[] = [];
    const high: Signer = async (purpose, nonce) => {
      const signature = highS(signDeviceMessage(d.secretKey, purpose, d.rcId, nonce));
      return { rcId: d.rcId, publicKey: d.publicKey, signature };
    };
    expect(await enrollDevice(flows(h, high).deps)).toEqual({
      ok: false,
      failure: 'bad_signature',
      status: 401,
    });
    // The app's own signer never emits high-S, so the same device enrolls and mints normally.
    const { deps } = flows(h, honest(d, seen));
    value(await enrollDevice(deps));
    value(await mintSession(deps));
    expect(seen).toHaveLength(2);
    expect(seen.every(isLowS)).toBe(true);
    expect(seen.map((s) => s.length)).toEqual([64, 64]);
    const sessionHigh = await mintSession(flows(h, high).deps);
    expect(sessionHigh).toEqual({ ok: false, failure: 'bad_signature', status: 401 });
  });

  it('5. the fourth device evicts the least recently used; its session is unknown_device', async () => {
    const h = harness();
    const [d1, d2, d3, d4] = [device(), device(), device(), device()];
    const sub = h.rc.addSubscription(d1.rcId, { id: 'sub_main' });
    value(await enrollDevice(flows(h, honest(d1)).deps));
    for (const d of [d2, d3]) {
      h.rc.moveSubscription(sub.id, d.rcId);
      expect(value(await enrollDevice(flows(h, honest(d)).deps)).devices.count).toBeGreaterThan(0);
    }
    h.rc.moveSubscription(sub.id, d4.rcId);
    const fourth = value(await enrollDevice(flows(h, honest(d4)).deps));
    expect(fourth.devices).toEqual({ count: 3, max: 3 });
    const evicted = await mintSession(flows(h, honest(d1)).deps);
    expect(evicted).toEqual({ ok: false, failure: 'unknown_device', status: 401 });
    expect(value(await mintSession(flows(h, honest(d4)).deps)).devices).toEqual({
      count: 3,
      max: 3,
    });
  });

  it('6. enrollWithRetry retries entitlement lag; gives up after 4 attempts; never retries other kinds', async () => {
    // Lag: no subscription at first, RevenueCat shows it after the first wait.
    const late = harness();
    const dLate = device();
    const lateSleeps: number[] = [];
    const lateDeps = flows(late, honest(dLate));
    const ok = await enrollWithRetry({
      ...lateDeps.deps,
      sleep: async (ms) => {
        lateSleeps.push(ms);
        if (lateSleeps.length === 1) late.rc.addSubscription(dLate.rcId, { id: 'sub_late' });
      },
    });
    expect(value(ok).devices).toEqual({ count: 1, max: 3 });
    expect(lateSleeps).toEqual([2000]);
    expect(lateDeps.net.paths.filter((p) => p === '/v1/enroll')).toHaveLength(2);

    // Never a subscription: 1 attempt + 3 waits with the documented delays.
    const never = harness();
    const dNever = device();
    const neverFlows = flows(never, honest(dNever));
    const neverSleeps: number[] = [];
    const gone = await enrollWithRetry({
      ...neverFlows.deps,
      sleep: async (ms) => {
        neverSleeps.push(ms);
      },
    });
    expect(gone).toEqual({ ok: false, failure: 'subscription_required', status: 403 });
    expect(neverSleeps).toEqual([2000, 4000, 8000]);
    expect(neverSleeps).toEqual([...ENROLL_RETRY_DELAYS_MS]);
    expect(neverFlows.net.paths.filter((p) => p === '/v1/enroll')).toHaveLength(4);

    // A non-lag failure ends at once.
    const wrong = harness();
    const dWrong = device();
    const other = device();
    wrong.rc.addSubscription(dWrong.rcId, { id: 'sub_wrong' });
    const wrongFlows = flows(wrong, async (purpose, nonce) => ({
      rcId: other.rcId,
      publicKey: dWrong.publicKey,
      signature: signDeviceMessage(dWrong.secretKey, purpose, other.rcId, nonce),
    }));
    const sleeps: number[] = [];
    const bad = await enrollWithRetry({
      ...wrongFlows.deps,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(bad).toEqual({ ok: false, failure: 'id_key_mismatch', status: 400 });
    expect(sleeps).toEqual([]);
    expect(wrongFlows.net.paths.filter((p) => p === '/v1/enroll')).toHaveLength(1);
  });

  it('7. a reinstall key on the same payment shares one period row and the same budget', async () => {
    const h = harness();
    const d1 = device();
    const d2 = device();
    const sub = h.rc.addSubscription(d1.rcId, { id: 'sub_main' });
    const first = value(await enrollDevice(flows(h, honest(d1)).deps));
    h.rc.moveSubscription(sub.id, d2.rcId);
    const second = value(await enrollDevice(flows(h, honest(d2)).deps));
    expect(await countRows('SELECT COUNT(*) AS n FROM periods')).toBe(1);
    expect(second.resetsAt).toBe(first.resetsAt);
    await env.DB.prepare('UPDATE periods SET spent_u = early_cap_u / 4').run();
    const net = network(h);
    const a = await hostedUsage(BASE, first.sessionToken, net.fetch);
    const b = await hostedUsage(BASE, second.sessionToken, net.fetch);
    const pa = parseUsage(a.body);
    const pb = parseUsage(b.body);
    expect(pa?.usedPct).toBeGreaterThan(0);
    expect(pb?.usedPct).toBe(pa?.usedPct);
  });

  it('8. hostedConfig reads the enabled config', async () => {
    const h = harness();
    const res = await hostedConfig(BASE, network(h).fetch);
    expect(res.ok).toBe(true);
    expect(parseHostedConfig(res.body)).toMatchObject({ enabled: true });
  });
});
