const mockGetSendFoundationFoods = jest.fn();
const mockGetFoundationFoods = jest.fn();
const mockNormalize = jest.fn();
const mockLogBatch = jest.fn();
const mockHandleError = jest.fn();

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getSendFoundationFoodsToLlm: (...args: unknown[]) => mockGetSendFoundationFoods(...args),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: { getFoundationFoods: (...args: unknown[]) => mockGetFoundationFoods(...args) },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: (...args: unknown[]) => mockNormalize(...args),
    logCustomMealsBatch: (...args: unknown[]) => mockLogBatch(...args),
  },
}));
jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

import { FOOD_LOG_MAJOR, FOOD_LOG_SCHEMA_ID } from '@/utils/aiFoodLog/contract';
import { toIngredients } from '@/utils/aiFoodLog/logPlan';

import { loadFoodLogInstructions, logExternalFoods, readExternalFoodLog } from '../externalFoodLog';

const rice = { name: 'White rice', grams: 200, calories: 260, protein: 5, carbs: 56, fat: 0.6 };
const text = (foods: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: FOOD_LOG_SCHEMA_ID, version: FOOD_LOG_MAJOR, foods, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSendFoundationFoods.mockResolvedValue(true);
  mockGetFoundationFoods.mockResolvedValue([
    { id: 'food-1', name: 'Banana, raw' },
    { id: 'food-2', name: 'Egg, whole' },
  ]);
  mockLogBatch.mockResolvedValue([]);
});

describe('loadFoodLogInstructions', () => {
  it('lists the foundation foods while the person lets foods be sent to an LLM', async () => {
    const instructions = await loadFoodLogInstructions('en-US');

    expect(mockGetFoundationFoods).toHaveBeenCalledWith(200);
    expect(instructions).toContain('Foods Musclog already knows');
    expect(instructions).toContain('"id":"food-1","name":"Banana, raw"');
  });

  it('sends no list, and does not even read the foods, when the setting is off', async () => {
    mockGetSendFoundationFoods.mockResolvedValue(false);

    const instructions = await loadFoodLogInstructions('en-US');

    expect(mockGetFoundationFoods).not.toHaveBeenCalled();
    expect(instructions).not.toContain('Foods Musclog already knows');
    expect(instructions).not.toContain('foodId');
  });

  it('still hands out working instructions when the foods cannot be read', async () => {
    mockGetFoundationFoods.mockRejectedValue(new Error('db not ready'));

    const instructions = await loadFoodLogInstructions('en-US');

    expect(instructions).toContain('Musclog food tracking assistant');
    expect(instructions).not.toContain('Foods Musclog already knows');
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      'externalFoodLog.loadFoundationFoods'
    );
  });
});

describe('readExternalFoodLog', () => {
  it('returns the foods untouched, without a lookup, when none names a foundation id', async () => {
    const result = await readExternalFoodLog(text([rice]));

    expect(mockNormalize).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      skippedFoods: 0,
      unresolvedNames: [],
      ingredients: [{ name: 'White rice', kcal: 260, grams: 200, hasOwnMacros: true }],
    });
  });

  it('takes the macros of a matched foundation food from Musclog', async () => {
    mockNormalize.mockImplementation(async (ingredients: { kcal: number }[]) =>
      ingredients.map((ingredient) => ({ ...ingredient, kcal: 105, protein: 1.3, carbs: 27 }))
    );

    const result = await readExternalFoodLog(
      text([{ name: 'Banana', grams: 118, foodId: 'food-1' }])
    );

    expect(mockNormalize).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      ingredients: [{ name: 'Banana', foodId: 'food-1', kcal: 105, carbs: 27 }],
    });
  });

  it('leaves out a food whose id is unknown and that brought no numbers, rather than log 0 kcal', async () => {
    // The real lookup drops the id it cannot find and leaves the zeros it was given.
    mockNormalize.mockImplementation(async (ingredients: { foodId?: string }[]) =>
      ingredients.map(({ foodId: _gone, ...rest }) => rest)
    );

    const result = await readExternalFoodLog(
      text([{ name: 'Mystery fruit', grams: 100, foodId: 'nope' }, rice])
    );

    expect(result).toMatchObject({
      ok: true,
      unresolvedNames: ['Mystery fruit'],
      ingredients: [{ name: 'White rice' }],
    });
    expect(result.ok && result.ingredients).toHaveLength(1);
  });

  it('keeps a food with numbers of its own when its id is unknown', async () => {
    mockNormalize.mockImplementation(async (ingredients: { foodId?: string }[]) =>
      ingredients.map(({ foodId: _gone, ...rest }) => rest)
    );

    const result = await readExternalFoodLog(text([{ ...rice, foodId: 'nope' }]));

    expect(result).toMatchObject({
      ok: true,
      unresolvedNames: [],
      ingredients: [{ name: 'White rice', kcal: 260 }],
    });
  });

  it('reports no foods when nothing can be logged', async () => {
    mockNormalize.mockImplementation(async (ingredients: { foodId?: string }[]) =>
      ingredients.map(({ foodId: _gone, ...rest }) => rest)
    );

    expect(
      await readExternalFoodLog(text([{ name: 'Mystery', grams: 100, foodId: 'nope' }]))
    ).toEqual({
      ok: false,
      error: 'noFoods',
    });
  });

  it('passes a parse error straight through', async () => {
    expect(await readExternalFoodLog('not a file')).toEqual({ ok: false, error: 'notJson' });
  });

  it('lets a failed lookup reject so the foods are never logged at 0 kcal', async () => {
    mockNormalize.mockRejectedValue(new Error('lookup failed'));

    await expect(
      readExternalFoodLog(text([{ name: 'Banana', grams: 118, foodId: 'food-1' }]))
    ).rejects.toThrow('lookup failed');
  });
});

describe('logExternalFoods', () => {
  const date = new Date(2026, 10, 7);
  const time = new Date(2026, 10, 7, 13, 30);
  const ingredients = toIngredients([
    rice,
    { name: 'Chicken', grams: 150, calories: 248, protein: 46, carbs: 0, fat: 5.4 },
  ]);

  it('logs several foods the person grouped as one meal, under one group id and name', async () => {
    await logExternalFoods({
      ingredients,
      date,
      time,
      mealType: 'lunch',
      grouping: { group: true, mealName: 'Chicken and rice' },
    });

    expect(mockLogBatch).toHaveBeenCalledTimes(1);
    const [batch, loggedDate, mealType, options] = mockLogBatch.mock.calls[0];
    expect(batch).toEqual([
      expect.objectContaining({ name: 'White rice', calories: 260, grams: 200 }),
      expect.objectContaining({ name: 'Chicken', calories: 248, grams: 150 }),
    ]);
    expect(loggedDate).toBe(date);
    expect(mealType).toBe('lunch');
    expect(options).toEqual({
      consumedTime: time,
      groupId: expect.any(String),
      loggedMealName: 'Chicken and rice',
    });
  });

  it('logs loose entries, with no group id, when the switch is off', async () => {
    await logExternalFoods({
      ingredients,
      date,
      time,
      mealType: 'dinner',
      grouping: { group: false, mealName: 'Ignored' },
    });

    expect(mockLogBatch.mock.calls[0][3]).toEqual({ consumedTime: time });
  });

  it('never groups a single food, whatever the switch says', async () => {
    await logExternalFoods({
      ingredients: ingredients.slice(0, 1),
      date,
      time,
      mealType: 'snack',
      grouping: { group: true, mealName: 'Just rice' },
    });

    expect(mockLogBatch.mock.calls[0][3]).toEqual({ consumedTime: time });
  });

  it('names a grouped meal after its foods when the name was left blank', async () => {
    await logExternalFoods({
      ingredients,
      date,
      time,
      mealType: 'lunch',
      grouping: { group: true, mealName: '' },
    });

    expect(mockLogBatch.mock.calls[0][3].loggedMealName).toBe('White rice, Chicken');
  });
});
