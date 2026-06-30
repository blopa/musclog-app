import { normalizeInitialPeriodLogs } from '@/database/repositories/periodLogNormalization';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

describe('normalizeInitialPeriodLogs', () => {
  it('deduplicates initial logs that share the same start date', () => {
    const now = 100 * MS_PER_SOLAR_DAY;
    const normalized = normalizeInitialPeriodLogs(
      [{ startDate: 10 * MS_PER_SOLAR_DAY }, { startDate: 10 * MS_PER_SOLAR_DAY }],
      5,
      now
    );

    expect(normalized).toEqual([
      { startDate: 10 * MS_PER_SOLAR_DAY, endDate: 14 * MS_PER_SOLAR_DAY },
    ]);
  });

  it('closes historical initial logs before seeding a cycle', () => {
    const now = 100 * MS_PER_SOLAR_DAY;
    const normalized = normalizeInitialPeriodLogs(
      [{ startDate: 10 * MS_PER_SOLAR_DAY }, { startDate: 40 * MS_PER_SOLAR_DAY }],
      5,
      now
    );

    expect(normalized).toEqual([
      { startDate: 10 * MS_PER_SOLAR_DAY, endDate: 14 * MS_PER_SOLAR_DAY },
      { startDate: 40 * MS_PER_SOLAR_DAY, endDate: 44 * MS_PER_SOLAR_DAY },
    ]);
  });

  it('keeps only the newest inferred initial log open when it may still be active', () => {
    const now = 101 * MS_PER_SOLAR_DAY;
    const normalized = normalizeInitialPeriodLogs(
      [{ startDate: 90 * MS_PER_SOLAR_DAY }, { startDate: 98 * MS_PER_SOLAR_DAY }],
      5,
      now
    );

    expect(normalized).toEqual([
      { startDate: 90 * MS_PER_SOLAR_DAY, endDate: 94 * MS_PER_SOLAR_DAY },
      { startDate: 98 * MS_PER_SOLAR_DAY, endDate: null },
    ]);
  });
});
