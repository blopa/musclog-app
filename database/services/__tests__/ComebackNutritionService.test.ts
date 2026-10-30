import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import { DEFAULT_COMEBACK_STATE } from '@/utils/comeback/comebackState';

jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getCurrent: jest.fn(), updateGoal: jest.fn(), saveGoals: jest.fn() },
}));
jest.mock('@/database/services/NutritionTargetService', () => ({
  NutritionTargetService: { resolve: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getComebackState: jest.fn(),
    updateComebackState: jest.fn(),
    getUseBfForCalculations: jest.fn(),
    setIntuitiveEatingMode: jest.fn(),
    getIntuitiveEatingMode: jest.fn(),
    setNutritionDisplay: jest.fn(),
    getNutritionDisplay: jest.fn(),
  },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatest: jest.fn(), createMetric: jest.fn() },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn() },
}));
jest.mock('@/utils/timezone', () => ({ getCurrentTimezone: () => 'UTC' }));

const metric = (value: number, unit: string, date = 1_000) => ({
  date,
  getDecrypted: async () => ({ value, unit }),
});

function mockProfile() {
  (UserService.getCurrentUser as jest.Mock).mockResolvedValue({
    gender: 'male',
    activityLevel: 3,
    liftingExperience: 'intermediate',
    fitnessGoal: 'general',
    getAge: () => 34,
  });
  (UserMetricService.getLatest as jest.Mock).mockImplementation(async (type: string) => {
    if (type === 'weight') return metric(82, 'kg');
    if (type === 'height') return metric(180, 'cm');
    return null;
  });
  (SettingsService.getUseBfForCalculations as jest.Mock).mockResolvedValue(false);
}

const resolved = (totalCalories: number) => ({
  totalCalories,
  protein: 150,
  carbs: 250,
  fats: 70,
  fiber: 30,
  mode: 'manual',
  isDynamic: false,
  usedEmpiricalData: false,
  tdee: 2600,
});

describe('ComebackNutritionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile();
    (SettingsService.getComebackState as jest.Mock).mockResolvedValue(DEFAULT_COMEBACK_STATE);
    (SettingsService.updateComebackState as jest.Mock).mockResolvedValue(DEFAULT_COMEBACK_STATE);
  });

  it('has no profile without a weight, so nothing is written', async () => {
    (UserMetricService.getLatest as jest.Mock).mockResolvedValue(null);

    expect(
      await ComebackNutritionService.apply({ nutritionGoal: 'regular' }, { applyDeficit: false })
    ).toEqual({
      status: 'noProfile',
    });
    expect(NutritionGoalService.saveGoals).not.toHaveBeenCalled();
  });

  it('writes nothing when the person keeps their current targets', async () => {
    const result = await ComebackNutritionService.apply(
      { nutritionGoal: 'keep' },
      { applyDeficit: false }
    );

    expect(result).toEqual({ status: 'unchanged' });
    expect(NutritionGoalService.updateGoal).not.toHaveBeenCalled();
    expect(NutritionGoalService.saveGoals).not.toHaveBeenCalled();
  });

  it('moves an existing goal to weekly mode through updateGoal, at maintenance', async () => {
    (NutritionGoalService.getCurrent as jest.Mock).mockResolvedValue({ id: 'goal-1' });
    (NutritionTargetService.resolve as jest.Mock).mockResolvedValue(resolved(2200));

    const result = await ComebackNutritionService.apply(
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: false }
    );

    expect(result.status).toBe('applied');
    expect(NutritionGoalService.saveGoals).not.toHaveBeenCalled();
    expect(NutritionGoalService.updateGoal).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({ targetMode: 'weekly', eatingPhase: 'maintain' })
    );
    if (result.status === 'applied') {
      expect(result.before?.totalCalories).toBe(2200);
      expect(result.after.deficitCalories).toBe(0);
    }
    expect(SettingsService.updateComebackState).toHaveBeenCalledWith({
      appliedTargets: { totalCalories: expect.any(Number), at: expect.any(Number) },
    });
  });

  it('creates a weekly goal when there is none yet', async () => {
    (NutritionGoalService.getCurrent as jest.Mock).mockResolvedValue(null);

    const result = await ComebackNutritionService.apply(
      { nutritionGoal: 'regular' },
      { applyDeficit: false }
    );

    expect(result.status).toBe('applied');
    expect(NutritionGoalService.updateGoal).not.toHaveBeenCalled();
    expect(NutritionGoalService.saveGoals).toHaveBeenCalledWith(
      expect.objectContaining({ targetMode: 'weekly', eatingPhase: 'maintain' })
    );
    if (result.status === 'applied') {
      expect(result.before).toBeNull();
    }
  });

  it('takes the deficit when the goal still holds what setup wrote', async () => {
    (NutritionGoalService.getCurrent as jest.Mock).mockResolvedValue({ id: 'goal-1' });
    (NutritionTargetService.resolve as jest.Mock).mockResolvedValue(resolved(2700));
    (SettingsService.getComebackState as jest.Mock).mockResolvedValue({
      ...DEFAULT_COMEBACK_STATE,
      appliedTargets: { totalCalories: 2700, at: 1 },
    });

    const result = await ComebackNutritionService.apply(
      { nutritionGoal: 'loseSlowly', energy: 'plenty' },
      { applyDeficit: true }
    );

    expect(result.status).toBe('applied');
    expect(NutritionGoalService.updateGoal).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({ eatingPhase: 'cut' })
    );
  });

  it('stands down when a Weekly Review changed the targets since setup', async () => {
    (NutritionGoalService.getCurrent as jest.Mock).mockResolvedValue({ id: 'goal-1' });
    (NutritionTargetService.resolve as jest.Mock).mockResolvedValue(resolved(2450));
    (SettingsService.getComebackState as jest.Mock).mockResolvedValue({
      ...DEFAULT_COMEBACK_STATE,
      appliedTargets: { totalCalories: 2700, at: 1 },
    });

    const result = await ComebackNutritionService.apply(
      { nutritionGoal: 'loseSlowly' },
      { applyDeficit: true }
    );

    expect(result).toEqual({ status: 'changedSince' });
    expect(NutritionGoalService.updateGoal).not.toHaveBeenCalled();
  });

  describe('tracking depth', () => {
    it('meals only turns intuitive eating on and leaves the macro display alone', async () => {
      await ComebackNutritionService.setTrackingDepth('mealsOnly');

      expect(SettingsService.setIntuitiveEatingMode).toHaveBeenCalledWith(true);
      expect(SettingsService.setNutritionDisplay).not.toHaveBeenCalled();
    });

    it('calories and protein turns numbers on with protein the only macro shown', async () => {
      await ComebackNutritionService.setTrackingDepth('caloriesProtein');

      expect(SettingsService.setIntuitiveEatingMode).toHaveBeenCalledWith(false);
      expect(SettingsService.setNutritionDisplay).toHaveBeenCalledWith('01000');
    });

    it('full shows every macro', async () => {
      await ComebackNutritionService.setTrackingDepth('full');

      expect(SettingsService.setNutritionDisplay).toHaveBeenCalledWith('11111');
    });

    it('reads the depth the settings amount to', async () => {
      (SettingsService.getIntuitiveEatingMode as jest.Mock).mockResolvedValue(false);
      (SettingsService.getNutritionDisplay as jest.Mock).mockResolvedValue('01000');
      expect(await ComebackNutritionService.currentTrackingDepth()).toBe('caloriesProtein');

      (SettingsService.getNutritionDisplay as jest.Mock).mockResolvedValue('11111');
      expect(await ComebackNutritionService.currentTrackingDepth()).toBe('full');

      (SettingsService.getIntuitiveEatingMode as jest.Mock).mockResolvedValue(true);
      expect(await ComebackNutritionService.currentTrackingDepth()).toBe('mealsOnly');
    });
  });

  it('logs a weigh-in in kilograms for today', async () => {
    await ComebackNutritionService.logTodayWeight(81.5);

    expect(UserMetricService.createMetric).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'weight', value: 81.5, unit: 'kg', timezone: 'UTC' })
    );
  });
});
