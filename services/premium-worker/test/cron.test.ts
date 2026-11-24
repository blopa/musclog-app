import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { isBreakerOpen } from '../src/breaker';
import { runDaily, runQuarterHourly } from '../src/cron';
import { reserve, settle, type ReserveInput } from '../src/ledger';
import type { OpenRouterClient, OpenRouterKeyInfo, ZdrEndpoint } from '../src/upstream/types';
import { makeCtx, testConfig, testDeps, throwingOpenRouter } from './fakes/ctx';
import { fakeOtari, OTARI_CONFIG, type FakeOtari } from './fakes/otari';
import { resetUpstreamCache } from '../src/upstream/select';
import { DAY, DAY_MS, NOW, getPeriod, seed, wipe } from './fakes/seed';

const db = env.DB;
beforeEach(async () => {
  await wipe(db);
});

const metaValue = async (key: string) =>
  (await db.prepare('SELECT value FROM meta WHERE key = ?1').bind(key).first<{ value: string }>())
    ?.value;

let n = 0;
const rin = (o: Partial<ReserveInput> = {}): ReserveInput => ({
  pk: 'pk1',
  id: 'req' + ++n,
  rc: 'rc1',
  bh: 'bh',
  r: 100,
  hold: 'h' + ++n,
  now: NOW,
  day: DAY,
  maxReq: 1000,
  maxInflight: 1000,
  ...o,
});

type ZdrFn = () => Promise<ZdrEndpoint[]>;
type KeyFn = () => Promise<OpenRouterKeyInfo>;
function fakeOpenRouter(o: { zdr?: ZdrFn; key?: KeyFn } = {}): OpenRouterClient & {
  zdrCalls: number;
} {
  const f = {
    ...throwingOpenRouter,
    zdrCalls: 0,
    listZdrEndpoints: () => {
      f.zdrCalls++;
      return (o.zdr ?? (async () => [endpoint()]))();
    },
    getKey: o.key ?? (async () => ({ usage: 0, limit: null, limit_remaining: null })),
  };
  return f;
}

const endpoint = (o: Partial<ZdrEndpoint> = {}): ZdrEndpoint => ({
  model_id: 'openai/gpt-6-luna',
  provider_name: 'Acme',
  tag: 'acme',
  pricing: { prompt: '0.0000001', completion: '0.0000005' },
  supported_parameters: ['structured_outputs', 'tools'],
  status: 0,
  safety_retention: false,
  ...o,
});

function setup(
  over: Parameters<typeof testConfig>[0] = {},
  or: ReturnType<typeof fakeOpenRouter> = fakeOpenRouter()
) {
  const deps = testDeps({ openrouter: or });
  return { ctx: makeCtx({ config: testConfig(over), deps }), deps, or };
}

describe('runQuarterHourly', () => {
  it('sweeps a stale hold', async () => {
    await seed(db);
    await reserve(db, rin({ r: 250, now: NOW - 20 * 60_000 }));
    const { ctx } = setup();
    await runQuarterHourly(ctx);
    expect(await getPeriod(db)).toMatchObject({ spent_u: 250, reserved_u: 0, inflight: 0 });
  });

  it('daily_full flips at the global max and reopens the next day', async () => {
    await seed(db);
    for (let k = 0; k < 3; k++) {
      const i = rin();
      await reserve(db, i);
      await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: 10, now: NOW, day: DAY });
    }
    const { ctx, deps } = setup({ limits: { global_max_requests_per_day: 3 } });
    await runQuarterHourly(ctx);
    expect(await metaValue('daily_full')).toBe('1');
    deps.advance(DAY_MS);
    await runQuarterHourly(ctx);
    expect(await metaValue('daily_full')).toBe('0');
  });

  it('global check: under the share the breaker stays closed, over it opens (global_spend)', async () => {
    // net 2_110_000 (cap 1_000_000). global_share .55, fee 1.055: limit used > 550/1055*net = 1_100_000
    await seed(db, { cap: 1_000_000 });
    await db
      .prepare('UPDATE periods SET spent_u = 1_100_000 WHERE payment_key = ?1')
      .bind('pk1')
      .run();
    const { ctx } = setup();
    await runQuarterHourly(ctx);
    expect(await isBreakerOpen(db)).toBe(false);
    await db.prepare('UPDATE periods SET reserved_u = 1 WHERE payment_key = ?1').bind('pk1').run();
    await runQuarterHourly(ctx);
    expect(await isBreakerOpen(db)).toBe(true);
    expect(await metaValue('breaker_reason')).toBe('global_spend');
  });

  it("a revoked period's proceeds count as 0 while its spend still counts", async () => {
    await seed(db, { pk: 'a', rc: 'rcA', cap: 1_000_000 });
    await seed(db, { pk: 'b', rc: 'rcB', cap: 1_000_000, status: 'revoked' });
    await db.prepare("UPDATE periods SET spent_u = 700_000 WHERE payment_key IN ('a','b')").run();
    // used 1_400_000 vs net(active) 2_110_000: limit 1_100_000, so over
    const { ctx } = setup();
    await runQuarterHourly(ctx);
    expect(await isBreakerOpen(db)).toBe(true);
    // same spend with both active: 1_400_000 vs 4_220_000 -> under
    await db.prepare('DELETE FROM meta').run();
    await db.prepare("UPDATE periods SET status = 'active'").run();
    await runQuarterHourly(ctx);
    expect(await isBreakerOpen(db)).toBe(false);
  });

  it('ignores periods that ended more than a day ago', async () => {
    await seed(db, { pk: 'old', end: NOW - DAY_MS - 1 });
    await db.prepare("UPDATE periods SET spent_u = 5_000_000 WHERE payment_key = 'old'").run();
    await runQuarterHourly(setup().ctx);
    expect(await isBreakerOpen(db)).toBe(false);
  });

  it('one failing step does not skip the others and logs content-free', async () => {
    await seed(db);
    const { ctx, deps } = setup();
    const broken: D1Database = new Proxy(env.DB, {
      get(t, p, r) {
        if (p === 'prepare') {
          return (sql: string) => {
            if (sql.includes('FROM periods WHERE period_end > ?1 AND reserved_u > 0'))
              throw new Error('boom');
            return t.prepare(sql);
          };
        }
        const v = Reflect.get(t, p, r);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    await runQuarterHourly({ ...ctx, env: { ...env, DB: broken } });
    expect(deps.logs).toContainEqual({
      route: 'cron',
      status: 500,
      code: 'sweep_failed',
      severity: 'error',
    });
    expect(await metaValue('daily_full')).toBe('0'); // the next step still ran
  });
});

describe('runDaily', () => {
  it('prune deletes old rows', async () => {
    await seed(db, { pk: 'old', rc: 'rcO', start: NOW - 90 * DAY_MS, end: NOW - 61 * DAY_MS });
    await seed(db, { pk: 'live' });
    await runDaily(setup().ctx);
    const ps = await db.prepare('SELECT payment_key FROM periods').all<{ payment_key: string }>();
    expect(ps.results.map((p) => p.payment_key)).toEqual(['live']);
  });

  it('accepting_new flips at max_subscribers and back', async () => {
    await seed(db, { pk: 'a', rc: 'rcA' });
    const { ctx } = setup({ limits: { max_subscribers: 2 } });
    await runDaily(ctx);
    expect(await metaValue('accepting_new')).toBe('1');
    await seed(db, { pk: 'b', rc: 'rcB' });
    // a second period of lineage a does not add a subscriber
    await seed(db, { pk: 'a2', rc: 'rcA2', lineage: 'lin-a' });
    await runDaily(ctx);
    expect(await metaValue('accepting_new')).toBe('0');
    await db.prepare("UPDATE periods SET status = 'revoked' WHERE payment_key = 'b'").run();
    await runDaily(ctx);
    expect(await metaValue('accepting_new')).toBe('1');
  });

  describe('ZDR re-check', () => {
    const run = async (zdr: ZdrFn, over: Parameters<typeof testConfig>[0] = {}) => {
      const s = setup(over, fakeOpenRouter({ zdr }));
      await runDaily(s.ctx);
      return s;
    };
    it('an eligible endpoint keeps the breaker closed', async () => {
      await run(async () => [endpoint()]);
      expect(await isBreakerOpen(db)).toBe(false);
    });
    it('safety_retention true opens zdr_unavailable', async () => {
      const { deps } = await run(async () => [endpoint({ safety_retention: true })]);
      expect(await isBreakerOpen(db)).toBe(true);
      expect(await metaValue('breaker_reason')).toBe('zdr_unavailable');
      expect(deps.logs.some((l) => l.severity === 'high')).toBe(true);
    });
    it('an endpoint for another model does not count', async () => {
      await run(async () => [endpoint({ model_id: 'other/model' })]);
      expect(await metaValue('breaker_reason')).toBe('zdr_unavailable');
    });
    it('a price above the pinned one opens it; a missing price too', async () => {
      await run(async () => [
        endpoint({ pricing: { prompt: '0.0000002', completion: '0.0000005' } }),
      ]);
      expect(await isBreakerOpen(db)).toBe(true);
      await wipe(db);
      await run(async () => [endpoint({ pricing: { prompt: '0.0000001' } })]);
      expect(await isBreakerOpen(db)).toBe(true);
      await wipe(db);
      await run(async () => [endpoint({ pricing: { prompt: 'abc', completion: '0.0000005' } })]);
      expect(await isBreakerOpen(db)).toBe(true);
    });
    it('a price at or below the pinned one is fine (numbers too)', async () => {
      await run(async () => [endpoint({ pricing: { prompt: 1e-7, completion: 4e-7 } })]);
      expect(await isBreakerOpen(db)).toBe(false);
    });
    it('status other than 0 opens it', async () => {
      await run(async () => [endpoint({ status: -1 })]);
      expect(await metaValue('breaker_reason')).toBe('zdr_unavailable');
    });
    it('missing structured_outputs opens it', async () => {
      await run(async () => [endpoint({ supported_parameters: ['tools'] })]);
      expect(await isBreakerOpen(db)).toBe(true);
    });
    it('provider.only that excludes the only endpoint opens it; including its tag keeps it closed', async () => {
      await run(async () => [endpoint()], { provider: { only: ['other'] } });
      expect(await isBreakerOpen(db)).toBe(true);
      await wipe(db);
      await run(async () => [endpoint()], { provider: { only: ['acme'] } });
      expect(await isBreakerOpen(db)).toBe(false);
      await run(async () => [endpoint()], { provider: { only: ['Acme'] } });
      expect(await isBreakerOpen(db)).toBe(false);
    });
    it('three failed fetches open zdr_check_failed after sleeping twice', async () => {
      const { deps, or } = await run(async () => {
        throw new Error('down');
      });
      expect(or.zdrCalls).toBe(3);
      expect(deps.sleeps).toEqual([2000, 4000]);
      expect(await metaValue('breaker_reason')).toBe('zdr_check_failed');
    });
    it('two failures then success keeps it closed', async () => {
      let k = 0;
      const { or } = await run(async () => {
        if (++k < 3) throw new Error('down');
        return [endpoint()];
      });
      expect(or.zdrCalls).toBe(3);
      expect(await isBreakerOpen(db)).toBe(false);
    });
  });

  describe('reconciliation by cumulative delta', () => {
    const withUsage = (usage: number) =>
      setup(
        {},
        fakeOpenRouter({ key: async () => ({ usage, limit: null, limit_remaining: null }) })
      );
    const settleAt = async (amount: number, at: number) => {
      await seed(db, { cap: 5_000_000 });
      const i = rin({ r: amount, now: at });
      await reserve(db, i);
      await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: amount, now: at, day: DAY });
    };
    it('the first run stores the baseline and stops', async () => {
      await runDaily(withUsage(12.5).ctx);
      expect(JSON.parse((await metaValue('recon'))!)).toEqual({ usage_u: 12_500_000, at: NOW });
      expect(await isBreakerOpen(db)).toBe(false);
    });
    it('a delta within tolerance stays closed and moves the baseline', async () => {
      await runDaily(withUsage(10).ctx);
      const later = withUsage(10.6);
      later.deps.advance(DAY_MS);
      await settleAt(600_000, NOW + 1000); // ledger 600_000, delta 600_000
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(false);
      expect(JSON.parse((await metaValue('recon'))!)).toEqual({
        usage_u: 10_600_000,
        at: NOW + DAY_MS,
      });
    });
    it('an unmetered gap opens reconciliation', async () => {
      await runDaily(withUsage(10).ctx);
      const later = withUsage(11.5);
      later.deps.advance(DAY_MS);
      await settleAt(600_000, NOW + 1000); // gap 900_000 > 0.03*600_000 + 500_000
      await runDaily(later.ctx);
      expect(await metaValue('breaker_reason')).toBe('reconciliation');
      expect(later.deps.logs.some((l) => l.severity === 'high')).toBe(true);
      expect(JSON.parse((await metaValue('recon'))!).usage_u).toBe(11_500_000);
    });
    it('settled rows outside the window do not count as ledger', async () => {
      await runDaily(withUsage(10).ctx);
      const later = withUsage(10.6);
      later.deps.advance(DAY_MS);
      await settleAt(600_000, NOW - 1000); // before the baseline: not in this window
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(true); // delta 600_000 > 0 + 500_000
    });
    it('a negative delta re-baselines with a high log and no breaker', async () => {
      await runDaily(withUsage(10).ctx);
      const later = withUsage(2);
      later.deps.advance(DAY_MS);
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(false);
      expect(JSON.parse((await metaValue('recon'))!)).toEqual({
        usage_u: 2_000_000,
        at: NOW + DAY_MS,
      });
      expect(later.deps.logs.some((l) => l.severity === 'high')).toBe(true);
    });
    it('a getKey failure leaves the baseline and the breaker alone, other steps still run', async () => {
      await runDaily(withUsage(10).ctx);
      const failing = setup(
        {},
        fakeOpenRouter({
          key: async () => {
            throw new Error('down');
          },
        })
      );
      failing.deps.advance(DAY_MS);
      await seed(db, { pk: 'x', rc: 'rcX' });
      await runDaily(failing.ctx);
      expect(JSON.parse((await metaValue('recon'))!)).toEqual({ usage_u: 10_000_000, at: NOW });
      expect(await isBreakerOpen(db)).toBe(false);
      expect(failing.deps.logs).toContainEqual({
        route: 'cron',
        status: 500,
        code: 'reconciliation_failed',
        severity: 'error',
      });
      expect(await metaValue('accepting_new')).toBe('1');
    });
  });

  describe('with Otari', () => {
    const withBoth = (o: { usage: number; otari?: FakeOtari | null; toggle?: 'otari' }) => {
      const or = fakeOpenRouter({
        key: async () => ({ usage: o.usage, limit: null, limit_remaining: null }),
      });
      const deps = testDeps({
        openrouter: or,
        otari: o.otari === undefined ? fakeOtari({ kind: 'throw' }) : o.otari,
      });
      return {
        deps,
        or,
        ctx: makeCtx({
          config: testConfig({ otari: OTARI_CONFIG }),
          deps,
          env: { OTARI_API_KEY: 'k' },
        }),
      };
    };
    const useToggle = async () => {
      await db.prepare("INSERT INTO meta (key, value) VALUES ('upstream', 'otari')").run();
      resetUpstreamCache();
    };
    const settleAt = async (amount: number, at: number) => {
      await seed(db, { cap: 5_000_000 });
      const i = rin({ r: amount, now: at });
      await reserve(db, i);
      await settle(db, { pk: 'pk1', id: i.id, final: 'settled', a: amount, now: at, day: DAY });
    };
    /** A baseline run, then a second run a day later against `later`. */
    const twoRuns = async (later: ReturnType<typeof withBoth>, firstUsage = 10) => {
      await runDaily(withBoth({ usage: firstUsage }).ctx);
      later.deps.advance(DAY_MS);
      return later;
    };

    it('the gateway delta is OpenRouter plus Otari, compared with the whole ledger', async () => {
      const ot = fakeOtari({ kind: 'throw' });
      ot.summary = { costUsd: 0.4, requests: 5, errors: 0, unpriced: 0 };
      const later = await twoRuns(withBoth({ usage: 10.6, otari: ot }));
      await settleAt(1_000_000, NOW + 1000); // OpenRouter 600_000 + Otari 400_000 = ledger
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(false);
      expect(ot.summaryCalls).toEqual([{ startMs: NOW, endMs: NOW + DAY_MS }]);
      expect(JSON.parse((await metaValue('recon'))!).usage_u).toBe(10_600_000);
    });

    it('Otari spend the ledger never saw opens reconciliation', async () => {
      const ot = fakeOtari({ kind: 'throw' });
      ot.summary = { costUsd: 2, requests: 5, errors: 0, unpriced: 0 };
      const later = await twoRuns(withBoth({ usage: 10.6, otari: ot }));
      await settleAt(600_000, NOW + 1000); // ledger = OpenRouter alone; Otari 2 USD is the gap
      await runDaily(later.ctx);
      expect(await metaValue('breaker_reason')).toBe('reconciliation');
    });

    it('a failing Otari call counts 0, logs high and cannot open the breaker', async () => {
      const ot = fakeOtari({ kind: 'throw' });
      ot.summary = new Error('otari_http_500');
      const later = await twoRuns(withBoth({ usage: 10.6, otari: ot }));
      await settleAt(600_000, NOW + 1000);
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(false);
      expect(later.deps.logs).toContainEqual({
        route: 'cron',
        status: 500,
        code: 'reconciliation_otari_unavailable',
        severity: 'high',
        upstream: 'otari',
      });
    });

    it('unpriced Otari requests are logged high', async () => {
      const ot = fakeOtari({ kind: 'throw' });
      ot.summary = { costUsd: 0, requests: 2, errors: 0, unpriced: 2 };
      const later = await twoRuns(withBoth({ usage: 10, otari: ot }));
      await runDaily(later.ctx);
      expect(later.deps.logs).toContainEqual(
        expect.objectContaining({ code: 'otari_unpriced_requests', severity: 'high' })
      );
    });

    it('no Otari client means the OpenRouter-only logic and no Otari call', async () => {
      const later = await twoRuns(withBoth({ usage: 10.6, otari: null }));
      await settleAt(600_000, NOW + 1000);
      await runDaily(later.ctx);
      expect(await isBreakerOpen(db)).toBe(false);
    });

    it('the ZDR re-check is skipped while Otari is the active upstream, and runs on OpenRouter', async () => {
      await useToggle();
      const a = withBoth({ usage: 1 });
      let zdrCalls = 0;
      a.or.listZdrEndpoints = async () => {
        zdrCalls++;
        return [];
      };
      await runDaily(a.ctx);
      expect(zdrCalls).toBe(0);
      expect(await isBreakerOpen(db)).toBe(false);
      await db.prepare("UPDATE meta SET value = 'openrouter' WHERE key = 'upstream'").run();
      resetUpstreamCache();
      await runDaily(a.ctx);
      expect(zdrCalls).toBe(1); // an empty list opens zdr_unavailable
      expect(await metaValue('breaker_reason')).toBe('zdr_unavailable');
    });

    describe('otari_budget', () => {
      const run = async (b: FakeOtari['budgetResult']) => {
        const ot = fakeOtari({ kind: 'throw' });
        ot.budgetResult = b;
        const s = withBoth({ usage: 1, otari: ot });
        await runDaily(s.ctx);
        return { ...s, ot };
      };
      it('warns high below 2 USD', async () => {
        const { deps } = await run({ enforced: true, remainingUsd: 1.99 });
        expect(deps.logs).toContainEqual({
          route: 'cron',
          status: 500,
          code: 'otari_budget_low',
          severity: 'high',
          upstream: 'otari',
        });
      });
      it('stays quiet at 2 USD, with no limit, and without a client', async () => {
        for (const b of [
          { enforced: true, remainingUsd: 2 },
          { enforced: false, remainingUsd: null },
        ]) {
          const { deps } = await run(b);
          expect(deps.logs.some((l) => l.code === 'otari_budget_low')).toBe(false);
        }
        const none = withBoth({ usage: 1, otari: null });
        await runDaily(none.ctx);
        expect(none.deps.logs.some((l) => l.code === 'otari_budget_low')).toBe(false);
      });
      it('a failing call is isolated: logged as a failed step, the others still run', async () => {
        const { deps } = await run(new Error('otari_http_500'));
        expect(deps.logs).toContainEqual({
          route: 'cron',
          status: 500,
          code: 'otari_budget_failed',
          severity: 'error',
        });
        expect(deps.logs).toContainEqual(expect.objectContaining({ code: 'daily' }));
      });
    });
  });
});
