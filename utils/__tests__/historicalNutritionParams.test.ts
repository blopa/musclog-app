import {
  getHistoricalNutritionParams,
  getLatestHistoricalNutritionWindow,
} from '@/utils/historicalNutritionParams';
import { localDayKeyPlusCalendarDays } from '@/utils/calendarDate';

const mockGetMetricsHistory = jest.fn();
const mockGetRangeNutrients = jest.fn();
const mockGetNutritionLogsForDateRange = jest.fn();
const mockGetLatestMetricOnOrBefore = jest.fn();
const mockGetLatestLogOnOrBefore = jest.fn();

// Mocked per module: reaching the real ones pulls in the adapter and, through it,
// @sentry/react-native.
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: {
    getMetricsHistory: (...args: unknown[]) => mockGetMetricsHistory(...args),
    getLatestOnOrBefore: (...args: unknown[]) => mockGetLatestMetricOnOrBefore(...args),
  },
}));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    getRangeNutrients: (...args: unknown[]) => mockGetRangeNutrients(...args),
    getNutritionLogsForDateRange: (...args: unknown[]) => mockGetNutritionLogsForDateRange(...args),
    getLatestLogOnOrBefore: (...args: unknown[]) => mockGetLatestLogOnOrBefore(...args),
  },
}));

function makeWeightMetric(date: number, value: number, unit: string = 'kg') {
  return {
    date,
    getDecrypted: jest.fn().mockResolvedValue({ value, unit, date }),
  };
}

function makeBodyFatMetric(date: number, value: number) {
  return {
    date,
    getDecrypted: jest.fn().mockResolvedValue({ value, unit: undefined, date }),
  };
}

function makeNutritionLog(date: number) {
  return { date };
}

const fixedEndDate = new Date('2025-03-08T00:00:00.000Z');
const startTs = fixedEndDate.getTime() - 30 * 24 * 60 * 60 * 1000;

describe('getHistoricalNutritionParams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when there are fewer than 2 weight entries', async () => {
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [makeWeightMetric(fixedEndDate.getTime(), 70)];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 50000,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).toBeNull();
  });

  it('returns null when fewer than 7 days have nutrition logs', async () => {
    const weight1 = makeWeightMetric(startTs, 72);
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [weight2, weight1];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 10000,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).toBeNull();
  });

  it('returns null when total calories is zero', async () => {
    const weight1 = makeWeightMetric(startTs, 72);
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [weight2, weight1];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).toBeNull();
  });

  it('returns all six params when 2+ weights, 7+ days nutrition, and non-zero calories', async () => {
    const weight1 = makeWeightMetric(startTs, 72);
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [weight2, weight1];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 52500,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      historicalTotalCalories: 52500,
      historicalTotalDays: 30,
      historicalInitialWeightKg: 72,
      historicalFinalWeightKg: expect.closeTo(70.574565, 5),
    });
    expect(result).not.toHaveProperty('historicalInitialFatPercent');
    expect(result).not.toHaveProperty('historicalFinalFatPercent');
  });

  it('includes body fat params when body_fat metrics exist', async () => {
    const weight1 = makeWeightMetric(startTs, 72);
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
    const bf1 = makeBodyFatMetric(startTs, 22);
    const bf2 = makeBodyFatMetric(fixedEndDate.getTime(), 20);
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [weight2, weight1];
      }
      if (type === 'body_fat') {
        return [bf2, bf1];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 52500,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      historicalTotalCalories: 52500,
      historicalTotalDays: 30,
      historicalInitialWeightKg: 72,
      historicalFinalWeightKg: expect.closeTo(70.574565, 5),
      historicalInitialFatPercent: 22,
      historicalFinalFatPercent: 20,
    });
  });

  it('converts lbs to kg when weight unit is lbs', async () => {
    const weight1 = makeWeightMetric(startTs, 158.73, 'lbs');
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 154.32, 'lbs');
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [weight2, weight1];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 52500,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).not.toBeNull();
    expect(result!.historicalInitialWeightKg).toBeCloseTo(72, 1);
    expect(result!.historicalFinalWeightKg).toBeCloseTo(70.57, 1);
  });

  it('uses canonical trend endpoints regardless of the legacy weekly-averages option', async () => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerWeek = 7 * msPerDay;
    // Week 0 (days 0-6): weights 72, 73 → avg 72.5
    const w0a = makeWeightMetric(startTs + 1 * msPerDay, 72);
    const w0b = makeWeightMetric(startTs + 3 * msPerDay, 73);
    // Week 3 (days 21-27): weights 69, 70 → avg 69.5
    const w3a = makeWeightMetric(startTs + 22 * msPerDay, 69);
    const w3b = makeWeightMetric(startTs + 25 * msPerDay, 70);
    mockGetMetricsHistory.mockImplementation(async (type: string) => {
      if (type === 'weight') {
        return [w3b, w3a, w0b, w0a];
      }
      return [];
    });
    mockGetRangeNutrients.mockResolvedValue({
      calories: 52500,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * msPerDay))
    );

    const result = await getHistoricalNutritionParams({
      asOfDate: fixedEndDate,
      useWeeklyFatAverages: true,
    });
    expect(result).not.toBeNull();
    expect(result!.historicalInitialWeightKg).toBe(72);
    expect(result!.historicalFinalWeightKg).toBeCloseTo(70.297477, 5);
    expect(result!.historicalTotalCalories).toBe(52500);
    expect(result!.historicalTotalDays).toBe(24);
    expect(result!.historicalWeightChangeDays).toBe(24);
    expect(mockGetRangeNutrients).toHaveBeenCalledWith(new Date(2025, 1, 7), new Date(2025, 2, 2));
  });

  it('fetches a 28-day weight warm-up before the empirical window', async () => {
    const weight1 = makeWeightMetric(startTs, 72);
    const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
    mockGetMetricsHistory.mockImplementation(async (type: string) =>
      type === 'weight' ? [weight2, weight1] : []
    );
    mockGetRangeNutrients.mockResolvedValue({
      calories: 52500,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      effectiveDayCount: undefined,
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        makeNutritionLog(startTs + index * 24 * 60 * 60 * 1000)
      )
    );

    await getHistoricalNutritionParams({ asOfDate: fixedEndDate });

    const weightCall = mockGetMetricsHistory.mock.calls.find(([type]) => type === 'weight');
    expect(weightCall[1].startDate).toBe(localDayKeyPlusCalendarDays(startTs, -28));
  });

  describe('fasting-day feature', () => {
    const msPerDay = 24 * 60 * 60 * 1000;

    function setupTenLoggedDays(totalCalories = 20000) {
      const weight1 = makeWeightMetric(startTs, 72);
      const weight2 = makeWeightMetric(fixedEndDate.getTime(), 70);
      mockGetMetricsHistory.mockImplementation(async (type: string) =>
        type === 'weight' ? [weight2, weight1] : []
      );
      mockGetRangeNutrients.mockResolvedValue({
        calories: totalCalories,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        effectiveDayCount: undefined,
        dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      });
      // 10 distinct logged days (enough to pass the ≥7 gate).
      mockGetNutritionLogsForDateRange.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * msPerDay))
      );
    }

    it('keeps the full lookback window as the divisor when the feature is off', async () => {
      setupTenLoggedDays();

      const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
      expect(result!.historicalTotalDays).toBe(30);
    });

    it('divides by logged days ∪ fasted days when the feature is on', async () => {
      setupTenLoggedDays();
      // 3 fasted days, none overlapping the 10 logged days → 13 effective days.
      mockGetRangeNutrients.mockResolvedValue({
        calories: 20000,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        effectiveDayCount: 13,
        dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      });

      const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
      expect(result!.historicalTotalDays).toBe(13);
    });

    it('excludes unflagged empty days from the divisor (feature on, no fasted days)', async () => {
      setupTenLoggedDays();
      mockGetRangeNutrients.mockResolvedValue({
        calories: 20000,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        effectiveDayCount: 10,
        dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      });

      // 10 logged days, 0 fasted → divide by 10 (the other 20 empty days are skipped).
      const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
      expect(result!.historicalTotalDays).toBe(10);
    });
  });
});

it('separates seven food-logging days from a thirty-day trend interval', async () => {
  mockGetMetricsHistory.mockImplementation(async (type: string) =>
    type === 'weight'
      ? [makeWeightMetric(startTs, 83), makeWeightMetric(fixedEndDate.getTime(), 80)]
      : []
  );
  mockGetRangeNutrients.mockResolvedValue({ calories: 14000 });
  mockGetNutritionLogsForDateRange.mockResolvedValue(
    Array.from({ length: 7 }, (_, i) => makeNutritionLog(startTs + i * 86400000))
  );
  expect(
    await getHistoricalNutritionParams({ asOfDate: fixedEndDate, excludeUnloggedDays: true })
  ).toMatchObject({ historicalTotalDays: 7, historicalWeightChangeDays: 30 });
});

describe('getLatestHistoricalNutritionWindow', () => {
  /** Noon on a local calendar day, so no timezone moves it to a neighbouring day. */
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  type Log = { date: number; calories: number };
  let weights: { date: number; value: number }[];
  let logs: Log[];
  let fastedDaysInRange: (start: number, end: number) => number | undefined;

  /** Each daily range call covers [start's midnight, end's midnight + 1 day). */
  const inRange = (date: number, start: Date, end: Date) =>
    date >= new Date(start).setHours(0, 0, 0, 0) &&
    date < new Date(end).setHours(0, 0, 0, 0) + DAY_MS;

  beforeEach(() => {
    jest.clearAllMocks();
    weights = [];
    logs = [];
    fastedDaysInRange = () => undefined;

    mockGetMetricsHistory.mockImplementation(
      async (type: string, range: { startDate: number; endDate: number }) =>
        type === 'weight'
          ? weights
              .filter((w) => w.date >= range.startDate && w.date <= range.endDate)
              .map((w) => makeWeightMetric(w.date, w.value))
          : []
    );
    mockGetNutritionLogsForDateRange.mockImplementation(async (start: Date, end: Date) =>
      logs.filter((log) => inRange(log.date, start, end)).map((log) => makeNutritionLog(log.date))
    );
    mockGetRangeNutrients.mockImplementation(async (start: Date, end: Date) => {
      const inside = logs.filter((log) => inRange(log.date, start, end));
      const loggedDays = new Set(inside.map((log) => new Date(log.date).toDateString())).size;
      const fasted = fastedDaysInRange(start.getTime(), end.getTime());
      return {
        calories: inside.reduce((sum, log) => sum + log.calories, 0),
        // Mirrors getNutritionDayCoverage: only set while fasting days are enabled.
        effectiveDayCount: fasted === undefined ? undefined : loggedDays + fasted,
      };
    });
    mockGetLatestLogOnOrBefore.mockImplementation(async (max: number) => {
      const before = logs.filter((log) => log.date <= max).sort((a, b) => b.date - a.date);
      return before[0] ? { date: before[0].date, timezone: null } : null;
    });
    mockGetLatestMetricOnOrBefore.mockImplementation(async (_type: string, max: number) => {
      const before = weights.filter((w) => w.date <= max).sort((a, b) => b.date - a.date);
      return before[0] ? { date: before[0].date, timezone: null } : null;
    });
  });

  /** `count` consecutive days of 2500 kcal from `first`, weighing in every 3rd day. */
  function trackDays(first: number, count: number, { skip = [] as number[] } = {}) {
    for (let i = 0; i < count; i++) {
      const date = first + i * DAY_MS;
      if (!skip.includes(i)) {
        logs.push({ date, calories: 2500 });
      }

      if (i % 3 === 0) {
        weights.push({ date, value: 80 });
      }
    }
  }

  it('uses the recent window when it has enough data, without looking further back', async () => {
    const today = new Date(2026, 9, 27, 12);
    trackDays(today.getTime() - 40 * DAY_MS, 41);

    const result = await getLatestHistoricalNutritionWindow({ asOfDate: today });

    expect(result?.fromPastWindow).toBe(false);
    expect(mockGetLatestLogOnOrBefore).not.toHaveBeenCalled();
  });

  it('after months away, measures the 30 days that end at the last tracked day', async () => {
    // Tracked every day through May 31, then nothing until late October.
    trackDays(day(2025, 6, 1), 365);
    const lastTracked = day(2026, 5, 31);
    logs = logs.filter((log) => log.date <= lastTracked);
    weights = weights.filter((w) => w.date <= lastTracked);

    const result = await getLatestHistoricalNutritionWindow({ asOfDate: new Date(2026, 9, 27) });

    expect(result).not.toBeNull();
    expect(result!.fromPastWindow).toBe(true);
    // The window closes at the last weigh-in on or before June 1, which is in late May…
    expect(result!.endMs).toBeLessThanOrEqual(new Date(2026, 5, 1).getTime());
    expect(result!.endMs).toBeGreaterThan(new Date(2026, 4, 25).getTime());
    // …and the average intake is the 2500 kcal those days actually logged.
    expect(result!.params.historicalTotalCalories / result!.params.historicalTotalDays).toBe(2500);
  });

  it('leaves days without a food log out of the average instead of counting them as 0 kcal', async () => {
    const today = new Date(2026, 9, 27, 12);
    trackDays(today.getTime() - 40 * DAY_MS, 41, { skip: [15, 22, 30] });

    const result = await getLatestHistoricalNutritionWindow({ asOfDate: today });

    expect(result!.params.historicalTotalCalories / result!.params.historicalTotalDays).toBe(2500);
    // Tissue change still spans every elapsed day.
    expect(result!.params.historicalWeightChangeDays).toBeGreaterThan(
      result!.params.historicalTotalDays
    );
  });

  it('counts flagged fasting days as real 0 kcal days', async () => {
    const today = new Date(2026, 9, 27, 12);
    trackDays(today.getTime() - 40 * DAY_MS, 41, { skip: [15, 22] });
    fastedDaysInRange = () => 2;

    const result = await getLatestHistoricalNutritionWindow({ asOfDate: today });
    const { historicalTotalCalories, historicalTotalDays } = result!.params;

    // Two fasts among the logged days pull the average under 2500.
    expect(historicalTotalCalories / historicalTotalDays).toBeLessThan(2500);
    expect(historicalTotalCalories / (historicalTotalDays - 2)).toBe(2500);
  });

  it('falls back to the last weigh-in when weighing stopped before food logging did', async () => {
    trackDays(day(2026, 3, 1), 60);
    // Food carried on for three more weeks with no weigh-ins at all.
    for (let i = 60; i < 81; i++) {
      logs.push({ date: day(2026, 3, 1) + i * DAY_MS, calories: 2500 });
    }

    const result = await getLatestHistoricalNutritionWindow({ asOfDate: new Date(2026, 9, 27) });

    expect(result?.fromPastWindow).toBe(true);
    const lastWeighIn = Math.max(...weights.map((w) => w.date));
    expect(result!.endMs).toBe(new Date(lastWeighIn).setHours(0, 0, 0, 0));
  });

  it('returns null when nothing was ever tracked', async () => {
    expect(
      await getLatestHistoricalNutritionWindow({ asOfDate: new Date(2026, 9, 27) })
    ).toBeNull();
  });
});
