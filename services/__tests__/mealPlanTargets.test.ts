import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { resolveMealPlanMacroTargets } from '@/services/mealPlanTargets';
import { calculateNutritionPlan } from '@/utils/nutritionCalculator';

jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getCurrent: jest.fn() },
}));

jest.mock('@/database/services/NutritionTargetService', () => ({
  NutritionTargetService: { resolve: jest.fn() },
}));

jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatest: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getDisableMinimumCalories: jest.fn() },
}));

const mockGetCurrent = NutritionGoalService.getCurrent as jest.Mock;
const mockResolve = NutritionTargetService.resolve as jest.Mock;
const mockGetCurrentUser = UserService.getCurrentUser as jest.Mock;
const mockGetLatest = UserMetricService.getLatest as jest.Mock;
const mockDisableMinimum = SettingsService.getDisableMinimumCalories as jest.Mock;

const goal = {
  totalCalories: 2500,
  protein: 170,
  carbs: 260,
  fats: 75,
  fiber: 30,
};

const metric = (value: number) => ({ getDecrypted: jest.fn().mockResolvedValue({ value }) });

const user = {
  gender: 'male',
  activityLevel: 3,
  weightGoal: 'maintain',
  fitnessGoal: 'hypertrophy',
  liftingExperience: 'intermediate',
  getAge: () => 30,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDisableMinimum.mockResolvedValue(false);
});

describe('resolveMealPlanMacroTargets with a current goal', () => {
  it('uses the resolved targets, mapping fats to fat', async () => {
    mockGetCurrent.mockResolvedValue(goal);
    mockResolve.mockResolvedValue({
      totalCalories: 2200,
      protein: 180,
      carbs: 200,
      fats: 60,
      fiber: 28,
    });

    const targets = await resolveMealPlanMacroTargets();

    expect(mockResolve).toHaveBeenCalledWith(goal, expect.any(Date));
    expect(targets).toEqual({ calories: 2200, protein: 180, carbs: 200, fat: 60, fiber: 28 });
  });

  it('falls back field by field to the goal when resolve returns nothing', async () => {
    mockGetCurrent.mockResolvedValue(goal);
    mockResolve.mockResolvedValue(null);

    const targets = await resolveMealPlanMacroTargets();

    expect(targets).toEqual({ calories: 2500, protein: 170, carbs: 260, fat: 75, fiber: 30 });
  });

  it('falls back per field when resolve has only some values', async () => {
    mockGetCurrent.mockResolvedValue(goal);
    mockResolve.mockResolvedValue({ totalCalories: 2000, protein: undefined, fats: 70 });

    const targets = await resolveMealPlanMacroTargets();

    expect(targets).toEqual({ calories: 2000, protein: 170, carbs: 260, fat: 70, fiber: 30 });
  });
});

describe('resolveMealPlanMacroTargets without a goal', () => {
  it('calculates a plan from the profile and latest weight, with a 170 cm default height', async () => {
    mockGetCurrent.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue(user);
    const weight = metric(82);
    mockGetLatest.mockImplementation(async (type: string) => (type === 'weight' ? weight : null));

    const targets = await resolveMealPlanMacroTargets();

    const expected = calculateNutritionPlan({
      gender: 'male',
      weightKg: 82,
      heightCm: 170,
      age: 30,
      activityLevel: 3,
      weightGoal: 'maintain',
      fitnessGoal: 'hypertrophy',
      liftingExperience: 'intermediate',
      disableMinimumCalories: false,
    } as never);
    expect(targets).toEqual({
      calories: expected.targetCalories,
      protein: expected.protein,
      carbs: expected.carbs,
      fat: expected.fats,
      fiber: Math.round((expected.targetCalories / 1000) * 14),
    });
    expect(weight.getDecrypted).toHaveBeenCalledTimes(1);
  });

  it('uses the stored height when one exists', async () => {
    mockGetCurrent.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue(user);
    const weight = metric(82);
    const height = metric(186);
    mockGetLatest.mockImplementation(async (type: string) =>
      type === 'weight' ? weight : type === 'height' ? height : null
    );

    const targets = await resolveMealPlanMacroTargets();

    const expected = calculateNutritionPlan({
      gender: 'male',
      weightKg: 82,
      heightCm: 186,
      age: 30,
      activityLevel: 3,
      weightGoal: 'maintain',
      fitnessGoal: 'hypertrophy',
      liftingExperience: 'intermediate',
      disableMinimumCalories: false,
    } as never);
    expect(height.getDecrypted).toHaveBeenCalledTimes(1);
    expect(targets?.calories).toBe(expected.targetCalories);
  });

  it('returns undefined when there is no user', async () => {
    mockGetCurrent.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetLatest.mockResolvedValue(metric(80));

    await expect(resolveMealPlanMacroTargets()).resolves.toBeUndefined();
  });

  it('returns undefined when there is no weight metric', async () => {
    mockGetCurrent.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue(user);
    mockGetLatest.mockResolvedValue(null);

    await expect(resolveMealPlanMacroTargets()).resolves.toBeUndefined();
  });
});

describe('resolveMealPlanMacroTargets and the minimum calories', () => {
  it('raises a goal below the minimum, with its macros', async () => {
    mockGetCurrent.mockResolvedValue({
      totalCalories: 600,
      protein: 50,
      carbs: 60,
      fats: 18,
      fiber: 10,
    });
    mockResolve.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue({ ...user, gender: 'female' });

    await expect(resolveMealPlanMacroTargets()).resolves.toEqual({
      calories: 1200,
      protein: 100,
      carbs: 120,
      fat: 36,
      fiber: 10,
    });
  });

  it('leaves it alone for someone who turned the minimum off', async () => {
    mockDisableMinimum.mockResolvedValue(true);
    mockGetCurrent.mockResolvedValue({
      totalCalories: 600,
      protein: 50,
      carbs: 60,
      fats: 18,
      fiber: 10,
    });
    mockResolve.mockResolvedValue(null);

    await expect(resolveMealPlanMacroTargets()).resolves.toMatchObject({ calories: 600 });
  });
});
