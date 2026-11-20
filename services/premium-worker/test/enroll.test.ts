import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  b64url,
  enrollBody,
  harness,
  highS,
  newDevice,
  sign,
  type TestDevice,
} from './fakes/device';
import { countingDb } from './fakes/countingDb';
import { DAY_MS, NOW } from './fakes/ctx';
import { wipe } from './fakes/seed';

beforeEach(() => wipe(env.DB));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
const code = async (r: Response) => ((await json(r)).error as Json).code as string;
const calls = (rc: { calls: Record<string, number> }) =>
  Object.values(rc.calls).reduce((a, b) => a + b, 0);

function setup(maxDevices?: number) {
  const h = harness(maxDevices);
  const d = newDevice();
  const sub = h.rc.addSubscription(d.rcId, { id: 'sub_main' });
  return { h, d, sub };
}

async function deviceStatus(rcId: string) {
  return (await env.DB.prepare('SELECT status, last_nonce_ts FROM devices WHERE rc_id = ?')
    .bind(rcId)
    .first<{ status: string; last_nonce_ts: number }>())!;
}

describe('enroll', () => {
  it('enrolls a device and returns a token, period and device count', async () => {
    const { h, d } = setup();
    const res = await h.enroll(d);
    expect(res.status).toBe(200);
    const b = await json(res);
    expect(b.session_token).toMatch(/^v1\./);
    expect(b.expires_at).toBe(new Date(h.deps.now() + 3_600_000).toISOString());
    expect(b.period).toEqual({ used_pct: 0, resets_at: new Date(NOW + 29 * DAY_MS).toISOString() });
    expect(b.devices).toEqual({ count: 1, max: 25 });
    expect(JSON.stringify(b)).not.toMatch(/_u"/);
    const p = await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>();
    expect(p!.n).toBe(1);
  });

  describe('fails before any RevenueCat call', () => {
    const cases: [
      string,
      (d: TestDevice, nonce: string) => Record<string, string>,
      number,
      string,
    ][] = [
      [
        'mismatched rc_id and key',
        (d, n) => ({ ...enrollBody(d, n), rc_id: newDevice().rcId }),
        400,
        'id_key_mismatch',
      ],
      [
        'a stolen rc_id with the attacker key',
        (d, n) => {
          const attacker = newDevice();
          return { ...enrollBody(attacker, n), rc_id: d.rcId };
        },
        400,
        'id_key_mismatch',
      ],
      [
        'a truncated key',
        (d, n) => ({ ...enrollBody(d, n), public_key: b64url(d.publicKey.slice(0, 64)) }),
        400,
        'id_key_mismatch',
      ],
      [
        'right key, wrong signature',
        (d, n) => ({
          ...enrollBody(d, n),
          signature: b64url(sign(newDevice(), 'enroll', n, d.rcId)),
        }),
        401,
        'bad_signature',
      ],
      [
        'a high-S signature',
        (d, n) => ({ ...enrollBody(d, n), signature: b64url(highS(sign(d, 'enroll', n))) }),
        401,
        'bad_signature',
      ],
      [
        'a session signature',
        (d, n) => ({ ...enrollBody(d, n), signature: b64url(sign(d, 'session', n)) }),
        401,
        'bad_signature',
      ],
      [
        'a wrong-length signature',
        (d, n) => ({ ...enrollBody(d, n), signature: b64url(sign(d, 'enroll', n).slice(0, 63)) }),
        401,
        'bad_signature',
      ],
      [
        'a forged nonce MAC',
        (d, n) => enrollBody(d, n.slice(0, -2) + (n.endsWith('A') ? 'BB' : 'AA')),
        401,
        'stale_nonce',
      ],
      ['a garbage nonce', (d) => enrollBody(d, 'not-a-nonce'), 401, 'stale_nonce'],
    ];
    it.each(cases)('%s', async (_n, make, status, errCode) => {
      const { h, d } = setup();
      const res = await h.post('/v1/enroll', make(d, await h.nonce()));
      expect(res.status).toBe(status);
      expect(await code(res)).toBe(errCode);
      expect(calls(h.rc)).toBe(0);
      expect(
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM devices').first<{ n: number }>())!.n
      ).toBe(0);
    });

    it('a nonce older than 2 minutes', async () => {
      const { h, d } = setup();
      const nonce = await h.nonce();
      h.deps.advance(121_000);
      const res = await h.post('/v1/enroll', enrollBody(d, nonce));
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('stale_nonce');
      expect(calls(h.rc)).toBe(0);
    });

    it('invalid request bodies name the field', async () => {
      const { h, d } = setup();
      const ok = enrollBody(d, await h.nonce());
      const bad: [unknown, string][] = [
        [{ ...ok, extra: 'x' }, 'extra'],
        [{ ...ok, nonce: 5 }, 'nonce'],
        [{ rc_id: ok.rc_id }, 'public_key'],
        [[], ''],
      ];
      for (const [body, path] of bad) {
        const res = await h.post('/v1/enroll', body);
        expect(res.status).toBe(400);
        expect(((await json(res)).error as Json).path).toBe(path);
      }
      const res = await h.call('/v1/enroll', { method: 'POST', body: '{nope' });
      expect(res.status).toBe(400);
      expect(calls(h.rc)).toBe(0);
    });
  });

  it('refuses an off-curve key whose rc_id matches it', async () => {
    const { h, d } = setup();
    const off = d.publicKey.slice();
    off[64]! ^= 1;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', off));
    const rcId = 'mlg1_' + [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
    const res = await h.post('/v1/enroll', {
      ...enrollBody(d, await h.nonce()),
      rc_id: rcId,
      public_key: b64url(off),
    });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('id_key_mismatch');
  });

  it('a replay of the same enroll is stale_nonce', async () => {
    const { h, d } = setup();
    const body = enrollBody(d, await h.nonce());
    expect((await h.post('/v1/enroll', body)).status).toBe(200);
    const again = await h.post('/v1/enroll', body);
    expect(again.status).toBe(401);
    expect(await code(again)).toBe('stale_nonce');
  });

  it('two concurrent identical enrolls: exactly one 200', async () => {
    const { h, d } = setup();
    const body = enrollBody(d, await h.nonce());
    const rs = await Promise.all([h.post('/v1/enroll', body), h.post('/v1/enroll', body)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  describe('subscription filters (through the endpoint)', () => {
    it('no subscription, or one owned by another customer id: 403', async () => {
      const h = harness();
      const d = newDevice();
      h.rc.addSubscription(newDevice().rcId, { id: 'sub_other' });
      const res = await h.enroll(d);
      expect(res.status).toBe(403);
      expect(await code(res)).toBe('subscription_required');
    });

    it.each([
      ['promotional store', { store: 'promotional' }],
      ['sandbox on the production config', { environment: 'sandbox' }],
      ['family shared', { ownership: 'family_shared' }],
      ['unknown product', { product_id: 'prod_other' }],
      ['no access', { gives_access: false }],
    ])('%s: 403 and nothing written', async (_n, over) => {
      const h = harness();
      const d = newDevice();
      h.rc.addSubscription(d.rcId, over);
      const res = await h.enroll(d);
      expect(res.status).toBe(403);
      expect(await code(res)).toBe('subscription_required');
      expect(h.rc.calls.listTransactions).toBe(0);
    });

    it('two qualifying subscriptions: 503', async () => {
      const { h, d } = setup();
      h.rc.addSubscription(d.rcId, { id: 'sub_second' });
      const res = await h.enroll(d);
      expect(res.status).toBe(503);
      expect(await code(res)).toBe('entitlement_unavailable');
    });

    it('RevenueCat unavailable: 503 and nothing written', async () => {
      const { h, d } = setup();
      h.rc.unavailable = true;
      const res = await h.enroll(d);
      expect(res.status).toBe(503);
      expect(await code(res)).toBe('entitlement_unavailable');
      for (const t of ['devices', 'periods'])
        expect(
          (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())!.n
        ).toBe(0);
    });

    it('a missing revenue figure: 403 revenue_unverified', async () => {
      const { h, d, sub } = setup();
      h.rc.setTransactions(sub.id, [h.rc.tx({ revenue_in_usd: null })]);
      const res = await h.enroll(d);
      expect(res.status).toBe(403);
      expect(await code(res)).toBe('revenue_unverified');
    });
  });

  describe('multi-device LRU (max_devices 3)', () => {
    async function enrollOn(h: ReturnType<typeof harness>, subId: string, d: TestDevice) {
      h.rc.moveSubscription(subId, d.rcId);
      return h.enroll(d);
    }

    it('the 4th enrollment revokes the least recently used; a recent session survives', async () => {
      const { h, d, sub } = setup(3);
      const [d2, d3, d4] = [newDevice(), newDevice(), newDevice()] as [
        TestDevice,
        TestDevice,
        TestDevice,
      ];
      const t1 = (await json(await h.enroll(d))).session_token as string;
      const r2 = await enrollOn(h, sub.id, d2);
      const b2 = await json(r2);
      expect(b2.devices.count).toBe(2);
      const t2 = b2.session_token as string;
      const r3 = await enrollOn(h, sub.id, d3);
      expect((await json(r3)).devices).toEqual({ count: 3, max: 3 });
      // d (the oldest enrollment) mints a session, so d2 becomes the least recently used.
      expect((await h.session(d)).status).toBe(200);
      const r4 = await enrollOn(h, sub.id, d4);
      expect(r4.status).toBe(200);
      expect((await json(r4)).devices).toEqual({ count: 3, max: 3 });
      expect((await deviceStatus(d.rcId)).status).toBe('active');
      expect((await deviceStatus(d2.rcId)).status).toBe('revoked');
      expect((await deviceStatus(d3.rcId)).status).toBe('active');
      expect((await deviceStatus(d4.rcId)).status).toBe('active');
      // The revoked device is unknown everywhere; the survivors keep working.
      const s2 = await h.session(d2);
      expect(s2.status).toBe(401);
      expect(await code(s2)).toBe('unknown_device');
      const u2 = await h.usage(t2);
      expect(u2.status).toBe(401);
      expect(await code(u2)).toBe('unknown_device');
      expect((await h.usage(t1)).status).toBe(200);
      // One period for all four devices.
      expect(
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>())!.n
      ).toBe(1);
    });

    it('a revoked device can enroll again and evicts the next least recently used', async () => {
      const { h, d, sub } = setup(3);
      const others = [newDevice(), newDevice(), newDevice()];
      await h.enroll(d);
      for (const o of others) await enrollOn(h, sub.id, o); // evicts d
      expect((await deviceStatus(d.rcId)).status).toBe('revoked');
      expect((await enrollOn(h, sub.id, d)).status).toBe(200);
      expect((await deviceStatus(d.rcId)).status).toBe('active');
      expect((await deviceStatus(others[0]!.rcId)).status).toBe('revoked');
    });
  });

  describe('billing identity (plan 13 row 3)', () => {
    it('two devices that both see the same payment share one period row', async () => {
      const { h, d, sub } = setup();
      const b = newDevice();
      await h.enroll(d);
      h.rc.moveSubscription(sub.id, b.rcId);
      expect((await h.enroll(b)).status).toBe(200);
      const periods = await env.DB.prepare('SELECT lineage_key FROM periods').all();
      expect(periods.results).toHaveLength(1);
      const devs = await env.DB.prepare('SELECT DISTINCT lineage_key FROM devices').all();
      expect(devs.results).toEqual(periods.results);
    });

    it('reinstall and restore (new key, subscription moved) continues the same row', async () => {
      const { h, d, sub } = setup();
      const first = await json(await h.enroll(d));
      await env.DB.prepare('UPDATE periods SET spent_u = early_cap_u / 4').run();
      const fresh = newDevice();
      h.rc.moveSubscription(sub.id, fresh.rcId);
      const again = await json(await h.enroll(fresh));
      expect(
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>())!.n
      ).toBe(1);
      expect(first.period.used_pct).toBe(0);
      const row = (await env.DB.prepare('SELECT spent_u, early_cap_u FROM periods').first<{
        spent_u: number;
        early_cap_u: number;
      }>())!;
      expect(again.period.used_pct).toBe(Math.ceil((100 * row.spent_u) / row.early_cap_u));
      expect(again.period.used_pct).toBeGreaterThan(0);
      expect(again.devices.count).toBe(2);
    });

    it('identity_conflict leaves no device row', async () => {
      const { h, d, sub } = setup();
      await h.enroll(d);
      // A second payment of the same lineage whose window overlaps the first by days.
      const e = newDevice();
      h.rc.moveSubscription(sub.id, e.rcId);
      h.rc.setTransactions(sub.id, [
        h.rc.tx({
          id: 'tx_overlap',
          purchased_at: NOW - 2 * DAY_MS,
          expiration_date: NOW + 28 * DAY_MS,
        }),
      ]);
      const res = await h.enroll(e);
      expect(res.status).toBe(503);
      expect(await code(res)).toBe('identity_conflict');
      expect(
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE rc_id = ?')
          .bind(e.rcId)
          .first<{ n: number }>())!.n
      ).toBe(0);
      expect(h.deps.logs.some((l) => l.code === 'identity_conflict' && l.severity === 'high')).toBe(
        true
      );
    });
  });

  it('rows written per enroll (counted)', async () => {
    const { h, d } = setup();
    const counting = countingDb(env.DB);
    const res = await h.post('/v1/enroll', enrollBody(d, await h.nonce({ DB: counting.db })), {
      DB: counting.db,
    });
    expect(res.status).toBe(200);
    console.log(`ENROLL rows_written=${counting.rowsWritten()} rows_read=${counting.rowsRead()}`);
    expect(counting.rowsWritten()).toBeGreaterThan(0);
    expect(counting.rowsWritten()).toBeLessThanOrEqual(12);
  });
});
