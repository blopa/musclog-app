import { Q } from '@nozbe/watermelondb';

import { dayRangeClauses } from '@/database/dayKeyQuery';
import { dayKeyRange, utcNormalizedDayKey } from '@/utils/calendarDate';

describe('dayRangeClauses', () => {
  const range = { lowerMs: 1000, upperMs: 5000 };

  it('builds a half-open [lower, upper) window', () => {
    // An inclusive upper bound would pull in the first record of the next day.
    const clauses = dayRangeClauses(range);

    expect(clauses).toHaveLength(2);
    expect(clauses).toEqual([Q.where('date', Q.gte(1000)), Q.where('date', Q.lt(5000))]);
  });

  it('defaults to the `date` column', () => {
    expect(JSON.stringify(dayRangeClauses(range))).toContain('date');
  });

  it('targets a different column when one is named', () => {
    const clauses = dayRangeClauses(range, 'completed_at');

    expect(clauses).toEqual([
      Q.where('completed_at', Q.gte(1000)),
      Q.where('completed_at', Q.lt(5000)),
    ]);
  });

  it('accepts a real DayKeyRange and keeps its widened bounds verbatim', () => {
    // The bounds are deliberately over-wide (UTC-14…UTC+14); trimming happens in
    // `range.filterRecords`, never here.
    const real = dayKeyRange(Date.UTC(2026, 2, 14), Date.UTC(2026, 2, 14));

    const clauses = dayRangeClauses(real);

    expect(clauses).toEqual([
      Q.where('date', Q.gte(real.lowerMs)),
      Q.where('date', Q.lt(real.upperMs)),
    ]);
  });

  it('produces a window wide enough for any timezone the record could have been stored in', () => {
    const dayKey = utcNormalizedDayKey(Date.UTC(2026, 2, 14, 12), '+00:00');
    const real = dayKeyRange(dayKey, dayKey);

    // A record logged at the same wall-clock day in UTC+13 and UTC-11 must both fall
    // inside the fetched window, even though only `matches` decides membership.
    const farEast = utcNormalizedDayKey(Date.UTC(2026, 2, 13, 12), '+13:00');
    const farWest = utcNormalizedDayKey(Date.UTC(2026, 2, 14, 23), '-11:00');

    for (const candidate of [farEast, farWest]) {
      expect(candidate).toBeGreaterThanOrEqual(real.lowerMs);
      expect(candidate).toBeLessThan(real.upperMs);
    }
  });
});
