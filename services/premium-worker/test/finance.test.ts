import { env } from 'cloudflare:test';
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AiConfig } from '../src/config';
import { computePeriodCaps, DAY_MS, effectiveCap, type PeriodCaps } from '../src/finance';
import { testConfig } from './fakes/ctx';

const RUNS = 1000;
const fin = testConfig().finance;
const opts = { purchasedAt: 1_800_000_000_000, isFirstPeriodOfLineage: true };

const commission = fc.oneof(
  fc.constantFrom(0.15, 0.3),
  fc.double({ min: 0, max: 0.5, noNaN: true })
);
const gross = fc.double({ min: 0.5, max: 50, noNaN: true });
const tax = fc.double({ min: 0, max: 0.27, noNaN: true });

const financeArb: fc.Arbitrary<AiConfig['finance']> = fc.record({
  spend_share: fc.double({ min: 0.01, max: 0.5, noNaN: true }),
  estimate_haircut: fc.double({ min: 0, max: 0.5, noNaN: true }),
  fx_haircut: fc.double({ min: 0, max: 0.5, noNaN: true }),
  rc_fee_rate: fc.double({ min: 0, max: 0.2, noNaN: true }),
  rc_fee_vat_factor: fc.double({ min: 1, max: 1.5, noNaN: true }),
  infra_per_period_u: fc.integer({ min: 0, max: 500_000 }),
  openrouter_fee: fc.double({ min: 1.055, max: 1.5, noNaN: true }),
  early_share: fc.double({ min: 0.01, max: 1, noNaN: true }),
  early_days: fc.integer({ min: 0, max: 31 }),
  daily_share: fc.double({ min: 0.01, max: 1, noNaN: true }),
  max_cap_u: fc.integer({ min: 1, max: 10_000_000 }),
  global_share: fc.double({ min: 0.5, max: 0.99, noNaN: true }),
  price_slack: fc.double({ min: 1, max: 2, noNaN: true }),
});

function checkInvariants(caps: PeriodCaps, f: AiConfig['finance']) {
  for (const v of Object.values(caps)) {
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  }
  expect(caps.cap_u * 1055).toBeLessThanOrEqual(caps.net_proceeds_u * 500);
  expect(caps.net_proceeds_u).toBeLessThanOrEqual(caps.proceeds_u);
  expect(caps.early_cap_u).toBeLessThanOrEqual(caps.cap_u);
  expect(caps.daily_cap_u).toBeLessThanOrEqual(caps.cap_u);
  expect(caps.cap_u).toBeLessThanOrEqual(f.max_cap_u);
}

describe('computePeriodCaps properties', () => {
  it('holds with the test config finance', () => {
    fc.assert(
      fc.property(gross, tax, commission, (g, _t, c) => {
        const r = computePeriodCaps({ grossUsd: g, proceedsUsd: g * (1 - c) }, fin, opts);
        expect(r.ok).toBe(true);
        if (r.ok) checkInvariants(r.caps, fin);
      }),
      { numRuns: RUNS }
    );
  });

  it('holds with random finance params in the validator ranges', () => {
    fc.assert(
      fc.property(gross, tax, commission, financeArb, (g, _t, c, f) => {
        const r = computePeriodCaps({ grossUsd: g, proceedsUsd: g * (1 - c) }, f, opts);
        if (!r.ok) {
          expect(r.code).toBe('revenue_unverified');
          return;
        }
        checkInvariants(r.caps, f);
      }),
      { numRuns: RUNS }
    );
  });

  it('returns revenue_unverified when net proceeds are not positive', () => {
    const f = { ...fin, infra_per_period_u: 10_000_000 };
    expect(computePeriodCaps({ grossUsd: 5, proceedsUsd: 4 }, f, opts)).toEqual({
      ok: false,
      code: 'revenue_unverified',
    });
  });
});

describe('worked examples (plan 8.1)', () => {
  it('Apple 15%: gross 4.79, proceeds 4.07', () => {
    const r = computePeriodCaps({ grossUsd: 4.79, proceedsUsd: 4.07 }, fin, opts);
    if (!r.ok) throw new Error('expected ok');
    expect(Math.abs(r.caps.cap_u - 1_750_000)).toBeLessThanOrEqual(10_000);
    expect(Math.abs(r.caps.early_cap_u - 440_000)).toBeLessThanOrEqual(10_000);
    expect(Math.abs(r.caps.net_proceeds_u - 3_690_000)).toBeLessThanOrEqual(30_000);
  });

  it('Apple 30%: gross 4.79, proceeds 3.35', () => {
    const r = computePeriodCaps({ grossUsd: 4.79, proceedsUsd: 3.35 }, fin, opts);
    if (!r.ok) throw new Error('expected ok');
    expect(Math.abs(r.caps.cap_u - 1_440_000)).toBeLessThanOrEqual(10_000);
    expect(Math.abs(r.caps.early_cap_u - 360_000)).toBeLessThanOrEqual(10_000);
    expect(Math.abs(r.caps.net_proceeds_u - 3_030_000)).toBeLessThanOrEqual(30_000);
  });
});

describe('unverified revenue', () => {
  const bad = [undefined, null, 0, -1, NaN, Infinity, -Infinity];
  for (const v of bad) {
    it(`proceeds ${String(v)}`, () => {
      expect(computePeriodCaps({ grossUsd: 4.79, proceedsUsd: v }, fin, opts)).toEqual({
        ok: false,
        code: 'revenue_unverified',
      });
    });
    it(`gross ${String(v)}`, () => {
      expect(computePeriodCaps({ grossUsd: v, proceedsUsd: 4.07 }, fin, opts)).toEqual({
        ok: false,
        code: 'revenue_unverified',
      });
    });
  }
});

describe('early window', () => {
  const rev = { grossUsd: 4.79, proceedsUsd: 4.07 };

  it('early_until is purchasedAt + 3 days for the first period, 0 otherwise', () => {
    const first = computePeriodCaps(rev, fin, { purchasedAt: 1000, isFirstPeriodOfLineage: true });
    const later = computePeriodCaps(rev, fin, { purchasedAt: 1000, isFirstPeriodOfLineage: false });
    if (!first.ok || !later.ok) throw new Error('expected ok');
    expect(first.caps.early_until).toBe(1000 + 3 * DAY_MS);
    expect(later.caps.early_until).toBe(0);
  });

  it('effectiveCap returns early cap before early_until and cap after', () => {
    const r = computePeriodCaps(rev, fin, { purchasedAt: 1000, isFirstPeriodOfLineage: true });
    if (!r.ok) throw new Error('expected ok');
    const c = r.caps;
    expect(effectiveCap(c, c.early_until - 1)).toBe(c.early_cap_u);
    expect(effectiveCap(c, c.early_until)).toBe(c.cap_u);
    expect(effectiveCap({ ...c, early_until: 0 }, 5)).toBe(c.cap_u);
  });
});

describe('periods CHECK constraints (plan 13 row 7)', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM periods').run();
  });

  const insert = (key: string, caps: PeriodCaps, over: Partial<PeriodCaps> = {}) => {
    const c = { ...caps, ...over };
    return env.DB.prepare(
      `INSERT INTO periods (payment_key, lineage_key, rc_subscription_id, store, period_start,
        period_end, proceeds_u, net_proceeds_u, cap_u, early_cap_u, early_until, daily_cap_u,
        created_at) VALUES (?, 'l', 's', 'app_store', 0, 1, ?, ?, ?, ?, ?, ?, 0)`
    )
      .bind(
        key,
        c.proceeds_u,
        c.net_proceeds_u,
        c.cap_u,
        c.early_cap_u,
        c.early_until,
        c.daily_cap_u
      )
      .run();
  };

  const sample = () =>
    fc.sample(
      fc
        .record({ g: gross, c: commission })
        .map(({ g, c }) => computePeriodCaps({ grossUsd: g, proceedsUsd: g * (1 - c) }, fin, opts)),
      50
    );

  it('accepts 50 computed rows', async () => {
    const rows = sample();
    for (const [i, r] of rows.entries()) {
      if (!r.ok) throw new Error('expected ok');
      await insert(`k${i}`, r.caps);
    }
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM periods').first<{ n: number }>();
    expect(n?.n).toBe(50);
  });

  it('rejects a cap twice the computed cap', async () => {
    const r = computePeriodCaps({ grossUsd: 4.79, proceedsUsd: 4.07 }, fin, opts);
    if (!r.ok) throw new Error('expected ok');
    await expect(insert('x', r.caps, { cap_u: r.caps.cap_u * 2 })).rejects.toThrow();
  });

  it('rejects net_proceeds_u above proceeds_u', async () => {
    const r = computePeriodCaps({ grossUsd: 4.79, proceedsUsd: 4.07 }, fin, opts);
    if (!r.ok) throw new Error('expected ok');
    await expect(
      insert('y', r.caps, {
        net_proceeds_u: r.caps.proceeds_u + 1,
        cap_u: 0,
        early_cap_u: 0,
        daily_cap_u: 0,
      })
    ).rejects.toThrow();
  });
});
