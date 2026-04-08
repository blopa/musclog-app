import { getHistoricalNutritionParams } from '@/utils/historicalNutritionParams';

const mockGetMetricsHistory = jest.fn();
const mockGetRangeNutrients = jest.fn();
const mockGetNutritionLogsForDateRange = jest.fn();

jest.mock('../../database/services/UserMetricService', () => ({
  UserMetricService: {
    getMetricsHistory: (...args: unknown[]) => mockGetMetricsHistory(...args),
  },
}));

jest.mock('../../database/services/NutritionService', () => ({
  NutritionService: {
    getRangeNutrients: (...args: unknown[]) => mockGetRangeNutrients(...args),
    getNutritionLogsForDateRange: (...args: unknown[]) => mockGetNutritionLogsForDateRange(...args),
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
      historicalFinalWeightKg: 70,
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
      historicalFinalWeightKg: 70,
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
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * 24 * 60 * 60 * 1000))
    );

    const result = await getHistoricalNutritionParams({ asOfDate: fixedEndDate });
    expect(result).not.toBeNull();
    expect(result!.historicalInitialWeightKg).toBeCloseTo(72, 1);
    expect(result!.historicalFinalWeightKg).toBeCloseTo(70, 1);
  });

  it('when useWeeklyAverages is true, uses average of first week for initial and last week for final', async () => {
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
      dailyAverages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    });
    mockGetNutritionLogsForDateRange.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeNutritionLog(startTs + i * msPerDay))
    );

    const result = await getHistoricalNutritionParams({
      asOfDate: fixedEndDate,
      useWeeklyAverages: true,
    });
    expect(result).not.toBeNull();
    expect(result!.historicalInitialWeightKg).toBe(72.5);
    expect(result!.historicalFinalWeightKg).toBe(69.5);
    expect(result!.historicalTotalCalories).toBe(52500);
    expect(result!.historicalTotalDays).toBe(30);
  });
});
