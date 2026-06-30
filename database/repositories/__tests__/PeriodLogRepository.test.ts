import PeriodLog, {
  type PeriodLogCreate,
} from '@/database/models/PeriodLog';
import {
  findSameStartPeriodLog,
  hasOverlappingPeriodLog,
} from '@/database/repositories/periodLogOverlap';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

const makePeriodLog = (
  overrides: Partial<PeriodLog> & Pick<PeriodLog, 'id' | 'startDate' | 'endDate'>
): PeriodLog =>
  ({
    deletedAt: null,
    ...overrides,
  }) as PeriodLog;

describe('PeriodLogRepository period invariants', () => {
  it('treats same-day starts as duplicates', () => {
    const existing = makePeriodLog({
      id: 'existing',
      startDate: 10 * MS_PER_SOLAR_DAY,
      endDate: 12 * MS_PER_SOLAR_DAY,
    });

    expect(findSameStartPeriodLog([existing], existing.startDate)).toBe(existing);
  });

  it('detects overlap with closed historical periods', () => {
    const existing = makePeriodLog({
      id: 'existing',
      startDate: 10 * MS_PER_SOLAR_DAY,
      endDate: 14 * MS_PER_SOLAR_DAY,
    });
    const candidate: Pick<PeriodLogCreate, 'startDate' | 'endDate'> = {
      startDate: 12 * MS_PER_SOLAR_DAY,
      endDate: 16 * MS_PER_SOLAR_DAY,
    };

    expect(hasOverlappingPeriodLog([existing], candidate)).toBe(true);
  });

  it('ignores active logs that are being atomically replaced', () => {
    const activeLog = makePeriodLog({
      id: 'active',
      startDate: 20 * MS_PER_SOLAR_DAY,
      endDate: null,
    });
    const candidate: Pick<PeriodLogCreate, 'startDate' | 'endDate'> = {
      startDate: 25 * MS_PER_SOLAR_DAY,
      endDate: null,
    };

    expect(hasOverlappingPeriodLog([activeLog], candidate, ['active'])).toBe(false);
  });
});
