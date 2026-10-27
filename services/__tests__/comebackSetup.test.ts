import { getWorkoutTemplates } from '@/data/workoutTemplates';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { startComeback } from '@/services/comebackSetup';
import { refreshAllNotifications } from '@/services/notificationRefresh';
import { ensureGymForLocation } from '@/utils/applyTrainingSetup';
import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';

jest.mock('@/database/services/ComebackNutritionService', () => ({
  ComebackNutritionService: {
    logTodayWeight: jest.fn(),
    apply: jest.fn(),
    setTrackingDepth: jest.fn(),
  },
}));
jest.mock('@/database/services/ExerciseGoalService', () => ({
  ExerciseGoalService: { saveGoal: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getComebackState: jest.fn(), updateComebackState: jest.fn() },
}));
jest.mock('@/database/services/WorkoutPlanService', () => ({
  WorkoutPlanService: { getPlanSnapshot: jest.fn() },
}));
jest.mock('@/database/services/WorkoutTemplateService', () => ({
  WorkoutTemplateService: { createWorkoutsFromJsonTemplate: jest.fn() },
}));
jest.mock('@/services/notificationRefresh', () => ({ refreshAllNotifications: jest.fn() }));
jest.mock('@/utils/applyTrainingSetup', () => ({ ensureGymForLocation: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/data/workoutTemplates', () => ({ getWorkoutTemplates: jest.fn() }));

let stored: ComebackState;

describe('startComeback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stored = { ...DEFAULT_COMEBACK_STATE };
    (SettingsService.getComebackState as jest.Mock).mockImplementation(async () => stored);
    (SettingsService.updateComebackState as jest.Mock).mockImplementation(async (change) => {
      stored = typeof change === 'function' ? change(stored) : { ...stored, ...change };
      return stored;
    });
    (WorkoutPlanService.getPlanSnapshot as jest.Mock).mockResolvedValue(null);
    (WorkoutTemplateService.createWorkoutsFromJsonTemplate as jest.Mock).mockResolvedValue({
      plan: { id: 'plan-1' },
      templates: [],
    });
    (getWorkoutTemplates as jest.Mock).mockReturnValue(
      Array.from({ length: 20 }, (_, i) => ({ title: `Template ${i}` }))
    );
    (ComebackNutritionService.apply as jest.Mock).mockResolvedValue({ status: 'unchanged' });
  });

  it('writes the state first, as an active comeback that starts today', async () => {
    const result = await startComeback({ track: 'workout', answers: { energy: 'some' } });

    expect(result).toMatchObject({ started: true, failures: [] });
    expect(stored).toMatchObject({
      status: 'active',
      track: 'workout',
      answers: { energy: 'some' },
    });
    expect(stored.startedAt).not.toBeNull();
    expect(stored.baseBefore).toBe(stored.startedAt);
  });

  it('creates a gym profile through the shared helper, not by hand', async () => {
    await startComeback({ track: 'workout', answers: { location: 'home' } });

    expect(ensureGymForLocation).toHaveBeenCalledWith('home');
  });

  it('creates the short plan weekly on the chosen days, once', async () => {
    await startComeback({
      track: 'workout',
      answers: { location: 'home', start: 'shortPlan', weekDays: [1, 4] },
    });

    expect(WorkoutTemplateService.createWorkoutsFromJsonTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String) }),
      { cycleType: 'weekly', weekDays: [1, 4] }
    );
    expect(stored.shortPlanId).toBe('plan-1');
  });

  it('does not create a second plan when starting again with the first still there', async () => {
    stored = { ...DEFAULT_COMEBACK_STATE, shortPlanId: 'plan-1' };
    (WorkoutPlanService.getPlanSnapshot as jest.Mock).mockResolvedValue({
      plan: {},
      memberships: [],
    });

    await startComeback({ track: 'workout', answers: { location: 'home', start: 'shortPlan' } });

    expect(WorkoutTemplateService.createWorkoutsFromJsonTemplate).not.toHaveBeenCalled();
  });

  it('falls back to evenly spaced days from the days a week when none were picked', async () => {
    await startComeback({
      track: 'workout',
      answers: { location: 'minimal', start: 'shortPlan', daysPerWeek: 3 },
    });

    expect(WorkoutTemplateService.createWorkoutsFromJsonTemplate).toHaveBeenCalledWith(
      expect.anything(),
      { cycleType: 'weekly', weekDays: [0, 2, 4] }
    );
  });

  it('makes no plan unless the person asked for one', async () => {
    await startComeback({ track: 'workout', answers: { location: 'gym', start: 'ownPlan' } });

    expect(WorkoutTemplateService.createWorkoutsFromJsonTemplate).not.toHaveBeenCalled();
  });

  it('sets the weekly goal only when ticked', async () => {
    await startComeback({ track: 'workout', answers: { daysPerWeek: 2 } });
    expect(ExerciseGoalService.saveGoal).not.toHaveBeenCalled();

    await startComeback({ track: 'workout', answers: { daysPerWeek: 2 }, setWeeklyGoal: true });
    expect(ExerciseGoalService.saveGoal).toHaveBeenCalledWith({
      goalType: 'consistency',
      targetSessionsPerWeek: 2,
    });
  });

  it('touches no workout setup on the nutrition-only track', async () => {
    await startComeback({
      track: 'nutrition',
      answers: { location: 'gym', start: 'shortPlan', nutritionGoal: 'regular' },
    });

    expect(ensureGymForLocation).not.toHaveBeenCalled();
    expect(WorkoutTemplateService.createWorkoutsFromJsonTemplate).not.toHaveBeenCalled();
    expect(ComebackNutritionService.apply).toHaveBeenCalledWith(
      expect.objectContaining({ nutritionGoal: 'regular' }),
      { applyDeficit: false }
    );
  });

  it('logs the weigh-in before calculating targets, and never starts with a deficit', async () => {
    const order: string[] = [];
    (ComebackNutritionService.logTodayWeight as jest.Mock).mockImplementation(async () => {
      order.push('weight');
    });
    (ComebackNutritionService.apply as jest.Mock).mockImplementation(async () => {
      order.push('apply');
      return { status: 'unchanged' };
    });

    await startComeback({
      track: 'nutrition',
      answers: { nutritionGoal: 'loseSlowly' },
      todayWeightKg: 80,
    });

    expect(order).toEqual(['weight', 'apply']);
    expect(ComebackNutritionService.apply).toHaveBeenCalledWith(expect.anything(), {
      applyDeficit: false,
    });
  });

  it('switches the food diary only when the person flipped the toggle', async () => {
    await startComeback({ track: 'nutrition', answers: {} });
    expect(ComebackNutritionService.setTrackingDepth).not.toHaveBeenCalled();

    await startComeback({ track: 'nutrition', answers: {}, applyTrackingDepth: 'mealsOnly' });
    expect(ComebackNutritionService.setTrackingDepth).toHaveBeenCalledWith('mealsOnly');
  });

  it('still starts, and reports what failed, when a step throws', async () => {
    (ensureGymForLocation as jest.Mock).mockRejectedValue(new Error('gym failed'));
    (ComebackNutritionService.apply as jest.Mock).mockRejectedValue(new Error('goal failed'));

    const result = await startComeback({
      track: 'both',
      answers: { location: 'gym', nutritionGoal: 'regular' },
    });

    expect(result.started).toBe(true);
    expect(result.failures).toEqual(['gym', 'nutrition']);
    expect(stored.status).toBe('active');
    expect(refreshAllNotifications).toHaveBeenCalled();
  });
});
