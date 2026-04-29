import { UserMetricService, UserService } from '@/database/services';
import { resolveDailyMacros } from '@/utils/dynamicNutritionTarget';
import { getHistoricalNutritionParams } from '@/utils/historicalNutritionParams';
import {
  calculateMacros,
  calculateNutritionPlan,
  computeWeightChangeFromCalorieDelta,
  getMinCalories,
} from '@/utils/nutritionCalculator';

jest.mock('@/database/services', () => ({
  UserService: {
    getCurrentUser: jest.fn(),
  },
  UserMetricService: {
    getLatestOnOrBefore: jest.fn(),
  },
}));

jest.mock('../historicalNutritionParams', () => ({
  getHistoricalNutritionParams: jest.fn(),
}));

jest.mock('../nutritionCalculator', () => ({
  calculateNutritionPlan: jest.fn(),
  calculateMacros: jest.fn((targetCalories) => ({
    protein: Math.round(targetCalories / 10),
    carbs: Math.round(targetCalories / 8),
    fats: Math.round(targetCalories / 30),
  })),
  computeWeightChangeFromCalorieDelta: jest.fn((totalDeltaKcal) => totalDeltaKcal / 7000),
  eatingPhaseToWeightGoal: jest.fn((p) =>
    p === 'cut' ? 'lose' : p === 'bulk' ? 'gain' : 'maintain'
  ),
  fiberFromCalories: jest.fn((c) => 25),
  getMinCalories: jest.fn(() => 1500),
}));

describe('resolveDailyMacros', () => {
  const mockGoal = {
    isDynamic: true,
    eatingPhase: 'cut',
    fiber: 30,
  } as any;

  const mockUser = {
    gender: 'male',
    getAge: () => 30,
    activityLevel: 3,
    fitnessGoal: 'hypertrophy',
    liftingExperience: 'intermediate',
  };

  const mockHeightMetric = {
    getDecrypted: () => Promise.resolve({ value: 180, unit: 'cm' }),
  };

  const mockWeightMetric = {
    getDecrypted: () => Promise.resolve({ value: 85, unit: 'kg' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null if goal is not dynamic', async () => {
    const result = await resolveDailyMacros({ isDynamic: false } as any, new Date());
    expect(result).toBeNull();
  });

  it('resolves macros using empirical data when available', async () => {
    (UserService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (UserMetricService.getLatestOnOrBefore as jest.Mock).mockImplementation((type) => {
      if (type === 'height') {
        return Promise.resolve(mockHeightMetric);
      }
      if (type === 'weight') {
        return Promise.resolve(mockWeightMetric);
      }
      return Promise.resolve(null);
    });
    (getHistoricalNutritionParams as jest.Mock).mockResolvedValue({
      historicalTotalCalories: 60000,
      historicalTotalDays: 30,
      historicalInitialWeightKg: 85,
      historicalFinalWeightKg: 82,
    });
    (calculateNutritionPlan as jest.Mock).mockReturnValue({
      targetCalories: 2200,
      tdee: 2600,
      bmr: 1800,
    });

    const result = await resolveDailyMacros(mockGoal, new Date());

    expect(result).toEqual({
      totalCalories: 2200,
      protein: 220,
      carbs: 275,
      fats: 73,
      fiber: 25,
      isDynamic: true,
      usedEmpiricalData: true,
    });
  });

  it('falls back to formula-based TDEE when historical data is missing', async () => {
    (UserService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (UserMetricService.getLatestOnOrBefore as jest.Mock).mockImplementation((type) => {
      if (type === 'height') {
        return Promise.resolve(mockHeightMetric);
      }
      if (type === 'weight') {
        return Promise.resolve(mockWeightMetric);
      }
      return Promise.resolve(null);
    });
    (getHistoricalNutritionParams as jest.Mock).mockResolvedValue(null);
    (calculateNutritionPlan as jest.Mock).mockReturnValue({
      targetCalories: 2500,
      tdee: 2600,
      bmr: 1800,
    });

    const result = await resolveDailyMacros(mockGoal, new Date());

    expect(result).toEqual({
      totalCalories: 2500,
      protein: 250,
      carbs: 313,
      fats: 83,
      fiber: 25,
      isDynamic: true,
      usedEmpiricalData: false,
    });
  });
  it('respects safety floors and never returns negative calories', async () => {
    (UserService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (UserMetricService.getLatestOnOrBefore as jest.Mock).mockImplementation((type) => {
      if (type === 'height') {
        return Promise.resolve(mockHeightMetric);
      }
      if (type === 'weight') {
        return Promise.resolve(mockWeightMetric);
      }
      return Promise.resolve(null);
    });
    // Mock an extreme scenario (losing 10kg in 30 days while eating 1000kcal)
    // that might lead to negative targets if not floored.
    // calculateNutritionPlan should already be using getMinCalories internally.
    (getHistoricalNutritionParams as jest.Mock).mockResolvedValue({
      historicalTotalCalories: 30000,
      historicalTotalDays: 30,
      historicalInitialWeightKg: 100,
      historicalFinalWeightKg: 90,
    });

    // Manual override for mock to simulate the calculator applying the floor.
    (calculateNutritionPlan as jest.Mock).mockReturnValue({
      targetCalories: 1500,
      tdee: 2200,
      bmr: 1800,
    });

    const result = await resolveDailyMacros(mockGoal, new Date());

    expect(result?.totalCalories).toBeGreaterThanOrEqual(1500);
    expect(result).toEqual(
      expect.objectContaining({
        totalCalories: 1500,
        isDynamic: true,
      })
    );
  });

  it('queries metrics as of the viewed day instead of using unrestricted latest values', async () => {
    const viewedDate = new Date('2026-02-11T15:00:00.000Z');

    (UserService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (UserMetricService.getLatestOnOrBefore as jest.Mock).mockImplementation((type) => {
      if (type === 'height') {
        return Promise.resolve(mockHeightMetric);
      }
      if (type === 'weight') {
        return Promise.resolve(mockWeightMetric);
      }
      return Promise.resolve(null);
    });
    (getHistoricalNutritionParams as jest.Mock).mockResolvedValue(null);
    (calculateNutritionPlan as jest.Mock).mockReturnValue({
      targetCalories: 2500,
      tdee: 2600,
      bmr: 1800,
    });

    await resolveDailyMacros(mockGoal, viewedDate);

    expect(UserMetricService.getLatestOnOrBefore).toHaveBeenCalledTimes(3);
    expect(UserMetricService.getLatestOnOrBefore).toHaveBeenNthCalledWith(
      1,
      'weight',
      expect.any(Number)
    );
    expect(UserMetricService.getLatestOnOrBefore).toHaveBeenNthCalledWith(
      2,
      'height',
      expect.any(Number)
    );
    expect(UserMetricService.getLatestOnOrBefore).toHaveBeenNthCalledWith(
      3,
      'body_fat',
      expect.any(Number)
    );
  });

  it('uses target weight and target date to derive dynamic calories', async () => {
    const viewedDate = new Date('2026-02-11T15:00:00.000Z');

    (UserService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (UserMetricService.getLatestOnOrBefore as jest.Mock).mockImplementation((type) => {
      if (type === 'height') {
        return Promise.resolve(mockHeightMetric);
      }
      if (type === 'weight') {
        return Promise.resolve(mockWeightMetric);
      }
      return Promise.resolve(null);
    });
    (getHistoricalNutritionParams as jest.Mock).mockResolvedValue(null);
    (calculateNutritionPlan as jest.Mock).mockReturnValue({
      targetCalories: 2300,
      tdee: 2500,
      bmr: 1800,
    });

    const result = await resolveDailyMacros(
      {
        ...mockGoal,
        targetWeight: 80,
        targetDate: new Date('2026-04-02T00:00:00.000Z').getTime(),
      } as any,
      viewedDate
    );

    expect(getMinCalories).toHaveBeenCalled();
    expect(computeWeightChangeFromCalorieDelta).toHaveBeenCalled();
    expect(calculateMacros).toHaveBeenCalledWith(
      expect.any(Number),
      mockUser.fitnessGoal,
      expect.objectContaining({ weightKg: 85 })
    );
    expect(result?.totalCalories).toBeLessThan(2300);
    expect(result?.totalCalories).toBeGreaterThanOrEqual(1500);
  });
});
