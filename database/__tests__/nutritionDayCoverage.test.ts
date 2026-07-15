import { type DayKeyRange } from '@/utils/calendarDate';

const mockGetEnableFastedDay = jest.fn();
const mockGetAllFastedDayKeys = jest.fn();
const mockGetFastedDayKeysForRange = jest.fn();

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getEnableFastedDay: (...args: unknown[]) => mockGetEnableFastedDay(...args),
  },
}));

jest.mock('@/database/repositories/FastedDayRepository', () => ({
  FastedDayRepository: {
    getAllFastedDayKeys: (...args: unknown[]) => mockGetAllFastedDayKeys(...args),
    getFastedDayKeysForRange: (...args: unknown[]) => mockGetFastedDayKeysForRange(...args),
  },
}));

import {
  addFastedZeroDaysToMap,
  getNutritionDayCoverage,
  loggedOrFastedDayKeys,
  withFastedZeroDays,
} from '../nutritionDayCoverage';

const day = (year: number, month: number, date: number) => Date.UTC(year, month, date);

const range = {} as DayKeyRange;

describe('nutritionDayCoverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEnableFastedDay.mockResolvedValue(false);
    mockGetAllFastedDayKeys.mockResolvedValue(new Set<number>());
    mockGetFastedDayKeysForRange.mockResolvedValue(new Set<number>());
  });

  it('uses logged days only when the fasted-day feature is off', async () => {
    const loggedDay = day(2026, 0, 1);
    const coverage = await getNutritionDayCoverage([{ date: loggedDay, timezone: '+00:00' }], {
      range,
    });

    expect(coverage.fastedDaysEnabled).toBe(false);
    expect(coverage.effectiveDayKeys).toEqual(new Set([loggedDay]));
    expect(mockGetFastedDayKeysForRange).not.toHaveBeenCalled();
  });

  it('unions logged and range fasted days without double-counting overlap', async () => {
    mockGetEnableFastedDay.mockResolvedValue(true);
    const loggedDay = day(2026, 0, 1);
    const fastedOnlyDay = day(2026, 0, 2);
    mockGetFastedDayKeysForRange.mockResolvedValue(new Set([loggedDay, fastedOnlyDay]));

    const coverage = await getNutritionDayCoverage([{ date: loggedDay, timezone: '+00:00' }], {
      range,
    });

    expect(coverage.effectiveDayKeys).toEqual(new Set([loggedDay, fastedOnlyDay]));
    expect(coverage.effectiveDayCount).toBe(2);
  });

  it('can include all fasted days for streak calculations', async () => {
    mockGetEnableFastedDay.mockResolvedValue(true);
    const loggedDay = day(2026, 0, 1);
    const fastedDay = day(2026, 0, 2);
    mockGetAllFastedDayKeys.mockResolvedValue(new Set([fastedDay]));

    await expect(loggedOrFastedDayKeys([{ date: loggedDay, timezone: '+00:00' }])).resolves.toEqual(
      new Set([loggedDay, fastedDay])
    );
  });

  it('injects fasted zero days into already-normalized daily series keys', async () => {
    mockGetEnableFastedDay.mockResolvedValue(true);
    const loggedDay = day(2026, 0, 1);
    const fastedOnlyDay = day(2026, 0, 2);
    mockGetFastedDayKeysForRange.mockResolvedValue(new Set([loggedDay, fastedOnlyDay]));

    const result = await withFastedZeroDays(
      [{ date: loggedDay, calories: 100 }],
      range,
      (date) => ({
        date,
        calories: 0,
      })
    );

    expect(result.fastedDaysEnabled).toBe(true);
    expect(result.days).toEqual([
      { date: loggedDay, calories: 100 },
      { date: fastedOnlyDay, calories: 0 },
    ]);
  });

  it('injects fasted zero values into day-key maps', async () => {
    mockGetEnableFastedDay.mockResolvedValue(true);
    const loggedDay = day(2026, 0, 1);
    const fastedOnlyDay = day(2026, 0, 2);
    mockGetFastedDayKeysForRange.mockResolvedValue(new Set([loggedDay, fastedOnlyDay]));

    const valuesByDay = new Map([[loggedDay, 500]]);
    await addFastedZeroDaysToMap(valuesByDay, range, 0);

    expect(valuesByDay).toEqual(
      new Map([
        [loggedDay, 500],
        [fastedOnlyDay, 0],
      ])
    );
  });
});
