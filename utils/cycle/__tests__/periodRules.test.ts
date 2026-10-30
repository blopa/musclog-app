import {
  assertValidPeriod,
  findOverlap,
  isOpenPeriod,
  periodCoversDay,
  normalizeInitialPeriods,
  PeriodRuleViolation,
} from '../periodRules';

const NOW = new Date(2024, 5, 20, 12).getTime();
const day = (n: number) => new Date(2024, 5, n).getTime();
const p = (id: string, s: number, e: number | null, endKind: 'open' | 'logged' | 'unknown') => ({
  id,
  startDate: day(s),
  endDate: e == null ? null : day(e),
  endKind,
});

describe('findOverlap', () => {
  it('detects overlap with a closed period', () => {
    expect(
      findOverlap([p('a', 10, 14, 'logged')], { startDate: day(12), endDate: day(16) })
    ).toBeTruthy();
  });

  it('lets a new period start after one whose end is unknown', () => {
    expect(
      findOverlap([p('a', 1, null, 'unknown')], {
        startDate: day(15),
        endDate: null,
        endKind: 'open',
      })
    ).toBeNull();
  });

  it('treats an open period as running forever', () => {
    expect(
      findOverlap([p('a', 1, null, 'open')], { startDate: day(15), endDate: null, endKind: 'open' })
    ).toBeTruthy();
  });

  it('ignores listed ids', () => {
    expect(
      findOverlap([p('a', 1, null, 'open')], { startDate: day(15), endDate: null }, ['a'])
    ).toBeNull();
  });
});

describe('assertValidPeriod', () => {
  const run = (
    cand: Parameters<typeof assertValidPeriod>[1],
    existing = [p('a', 1, 5, 'logged')]
  ) => assertValidPeriod(existing, cand, { now: NOW });

  it('rejects the future, an end before the start and overlaps', () => {
    expect(() => run({ startDate: day(25), endDate: null })).toThrow(PeriodRuleViolation);
    expect(() => run({ startDate: day(10), endDate: day(8) })).toThrow('period_end_before_start');
    expect(() => run({ startDate: day(3), endDate: day(7) })).toThrow(
      'period_log_overlaps_existing'
    );
  });

  it('accepts a clean period, including one started today', () => {
    expect(() => run({ startDate: day(20), endDate: null, endKind: 'open' })).not.toThrow();
  });
});

describe('normalizeInitialPeriods', () => {
  it('dedupes by start and keeps unknown ends honest', () => {
    const out = normalizeInitialPeriods(
      [{ startDate: day(1) }, { startDate: day(1), endDate: day(5) }, { startDate: day(8) }],
      5,
      NOW
    );
    expect(out).toEqual([
      { startDate: day(1), endDate: day(5), endKind: 'logged' },
      { startDate: day(8), endDate: null, endKind: 'unknown' },
    ]);
  });

  it('leaves only a recent last period open', () => {
    const out = normalizeInitialPeriods([{ startDate: day(2) }, { startDate: day(18) }], 5, NOW);
    expect(out[0].endKind).toBe('unknown');
    expect(out[1].endKind).toBe('open');
    expect(isOpenPeriod(out[1])).toBe(true);
  });
});

describe('periodCoversDay', () => {
  it('covers a closed period, an open one, and not an unknown end beyond its first day', () => {
    expect(periodCoversDay([p('a', 1, 5, 'logged')], day(3))).toBe(true);
    expect(periodCoversDay([p('a', 1, null, 'open')], day(15))).toBe(true);
    expect(periodCoversDay([p('a', 1, null, 'unknown')], day(15))).toBe(false);
    expect(periodCoversDay([p('a', 1, null, 'unknown')], day(1))).toBe(true);
  });
});
