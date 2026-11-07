/**
 * @jest-environment jsdom
 */
/**
 * The layout audit's extra records go through the app's own services (so encrypted records are
 * encrypted normally), add to the demo data rather than replace it, and are only seeded by a
 * screenshots build that asks for them.
 */
const mockTables: Record<string, unknown[]> = {};

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({ fetch: jest.fn(async () => mockTables[table] ?? []) })),
    })),
  },
}));

const mockCreateNote = jest.fn(async (..._args: unknown[]) => ({}));
const mockSaveDayLog = jest.fn(async (..._args: unknown[]) => undefined);
const mockSetContext = jest.fn(async (..._args: unknown[]) => undefined);
const mockLogFood = jest.fn(async (..._args: unknown[]) => ({}));
const mockSaveGoal = jest.fn(async (..._args: unknown[]) => ({}));
const mockCreatePlan = jest.fn(async (..._args: unknown[]) => ({}));
const mockGetMealWithFoods = jest.fn((..._args: unknown[]) => undefined as unknown);

jest.mock('@/database/services/NoteService', () => ({
  NoteService: { createNote: (...args: unknown[]) => mockCreateNote(...args) },
}));
jest.mock('@/database/services/CycleDayLogService', () => ({
  CycleDayLogService: { save: (...args: unknown[]) => mockSaveDayLog(...args) },
}));
jest.mock('@/database/services/CycleContextService', () => ({
  CycleContextService: { set: (...args: unknown[]) => mockSetContext(...args) },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { logFood: (...args: unknown[]) => mockLogFood(...args) },
}));
jest.mock('@/database/services/ExerciseGoalService', () => ({
  ExerciseGoalService: { saveGoal: (...args: unknown[]) => mockSaveGoal(...args) },
}));
jest.mock('@/database/services/WorkoutPlanService', () => ({
  WorkoutPlanService: { createPlan: (...args: unknown[]) => mockCreatePlan(...args) },
}));
jest.mock('@/database/services/MealService', () => ({
  MealService: { getMealWithFoods: (...args: unknown[]) => mockGetMealWithFoods(...args) },
}));

import { LAYOUT_AUDIT_NOTES, seedLayoutAuditData } from '@/database/seeders/layoutAudit';

const AFTERNOON = new Date(2026, 10, 7, 15, 0);
const EARLY = new Date(2026, 10, 7, 7, 0);

beforeEach(() => {
  jest.clearAllMocks();
  mockTables.menstrual_cycles = [{ id: 'cycle-1' }];
  mockTables.foods = [{ id: 'food-a' }, { id: 'food-b' }, { id: 'food-c' }];
  mockTables.meals = [
    { id: 'meal-single', name: 'Toast' },
    { id: 'meal-1', name: 'Chicken & Rice Bowl' },
  ];
  mockTables.workout_logs = [{ id: 'log-1' }];
  mockTables.workout_log_exercises = [{ exerciseId: 'fx-bench' }];
  mockTables.workout_templates = [{ id: 'tpl-1' }, { id: 'tpl-2' }];
  mockGetMealWithFoods.mockImplementation(async (id: string) =>
    id === 'meal-1'
      ? {
          meal: mockTables.meals[1],
          foods: [
            { foodId: 'rice', amount: 150, portionId: undefined },
            { foodId: 'chicken', amount: 200, portionId: 'p-1' },
          ],
        }
      : { meal: mockTables.meals[0], foods: [{ foodId: 'bread', amount: 60 }] }
  );
});

describe('seedLayoutAuditData', () => {
  it('adds notes, cycle day logs and a context, diary entries, goals and a plan', async () => {
    const summary = await seedLayoutAuditData(AFTERNOON);

    expect(summary).toEqual({
      notes: LAYOUT_AUDIT_NOTES.length,
      cycleDayLogs: 5,
      cycleContext: true,
      diaryLogs: 4,
      groupedMeal: true,
      goals: 2,
      plan: true,
    });
    expect(mockCreateNote).toHaveBeenCalledTimes(LAYOUT_AUDIT_NOTES.length);
    expect(mockSetContext).toHaveBeenCalledWith(
      'cycle-1',
      expect.objectContaining({ lifeStage: 'regular' })
    );
    expect(mockCreatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleType: 'rotating',
        memberships: [
          { templateId: 'tpl-1', position: 0 },
          { templateId: 'tpl-2', position: 1 },
        ],
      })
    );
  });

  it('logs a saved meal the way logging it does: one log per ingredient, sharing the meal id', async () => {
    await seedLayoutAuditData(AFTERNOON);

    const grouped = mockLogFood.mock.calls.filter((call) => call[6] === 'meal-1');
    expect(grouped.map((call) => [call[0], call[3], call[4], call[7]])).toEqual([
      ['rice', 150, undefined, 'Chicken & Rice Bowl'],
      ['chicken', 200, 'p-1', 'Chicken & Rice Bowl'],
    ]);
    // A meal with a single food is not a group, so the next one is used.
    expect(mockLogFood.mock.calls.some((call) => call[6] === 'meal-single')).toBe(false);
  });

  it('fills the meal types the demo leaves empty and never logs in the future', async () => {
    await seedLayoutAuditData(EARLY);

    const types = mockLogFood.mock.calls.map((call) => call[2]);
    expect(types).toEqual(expect.arrayContaining(['snack', 'other', 'lunch']));
    for (const call of mockLogFood.mock.calls) {
      expect((call[1] as Date).getTime()).toBeLessThanOrEqual(EARLY.getTime());
    }
  });

  it('gives every day log valid content and keeps "no symptoms" for a day without any', async () => {
    await seedLayoutAuditData(AFTERNOON);

    for (const [input, mood] of mockSaveDayLog.mock.calls as unknown as [
      { symptoms: unknown[]; noSymptoms: boolean },
      number,
    ][]) {
      expect(input.noSymptoms).toBe(input.symptoms.length === 0);
      expect(Number.isInteger(mood) && mood >= 0 && mood <= 4).toBe(true);
    }
  });

  it('skips what the demo data cannot carry instead of failing', async () => {
    mockTables.menstrual_cycles = [];
    mockTables.workout_logs = [];
    mockTables.workout_templates = [];
    const summary = await seedLayoutAuditData(AFTERNOON);

    expect(mockSaveDayLog).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ cycleDayLogs: 0, cycleContext: false, goals: 1, plan: false });
  });
});

describe('shouldSeedLayoutAuditData', () => {
  const original = process.env.EXPO_PUBLIC_SCREENSHOT_MODE;
  afterEach(() => {
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE = original;
  });

  const gate = (search: string) => {
    window.history.replaceState({}, '', `/app/onboarding/landing${search}`);
    let result = false;
    jest.isolateModules(() => {
      result = (
        jest.requireActual('@/utils/file.web') as typeof import('@/utils/file.web')
      ).shouldSeedLayoutAuditData();
    });
    return result;
  };

  it('seeds only in a screenshots build that asks for it', () => {
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE = '1';
    expect(gate('?demoModeEnabled=true&layoutAuditData=true')).toBe(true);
    expect(gate('?demoModeEnabled=true')).toBe(false);
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE = '0';
    expect(gate('?demoModeEnabled=true&layoutAuditData=true')).toBe(false);
  });
});
