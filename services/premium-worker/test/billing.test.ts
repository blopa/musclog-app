import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  assertPeriodExists,
  ensurePeriod,
  preparePeriod,
  reverifySubscription,
} from '../src/billing/periods';
import {
  coveringTransaction,
  isFirstTransaction,
  lineageKey,
  paymentKey,
  qualifies,
  selectEnrollSubscription,
} from '../src/billing/subscription';
import { computePeriodCaps } from '../src/finance';
import { RevenueCatUnavailableError } from '../src/upstream/types';
import { DAY_MS, NOW, makeCtx, testConfig, testDeps } from './fakes/ctx';
import { fakeRevenueCat } from './fakes/revenuecat';

const HOUR = 3_600_000;
const config = testConfig();

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM periods').run();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function rows(): Promise<[Row, ...Row[]]> {
  return (await env.DB.prepare('SELECT * FROM periods').all()).results as [Row, ...Row[]];
}

describe('enroll filters', () => {
  const rc = fakeRevenueCat();
  const good = rc.sub('rc1');
  const q = (over: object, cfg = config) =>
    qualifies({ ...good, ...over }, { rcId: 'rc1', config: cfg, checkCustomer: true });

  it('accepts a qualifying subscription', () => expect(q({})).toBe(true));
  it.each([
    ['customer mismatch', { customer_id: 'other' }],
    ['promotional store', { store: 'promotional' }],
    ['test_store', { store: 'test_store' }],
    ['family_shared', { ownership: 'family_shared' }],
    ['unknown product', { product_id: 'prod_other' }],
    ['null product', { product_id: null }],
    ['no access', { gives_access: false }],
  ])('refuses %s', (_n, over) => expect(q(over)).toBe(false));

  it('refuses sandbox under a production-only config, accepts it otherwise', () => {
    const both = testConfig({ revenuecat: { environments: ['sandbox', 'production'] } });
    expect(q({ environment: 'sandbox' })).toBe(false);
    expect(q({ environment: 'sandbox' }, both)).toBe(true);
  });

  it('ignores customer when checkCustomer is false', () => {
    expect(qualifies({ ...good, customer_id: 'x' }, { config, checkCustomer: false })).toBe(true);
  });

  it('selects exactly one, 403 for none, 503 for several', () => {
    const a = rc.sub('rc1');
    const b = rc.sub('rc1');
    expect(selectEnrollSubscription([a], 'rc1', config)).toEqual({ ok: true, sub: a });
    expect(selectEnrollSubscription([], 'rc1', config)).toEqual({
      ok: false,
      status: 403,
      code: 'subscription_required',
    });
    expect(selectEnrollSubscription([a, b], 'rc1', config)).toEqual({
      ok: false,
      status: 503,
      code: 'entitlement_unavailable',
    });
  });
});

describe('coveringTransaction', () => {
  const t = (id: string, p: number, e: number | null) => ({
    id,
    purchased_at: p,
    expiration_date: e,
    revenue_in_usd: null,
  });
  it('boundaries', () => {
    const x = t('a', 100, 200);
    expect(coveringTransaction([x], 100, 0)).toBe(x);
    expect(coveringTransaction([x], 99, 0)).toBeNull();
    expect(coveringTransaction([x], 200, 0)).toBeNull();
    expect(coveringTransaction([x], 200, 10)).toBe(x);
    expect(coveringTransaction([x], 209, 10)).toBe(x);
    expect(coveringTransaction([x], 210, 10)).toBeNull();
  });
  it('latest purchase wins; null expiration never covers', () => {
    const a = t('a', 100, 300);
    const b = t('b', 150, 300);
    expect(coveringTransaction([a, b], 200, 0)).toBe(b);
    expect(coveringTransaction([t('n', 100, null)], 200, 0)).toBeNull();
  });
  it('isFirstTransaction', () => {
    const a = t('a', 100, 200);
    const b = t('b', 200, 300);
    expect(isFirstTransaction([a, b], a)).toBe(true);
    expect(isFirstTransaction([a, b], b)).toBe(false);
    expect(isFirstTransaction([t('z', 100, 1), t('y', 100, 1)], t('y', 100, 1))).toBe(true);
  });
  it('keys are stable sha256 hex', async () => {
    expect(await paymentKey('play_store', 'tx')).toMatch(/^[0-9a-f]{64}$/);
    expect(await paymentKey('play_store', 'tx')).not.toBe(await lineageKey('app_store', 'tx'));
  });
});

describe('billing identity', () => {
  function setup() {
    const rc = fakeRevenueCat();
    const deps = testDeps({ revenuecat: rc });
    return { rc, deps, ctx: makeCtx({ deps }) };
  }

  it('same payment from two rc_ids gives one row; first period has early_until', async () => {
    const { rc, ctx } = setup();
    const tx = rc.tx({ id: 'tx_a' });
    const s1 = rc.addSubscription('rc1', { id: 'sub_a' }, [tx]);
    const a = await ensurePeriod(ctx, s1, [tx], NOW);
    rc.moveSubscription('sub_a', 'rc2'); // reinstall / restore: new rc_id, same payment
    const b = await ensurePeriod(ctx, { ...s1, customer_id: 'rc2' }, [tx], NOW);
    expect(b).toEqual(a);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].early_until).toBe(tx.purchased_at + 3 * DAY_MS);
  });

  it('a renewal creates a new row with a new budget and no early window', async () => {
    const { rc, ctx } = setup();
    const t1 = rc.tx({ id: 't1', purchased_at: NOW - 31 * DAY_MS, expiration_date: NOW - DAY_MS });
    const t2 = rc.tx({ id: 't2', purchased_at: NOW - DAY_MS, expiration_date: NOW + 29 * DAY_MS });
    const s = rc.addSubscription('rc1', { id: 'sub_r' }, [t1, t2]);
    await ensurePeriod(ctx, s, [t1, t2], NOW - 15 * DAY_MS);
    await ensurePeriod(ctx, s, [t1, t2], NOW);
    const r = (await rows()).sort((a, b) => a.period_start - b.period_start);
    expect(r).toHaveLength(2);
    expect(r[0].early_until).toBe(t1.purchased_at + 3 * DAY_MS);
    expect(r[1]!.early_until).toBe(0);
    expect(r[1]!.spent_u).toBe(0);
  });

  async function overlapCase(overlapMs: number) {
    const { rc, deps, ctx } = setup();
    const t1 = rc.tx({
      id: 'o1',
      purchased_at: NOW - 10 * DAY_MS,
      expiration_date: NOW + overlapMs,
    });
    const t2 = rc.tx({ id: 'o2', purchased_at: NOW, expiration_date: NOW + 30 * DAY_MS });
    const s = rc.addSubscription('rc1', { id: 'sub_o' }, [t1]);
    await ensurePeriod(ctx, s, [t1], NOW - DAY_MS);
    return { ctx, deps, s, t2 };
  }

  it('overlap above 1 h is an identity conflict, no row, high log', async () => {
    const { ctx, deps, s, t2 } = await overlapCase(HOUR + 1);
    await expect(ensurePeriod(ctx, s, [t2], NOW)).rejects.toMatchObject({
      status: 503,
      code: 'identity_conflict',
    });
    expect(await rows()).toHaveLength(1);
    expect(deps.logs.some((l) => l.code === 'identity_conflict' && l.severity === 'high')).toBe(
      true
    );
  });

  it('overlap of exactly 1 h is allowed', async () => {
    const { ctx, s, t2 } = await overlapCase(HOUR);
    await ensurePeriod(ctx, s, [t2], NOW);
    expect(await rows()).toHaveLength(2);
  });

  it('assertPeriodExists throws when missing', async () => {
    const { ctx } = setup();
    await expect(assertPeriodExists(ctx, 'nope', 'abcdefghij')).rejects.toMatchObject({
      code: 'identity_conflict',
    });
  });

  it.each([
    ['missing revenue', { revenue_in_usd: null }],
    ['null proceeds', { revenue_in_usd: { gross: 4.79, commission: 0, tax: 0, proceeds: null } }],
    ['zero proceeds', { revenue_in_usd: { gross: 4.79, commission: 0, tax: 0, proceeds: 0 } }],
  ])('%s is revenue_unverified with no row', async (_n, over) => {
    const { rc, ctx } = setup();
    const tx = rc.tx(over);
    const s = rc.addSubscription('rc1', {}, [tx]);
    await expect(ensurePeriod(ctx, s, [tx], NOW)).rejects.toMatchObject({
      status: 403,
      code: 'revenue_unverified',
    });
    expect(await rows()).toHaveLength(0);
  });

  it('no covering transaction is revenue_unverified', async () => {
    const { rc, ctx } = setup();
    const tx = rc.tx({ expiration_date: NOW - 1 });
    const s = rc.addSubscription('rc1', {}, [tx]);
    await expect(ensurePeriod(ctx, s, [tx], NOW)).rejects.toMatchObject({
      code: 'revenue_unverified',
    });
  });

  it('the row equals computePeriodCaps and satisfies the CHECKs', async () => {
    const { rc, ctx } = setup();
    const tx = rc.tx();
    const s = rc.addSubscription('rc1', {}, [tx]);
    const p = await preparePeriod(ctx, s, [tx], NOW);
    await p.statement.run();
    const caps = computePeriodCaps({ proceedsUsd: 4.07, grossUsd: 4.79 }, config.finance, {
      purchasedAt: tx.purchased_at,
      isFirstPeriodOfLineage: true,
    });
    if (!caps.ok) throw new Error('caps');
    const [r] = await rows();
    expect(r).toMatchObject({ ...caps.caps, period_start: tx.purchased_at });
    expect(r.period_end).toBe(tx.expiration_date);
    expect(r.cap_u * 1055).toBeLessThanOrEqual(r.net_proceeds_u * 500);
  });

  it('a 30% commission lowers the cap', async () => {
    const { rc, ctx } = setup();
    const full = rc.tx();
    const low = rc.tx({
      revenue_in_usd: { gross: 4.79, commission: 1.44, tax: 0, proceeds: 3.35 },
    });
    const a = await preparePeriod(ctx, rc.sub('rc1'), [full], NOW);
    const b = await preparePeriod(ctx, rc.sub('rc1'), [low], NOW);
    expect(b.row.cap_u).toBeLessThan(a.row.cap_u);
  });
});

describe('reverifySubscription', () => {
  function setup() {
    const rc = fakeRevenueCat();
    return { rc, ctx: makeCtx({ deps: testDeps({ revenuecat: rc }) }) };
  }

  it('stays active after ownership moves to another customer', async () => {
    const { rc, ctx } = setup();
    const s = rc.addSubscription('rc1', { id: 'sub_m' });
    const r1 = await reverifySubscription(ctx, s.id, NOW);
    rc.moveSubscription(s.id, 'rc2');
    const r2 = await reverifySubscription(ctx, s.id, NOW);
    expect(r1.status).toBe('active');
    expect(r2).toMatchObject({ status: 'active' });
    expect(await rows()).toHaveLength(1);
  });

  it('a refund revokes the live period and reports lapsed', async () => {
    const { rc, ctx } = setup();
    const s = rc.addSubscription('rc1', { id: 'sub_f' });
    await reverifySubscription(ctx, s.id, NOW);
    rc.update(s.id, { gives_access: false });
    expect(await reverifySubscription(ctx, s.id, NOW)).toEqual({ status: 'lapsed' });
    expect((await rows())[0].status).toBe('revoked');
  });

  it('a vanished subscription revokes too', async () => {
    const { rc, ctx } = setup();
    const s = rc.addSubscription('rc1', { id: 'sub_v' });
    await reverifySubscription(ctx, s.id, NOW);
    rc.remove(s.id);
    expect(await reverifySubscription(ctx, s.id, NOW)).toEqual({ status: 'lapsed' });
    expect((await rows())[0].status).toBe('revoked');
  });

  it('a renewal transaction creates the next period', async () => {
    const { rc, ctx } = setup();
    const s = rc.addSubscription('rc1', { id: 'sub_n' });
    await reverifySubscription(ctx, s.id, NOW);
    const later = NOW + 30 * DAY_MS;
    rc.addTransaction(
      s.id,
      rc.tx({ purchased_at: NOW + 29 * DAY_MS, expiration_date: NOW + 59 * DAY_MS })
    );
    const r = await reverifySubscription(ctx, s.id, later);
    expect(r.status).toBe('active');
    expect(await rows()).toHaveLength(2);
  });

  it('unavailable propagates', async () => {
    const { rc, ctx } = setup();
    rc.unavailable = true;
    await expect(reverifySubscription(ctx, 'x', NOW)).rejects.toBeInstanceOf(
      RevenueCatUnavailableError
    );
  });
});
