import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { activeUpstream, resetUpstreamCache, UPSTREAM_CACHE_MS } from '../src/upstream/select';
import { makeCtx, testConfig, testDeps } from './fakes/ctx';
import { fakeOtari, OTARI_CONFIG } from './fakes/otari';
import { wipe } from './fakes/seed';

beforeEach(async () => {
  await wipe(env.DB);
  resetUpstreamCache();
});

const setToggle = (value: string) =>
  env.DB.prepare(
    "INSERT INTO meta (key, value) VALUES ('upstream', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(value)
    .run();

const full = () => {
  const deps = testDeps({ otari: fakeOtari({ kind: 'throw' }) });
  return {
    deps,
    ctx: makeCtx({
      config: testConfig({ otari: OTARI_CONFIG }),
      deps,
      env: { OTARI_API_KEY: 'k' },
    }),
  };
};

describe('activeUpstream', () => {
  it('no row means openrouter', async () => {
    expect(await activeUpstream(full().ctx)).toBe('openrouter');
  });

  it('otari on a fully configured Worker', async () => {
    await setToggle('otari');
    expect(await activeUpstream(full().ctx)).toBe('otari');
  });

  it.each(['openrouter', 'OTARI', 'gemini', ''])('%j means openrouter without a log', async (v) => {
    await setToggle(v);
    const { ctx, deps } = full();
    expect(await activeUpstream(ctx)).toBe('openrouter');
    expect(deps.logs).toEqual([]);
  });

  it('caches for 30 s and re-reads after', async () => {
    const { ctx, deps } = full();
    expect(await activeUpstream(ctx)).toBe('openrouter');
    await setToggle('otari');
    deps.advance(UPSTREAM_CACHE_MS - 1);
    expect(await activeUpstream(ctx)).toBe('openrouter');
    deps.advance(1);
    expect(await activeUpstream(ctx)).toBe('otari');
  });

  it.each([
    ['no otari config block', (c: ReturnType<typeof full>) => ({ ...c.ctx, config: testConfig() })],
    [
      'no OTARI_API_KEY',
      (c: ReturnType<typeof full>) => ({ ...c.ctx, env: { ...env, OTARI_API_KEY: '' } }),
    ],
    [
      'no Otari client',
      (c: ReturnType<typeof full>) => ({ ...c.ctx, deps: { ...c.deps, otari: null } }),
    ],
  ])('otari with %s falls back to openrouter and logs once per refresh', async (_n, mutate) => {
    await setToggle('otari');
    const c = full();
    const ctx = mutate(c);
    expect(await activeUpstream(ctx)).toBe('openrouter');
    expect(await activeUpstream(ctx)).toBe('openrouter'); // cached: no second log
    expect(c.deps.logs).toEqual([
      {
        route: 'upstream',
        status: 500,
        code: 'upstream_misconfigured',
        severity: 'high',
        upstream: 'openrouter',
      },
    ]);
    c.deps.advance(UPSTREAM_CACHE_MS);
    await activeUpstream(ctx);
    expect(c.deps.logs).toHaveLength(2);
  });

  it('a D1 error means openrouter and is not cached', async () => {
    await setToggle('otari');
    const { ctx } = full();
    const broken = new Proxy(env.DB, {
      get(t, p, r) {
        if (p === 'prepare')
          return () => {
            throw new Error('d1 down');
          };
        const v = Reflect.get(t, p, r);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    expect(await activeUpstream({ ...ctx, env: { ...env, OTARI_API_KEY: 'k', DB: broken } })).toBe(
      'openrouter'
    );
    expect(await activeUpstream(ctx)).toBe('otari'); // the next read worked
  });
});
