import { enforceRateLimit, limiterAddress } from '../src/limiter';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { harness, newDevice } from './fakes/device';
import { DAY_MS, NOW } from './fakes/ctx';
import { wipe } from './fakes/seed';

beforeEach(() => wipe(env.DB));

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
const code = async (r: Response) => ((await json(r)).error as Json).code as string;

async function enrolled() {
  const h = harness();
  const d = newDevice();
  h.rc.addSubscription(d.rcId, { id: 'sub_main' });
  const token = (await json(await h.enroll(d))).session_token as string;
  return { h, d, token };
}

describe('GET /v1/usage', () => {
  it('reports a percentage, resets_at and devices, never money', async () => {
    const { h, token } = await enrolled();
    await env.DB.prepare('UPDATE periods SET spent_u = early_cap_u / 2').run();
    const res = await h.usage(token);
    expect(res.status).toBe(200);
    const b = await json(res);
    const row = (await env.DB.prepare('SELECT spent_u, early_cap_u FROM periods').first<{
      spent_u: number;
      early_cap_u: number;
    }>())!;
    expect(b).toEqual({
      used_pct: Math.ceil((100 * row.spent_u) / row.early_cap_u),
      resets_at: new Date(NOW + 29 * DAY_MS).toISOString(),
      status: 'active',
      devices: { count: 1, max: 25 },
    });
    expect(Object.keys(b).some((k) => k.endsWith('_u'))).toBe(false);
    expect(JSON.stringify(b)).not.toMatch(/_u"/);
  });

  it('counts reserved amounts and reports exhausted at the cap', async () => {
    const { h, token } = await enrolled();
    await env.DB.prepare('UPDATE periods SET spent_u = early_cap_u - 10, reserved_u = 10').run();
    const b = await json(await h.usage(token));
    expect(b.status).toBe('exhausted');
    expect(b.used_pct).toBe(100);
  });

  it('a zero cap reads as 100', async () => {
    const { h, token } = await enrolled();
    await env.DB.prepare('UPDATE periods SET early_cap_u = 0, early_until = ?')
      .bind(NOW + 10 * DAY_MS)
      .run();
    const b = await json(await h.usage(token));
    expect(b.used_pct).toBe(100);
    expect(b.status).toBe('exhausted');
  });

  it('a revoked period reads revoked; no period at all is 403', async () => {
    const { h, token } = await enrolled();
    await env.DB.prepare(`UPDATE periods SET status = 'revoked'`).run();
    const b = await json(await h.usage(token));
    expect(b).toMatchObject({ status: 'revoked', used_pct: 100 });
    await env.DB.prepare('DELETE FROM periods').run();
    const res = await h.usage(token);
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('subscription_required');
  });

  describe('a period that ended while the token is still valid', () => {
    // The device's period ended a minute ago but the session token has not expired: usage used to
    // answer 403 here while chat (which re-verifies) kept working.
    async function expired() {
      const e = await enrolled();
      const now = e.h.deps.now();
      await env.DB.prepare('UPDATE periods SET period_end = ?1')
        .bind(now - 60_000)
        .run();
      return { ...e, now };
    }

    it('re-verifies with RevenueCat and reports the renewed period', async () => {
      const { h, token, now } = await expired();
      h.rc.setTransactions('sub_main', [
        h.rc.tx({ id: 'tx_old' }),
        h.rc.tx({
          id: 'tx_renewal',
          purchased_at: now - 60_000,
          expiration_date: now + 29 * DAY_MS,
        }),
      ]);
      const res = await h.usage(token);
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({
        used_pct: 0,
        resets_at: new Date(now + 29 * DAY_MS).toISOString(),
        status: 'active',
        devices: { count: 1, max: 25 },
      });
      expect(
        (await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>())!.n
      ).toBe(2);
    });

    it('a subscription RevenueCat no longer honours is still 403', async () => {
      const { h, token } = await expired();
      h.rc.remove('sub_main');
      const res = await h.usage(token);
      expect(res.status).toBe(403);
      expect(await code(res)).toBe('subscription_required');
    });

    it('RevenueCat being unreachable is 503 entitlement_unavailable, not a 403', async () => {
      const { h, token } = await expired();
      h.rc.unavailable = true;
      const res = await h.usage(token);
      expect(res.status).toBe(503);
      expect(await code(res)).toBe('entitlement_unavailable');
    });

    it('a live period never calls RevenueCat', async () => {
      const { h, token } = await enrolled();
      h.rc.calls.getSubscription = 0;
      expect((await h.usage(token)).status).toBe(200);
      expect(h.rc.calls.getSubscription).toBe(0);
    });
  });

  it('forged, malformed, missing and expired tokens are 401 unauthorized', async () => {
    const { h, token } = await enrolled();
    const forged = token.slice(0, -3) + (token.endsWith('AAA') ? 'BBB' : 'AAA');
    for (const t of [forged, 'v1.x.y', 'garbage']) {
      const res = await h.usage(t);
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('unauthorized');
    }
    const none = await h.call('/v1/usage');
    expect(none.status).toBe(401);
    h.deps.advance(61 * 60_000);
    const expired = await h.usage(token);
    expect(expired.status).toBe(401);
    expect(await code(expired)).toBe('unauthorized');
  });

  it('a nonce MAC is not a token', async () => {
    const { h } = await enrolled();
    const res = await h.usage(await h.nonce());
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/challenge', () => {
  it('returns a nonce and needs no database', async () => {
    const h = harness();
    const res = await h.call('/v1/challenge', undefined, { DB: undefined });
    expect(res.status).toBe(200);
    expect(((await json(res)).nonce as string).startsWith('n1.')).toBe(true);
  });

  it('the rate limiter refuses with 429 busy and never gets more than its own key', async () => {
    const h = harness();
    const keys: string[] = [];
    const RATE_LIMITER = {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: false };
      },
    };
    const res = await h.call(
      '/v1/challenge',
      { headers: { 'cf-connecting-ip': '203.0.113.9' } },
      { RATE_LIMITER }
    );
    expect(res.status).toBe(429);
    expect(await code(res)).toBe('busy');
    expect(keys).toEqual(['challenge:203.0.113.9']);
    expect(JSON.stringify(h.deps.logs)).not.toContain('203.0.113.9');
  });
});

describe('identity routes are rate limited too', () => {
  const limiter = (keys: string[]) => ({
    limit: async ({ key }: { key: string }) => {
      keys.push(key);
      return { success: false };
    },
  });

  it.each(['/v1/enroll', '/v1/session'])('%s answers 429 before reading the body', async (path) => {
    const h = harness();
    const keys: string[] = [];
    const res = await h.call(
      path,
      { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.9' }, body: '{}' },
      { RATE_LIMITER: limiter(keys) }
    );
    expect(res.status).toBe(429);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^(enroll|session):203\.0\.113\.9$/);
  });

  it.each(['production', 'staging'])('refuses a request with no address in %s', (workerEnv) => {
    const ctx = { env: { WORKER_ENV: workerEnv } } as unknown as Parameters<
      typeof limiterAddress
    >[1];
    expect(() => limiterAddress(new Request('https://x.test/'), ctx)).toThrow();
  });

  it('shares a fallback key only where nothing public can reach the Worker', () => {
    const ctx = { env: { WORKER_ENV: 'test' } } as unknown as Parameters<typeof limiterAddress>[1];
    expect(limiterAddress(new Request('https://x.test/'), ctx)).toBe('unknown');
  });
});

describe('rate limiter binding', () => {
  const ctxFor = (WORKER_ENV: string) => {
    const logs: unknown[] = [];
    const ctx = { env: { WORKER_ENV }, deps: { log: { log: (e: unknown) => logs.push(e) } } };
    return { ctx: ctx as unknown as Parameters<typeof enforceRateLimit>[0], logs };
  };

  it.each(['production', 'staging'])('a missing binding in %s fails closed', async (workerEnv) => {
    const { ctx, logs } = ctxFor(workerEnv);
    await expect(enforceRateLimit(ctx, 'k', 1)).rejects.toMatchObject({
      status: 503,
      code: 'hosted_disabled',
    });
    expect(JSON.stringify(logs)).toContain('rate_limiter');
  });

  it.each(['local', 'test'])('a missing binding in %s is allowed', async (workerEnv) => {
    await expect(enforceRateLimit(ctxFor(workerEnv).ctx, 'k', 1)).resolves.toBeUndefined();
  });
});

describe('GET /v1/config', () => {
  it('has the contract shape', async () => {
    const h = harness();
    const res = await h.call('/v1/config');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      enabled: true,
      accepting_new: true,
      vision_enabled: true,
      image: { maxPx: 1568, maxBytes: 400000, quality: 85 },
      minAppVersion: '2.17.0',
      reasoning_effort: true,
    });
  });

  it("accepting_new is false when meta says '0'", async () => {
    const h = harness();
    await env.DB.prepare(`INSERT INTO meta (key, value) VALUES ('accepting_new', '0')`).run();
    expect((await json(await h.call('/v1/config'))).accepting_new).toBe(false);
    await env.DB.prepare(`UPDATE meta SET value = '1' WHERE key = 'accepting_new'`).run();
    expect((await json(await h.call('/v1/config'))).accepting_new).toBe(true);
  });

  it('the kill switch disables it', async () => {
    const h = harness();
    const res = await h.call('/v1/config', undefined, { HOSTED_AI_ENABLED: 'false' });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      enabled: false,
      accepting_new: false,
      vision_enabled: false,
      image: null,
      minAppVersion: null,
      reasoning_effort: false,
    });
  });
});
