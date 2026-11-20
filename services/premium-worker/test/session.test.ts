import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  b64url,
  harness,
  highS,
  newDevice,
  sessionBody,
  sign,
  type TestDevice,
} from './fakes/device';
import { countingDb } from './fakes/countingDb';
import { wipe } from './fakes/seed';

beforeEach(() => wipe(env.DB));

const HOUR = 3_600_000;
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
const code = async (r: Response) => ((await json(r)).error as Json).code as string;

async function enrolled() {
  const h = harness();
  const d = newDevice();
  const sub = h.rc.addSubscription(d.rcId, { id: 'sub_main' });
  const first = await json(await h.enroll(d));
  h.rc.calls.listCustomerSubscriptions = 0;
  h.rc.calls.getSubscription = 0;
  h.rc.calls.listTransactions = 0;
  return { h, d, sub, token: first.session_token as string };
}

const total = (rc: { calls: Record<string, number> }) =>
  Object.values(rc.calls).reduce((a, b) => a + b, 0);

describe('session', () => {
  it('mints a token without a RevenueCat call while the cache is fresh (< 6 h)', async () => {
    const { h, d } = await enrolled();
    h.deps.advance(5 * HOUR);
    const res = await h.session(d);
    expect(res.status).toBe(200);
    const b = await json(res);
    expect(b.session_token).toMatch(/^v1\./);
    expect(b.devices).toEqual({ count: 1, max: 3 });
    expect(b.period.used_pct).toBe(0);
    expect(total(h.rc)).toBe(0);
  });

  it('re-verifies once when the cache is older than 6 h and refreshes verified_at', async () => {
    const { h, d } = await enrolled();
    h.deps.advance(7 * HOUR);
    expect((await h.session(d)).status).toBe(200);
    expect(h.rc.calls.getSubscription).toBe(1);
    const row = await env.DB.prepare('SELECT verified_at FROM devices').first<{
      verified_at: number;
    }>();
    expect(row!.verified_at).toBe(h.deps.now());
    h.deps.advance(HOUR);
    expect((await h.session(d)).status).toBe(200);
    expect(h.rc.calls.getSubscription).toBe(1);
  });

  it('RevenueCat unavailable: continues on a cache under 24 h, denies past it', async () => {
    const { h, d } = await enrolled();
    h.rc.unavailable = true;
    h.deps.advance(7 * HOUR);
    expect((await h.session(d)).status).toBe(200);
    h.deps.advance(18 * HOUR); // 25 h since verification
    const res = await h.session(d);
    expect(res.status).toBe(503);
    expect(await code(res)).toBe('entitlement_unavailable');
  });

  it('a device stays valid after RevenueCat moves the subscription to another id', async () => {
    const { h, d, sub } = await enrolled();
    h.rc.moveSubscription(sub.id, newDevice().rcId);
    h.deps.advance(7 * HOUR);
    const res = await h.session(d);
    expect(res.status).toBe(200);
    expect(h.rc.calls.getSubscription).toBe(1);
  });

  it('a refund revokes the period; /v1/usage then reports revoked', async () => {
    const { h, d, sub } = await enrolled();
    h.deps.advance(5 * HOUR + 50 * 60_000);
    const token = (await json(await h.session(d))).session_token as string; // cache still fresh
    h.rc.update(sub.id, { gives_access: false });
    h.deps.advance(15 * 60_000); // 6 h 05 min since verification, token still valid
    const res = await h.session(d);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('subscription_required');
    const p = await env.DB.prepare('SELECT status FROM periods').first<{ status: string }>();
    expect(p!.status).toBe('revoked');
    const verified = await env.DB.prepare('SELECT verified_at FROM devices').first<{
      verified_at: number;
    }>();
    expect(verified!.verified_at).toBeLessThan(h.deps.now() - 6 * HOUR);
    const u = await h.usage(token);
    expect(u.status).toBe(200);
    const b = await json(u);
    expect(b.status).toBe('revoked');
    expect(b.used_pct).toBe(100);
    expect(b.resets_at).toEqual(expect.any(String));
  });

  it('a lapsed subscription that RevenueCat no longer knows is 403', async () => {
    const { h, d, sub } = await enrolled();
    h.rc.remove(sub.id);
    h.deps.advance(7 * HOUR);
    expect((await h.session(d)).status).toBe(403);
  });

  it('a renewal after the period ended creates the next period through one re-verify', async () => {
    const { h, d, sub } = await enrolled();
    h.deps.advance(31 * 24 * HOUR);
    const now = h.deps.now();
    h.rc.setTransactions(sub.id, [
      h.rc.tx({ id: 'tx_old' }),
      h.rc.tx({
        id: 'tx_renewal',
        purchased_at: now - 24 * HOUR,
        expiration_date: now + 29 * 24 * HOUR,
      }),
    ]);
    const res = await h.session(d);
    expect(res.status).toBe(200);
    expect(
      (await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>())!.n
    ).toBe(2);
    expect(h.rc.calls.getSubscription).toBe(1);
  });

  describe('rejections', () => {
    it('an unknown device', async () => {
      const h = harness();
      const res = await h.session(newDevice());
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('unknown_device');
      expect(total(h.rc)).toBe(0);
    });

    it('a replay of the same session is stale_nonce', async () => {
      const { h, d } = await enrolled();
      const body = sessionBody(d, await h.nonce());
      expect((await h.post('/v1/session', body)).status).toBe(200);
      const again = await h.post('/v1/session', body);
      expect(again.status).toBe(401);
      expect(await code(again)).toBe('stale_nonce');
    });

    it('a nonce issued before the device last used one is stale', async () => {
      const { h, d } = await enrolled();
      const older = await h.nonce();
      expect((await h.session(d)).status).toBe(200);
      const res = await h.post('/v1/session', sessionBody(d, older));
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('stale_nonce');
    });

    it('two concurrent identical requests: exactly one 200', async () => {
      const { h, d } = await enrolled();
      const body = sessionBody(d, await h.nonce());
      const rs = await Promise.all([h.post('/v1/session', body), h.post('/v1/session', body)]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 401]);
    });

    const bad: [string, (d: TestDevice, n: string) => Record<string, string>, string][] = [
      [
        'an enroll signature replayed as session',
        (d, n) => ({ rc_id: d.rcId, nonce: n, signature: b64url(sign(d, 'enroll', n)) }),
        'bad_signature',
      ],
      [
        'another key',
        (d, n) => ({ ...sessionBody(newDevice(), n), rc_id: d.rcId }),
        'bad_signature',
      ],
      [
        'a high-S signature',
        (d, n) => ({ rc_id: d.rcId, nonce: n, signature: b64url(highS(sign(d, 'session', n))) }),
        'bad_signature',
      ],
      [
        'a forged nonce',
        (d, n) => sessionBody(d, n.slice(0, -2) + (n.endsWith('A') ? 'BB' : 'AA')),
        'stale_nonce',
      ],
    ];
    it.each(bad)('%s', async (_n, make, errCode) => {
      const { h, d } = await enrolled();
      const res = await h.post('/v1/session', make(d, await h.nonce()));
      expect(res.status).toBe(401);
      expect(await code(res)).toBe(errCode);
      expect(total(h.rc)).toBe(0);
    });

    it('a nonce older than 2 minutes', async () => {
      const { h, d } = await enrolled();
      const nonce = await h.nonce();
      h.deps.advance(121_000);
      const res = await h.post('/v1/session', sessionBody(d, nonce));
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('stale_nonce');
    });

    it('bad bodies are 400', async () => {
      const { h, d } = await enrolled();
      const res = await h.post('/v1/session', { rc_id: d.rcId, nonce: 'x' });
      expect(res.status).toBe(400);
    });
  });

  it('SESSION_HMAC_KEY_PREVIOUS still verifies nonces and tokens during rotation', async () => {
    const { h, d } = await enrolled();
    const old = env.SESSION_HMAC_KEY;
    const rotated = {
      SESSION_HMAC_KEY: 'rotated-session-hmac-key-0123456789abcdef',
      SESSION_HMAC_KEY_PREVIOUS: old,
    };
    const nonce = await h.nonce(); // minted under the old key
    const res = await h.post('/v1/session', sessionBody(d, nonce), rotated);
    expect(res.status).toBe(200);
    const token = (await json(res)).session_token as string; // minted under the new key
    expect((await h.usage(token, rotated)).status).toBe(200);
    // A token of the old key is accepted only while it is the previous key.
    const oldToken = (await json(await h.session(d))).session_token as string;
    expect((await h.usage(oldToken, rotated)).status).toBe(200);
    expect((await h.usage(oldToken, { SESSION_HMAC_KEY: rotated.SESSION_HMAC_KEY })).status).toBe(
      401
    );
  });

  it('kill switch: /v1/session is 503 hosted_disabled', async () => {
    const { h, d } = await enrolled();
    const res = await h.post('/v1/session', sessionBody(d, await h.nonce()), {
      HOSTED_AI_ENABLED: 'false',
    });
    expect(res.status).toBe(503);
    expect(await code(res)).toBe('hosted_disabled');
  });

  it('rows written per session mint (counted): one write', async () => {
    const { h, d } = await enrolled();
    const counting = countingDb(env.DB);
    const over = { DB: counting.db };
    counting.reset();
    const res = await h.post('/v1/session', sessionBody(d, await h.nonce(over)), over);
    expect(res.status).toBe(200);
    console.log(`SESSION rows_written=${counting.rowsWritten()} rows_read=${counting.rowsRead()}`);
    expect(counting.rowsWritten()).toBe(1);
  });

  it('logs hold no rc_id, nonce, token or signature', async () => {
    const { h, d, token } = await enrolled();
    const nonce = await h.nonce();
    const body = sessionBody(d, nonce);
    await h.post('/v1/session', body);
    await h.post('/v1/session', body); // a rejection line too
    await h.usage(token);
    const text = JSON.stringify(h.deps.logs);
    expect(h.deps.logs.length).toBeGreaterThan(2);
    for (const secret of [d.rcId, nonce, token, body.signature, b64url(d.publicKey)]) {
      expect(text).not.toContain(secret);
    }
    expect(h.deps.logs.some((l) => l.lineage_prefix && l.lineage_prefix.length === 8)).toBe(true);
  });
});
