import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { MealService } from '@/database/services/MealService';
import { handleError } from '@/utils/handleError';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    gte: jest.fn((value: unknown) => ({ kind: 'gte', value })),
    oneOf: jest.fn((values: unknown[]) => ({ kind: 'oneOf', values })),
    like: jest.fn((value: unknown) => ({ kind: 'like', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    skip: jest.fn((count: number) => ({ kind: 'skip', count })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback: (writer: unknown) => unknown) =>
      callback({ callWriter: (fn: () => unknown) => fn() })
    ),
    batch: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/constants/database', () => ({
  REPAIR_DESCRIPTORS: { meals: 'meals' },
}));

jest.mock('@/database/services/DatabaseRepairService', () => ({
  DatabaseRepairService: {},
  retryAfterRepair: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { retryAfterRepair } = require('@/database/services/DatabaseRepairService');

const mockDatabase = database as jest.Mocked<typeof database>;

const IS_NULL = { kind: 'eq', value: null };

function makeCollection(prefix: string, options: { find?: unknown; rows?: unknown[] } = {}) {
  const created: any[] = [];
  const queryClauses: unknown[][] = [];
  const query = jest.fn((...clauses: unknown[]) => {
    queryClauses.push(clauses);
    const built: any = {
      extend: jest.fn(() => built),
      fetch: jest.fn().mockResolvedValue(options.rows ?? []),
    };
    return built;
  });

  return {
    created,
    query,
    queryClauses,
    find: jest.fn().mockResolvedValue(options.find),
    create: jest.fn((callback: (r: any) => void) => {
      const record: any = { id: `${prefix}-${created.length + 1}` };
      callback(record);
      created.push(record);
      return record;
    }),
    prepareCreate: jest.fn((callback: (r: any) => void) => {
      const record: any = { id: `${prefix}-${created.length + 1}` };
      callback(record);
      created.push(record);
      return record;
    }),
  };
}

type Wired = {
  meals: ReturnType<typeof makeCollection>;
  mealFoods: ReturnType<typeof makeCollection>;
  nutritionLogs: ReturnType<typeof makeCollection>;
};

function wire(
  options: {
    mealFind?: unknown;
    mealRows?: unknown[];
    mealFoodFind?: unknown;
    mealFoodRows?: unknown[];
    nutritionLogRows?: unknown[];
  } = {}
): Wired {
  const meals = makeCollection('meal', { find: options.mealFind, rows: options.mealRows });
  const mealFoods = makeCollection('meal-food', {
    find: options.mealFoodFind,
    rows: options.mealFoodRows,
  });
  const nutritionLogs = makeCollection('nutrition-log', {
    rows: options.nutritionLogRows,
  });

  mockDatabase.get.mockImplementation(((table: string) => {
    if (table === 'meals') return meals;
    if (table === 'nutrition_logs') return nutritionLogs;
    return mealFoods;
  }) as any);

  return { meals, mealFoods, nutritionLogs };
}

/** A stored meal; `foods` is what `meal.mealFoods.fetch()` resolves to. */
function stubMeal(overrides: Record<string, unknown> = {}, foods: unknown[] = []) {
  const record: any = {
    id: 'meal-1',
    name: 'Chicken bowl',
    description: 'Weeknight staple',
    isFavorite: false,
    isAiGenerated: false,
    preparedWeightGrams: 500,
    nutritionBasis: 'per_recipe',
    recipeServingsCount: 2,
    defaultPortionName: 'bowl',
    servingGrams: 250,
    imageUrl: 'file://meal.jpg',
    deletedAt: undefined,
    ...overrides,
  };
  record.mealFoods = { fetch: jest.fn().mockResolvedValue(foods) };
  record.update = jest.fn(async (mutator: (r: any) => void) => mutator(record));
  record.markAsDeleted = jest.fn().mockResolvedValue(undefined);
  record.toggleFavorite = jest.fn().mockResolvedValue(undefined);
  return record;
}

function stubMealFood(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'meal-food-1',
    mealId: 'meal-1',
    foodId: 'food-1',
    amount: 120,
    portionId: 'portion-1',
    deletedAt: undefined,
    ...overrides,
  };
  record.markAsDeleted = jest.fn().mockResolvedValue(undefined);
  record.updateAmount = jest.fn().mockResolvedValue(undefined);
  return record;
}

describe('MealService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retryAfterRepair as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createMealFromFoods — validation', () => {
    it('refuses an empty meal before opening a write', async () => {
      wire();

      await expect(MealService.createMealFromFoods('Empty', [])).rejects.toThrow(
        'Cannot save meal without any food items'
      );
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it.each([
      ['a blank foodId', { foodId: '', amount: 100 }],
      ['a zero amount', { foodId: 'food-1', amount: 0 }],
      ['a negative amount', { foodId: 'food-1', amount: -5 }],
      ['a non-finite amount', { foodId: 'food-1', amount: Number.NaN }],
    ])('rejects %s before opening a write', async (_label, item) => {
      wire();

      await expect(MealService.createMealFromFoods('Bad', [item])).rejects.toThrow(
        /Cannot save meal with invalid food item/
      );
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });

  describe('createMealFromFoods — write path', () => {
    it('batches the meal and its foods in one write, linking foods to the new meal', async () => {
      const { meals, mealFoods } = wire({ mealFind: stubMeal({}, [{}, {}]) });

      const meal = await MealService.createMealFromFoods('Chicken bowl', [
        { foodId: 'food-1', amount: 150 },
        { foodId: 'food-2', amount: 80, portionId: 'portion-9' },
      ]);

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      const batched = (mockDatabase.batch as jest.Mock).mock.calls[0];
      expect(batched[0]).toBe(meal);
      expect(batched).toHaveLength(3);
      expect(mealFoods.created.map((f) => f.mealId)).toEqual([meal.id, meal.id]);
      expect(mealFoods.created.map((f) => f.amount)).toEqual([150, 80]);
      expect(mealFoods.created[1].portionId).toBe('portion-9');
      expect(meals.created[0]).toMatchObject({
        name: 'Chicken bowl',
        description: '',
        isFavorite: false,
        isAiGenerated: false,
        nutritionBasis: 'per_recipe',
        recipeServingsCount: 1,
      });
    });

    it('keeps the AI flag and the recipe options it was given', async () => {
      const { meals } = wire({ mealFind: stubMeal({}, [{}]) });

      await MealService.createMealFromFoods(
        'AI dinner',
        [{ foodId: 'food-1', amount: 100 }],
        'Generated',
        true,
        640,
        { nutritionBasis: 'per_serving', recipeServingsCount: 4, servingGrams: 160 }
      );

      expect(meals.created[0]).toMatchObject({
        isAiGenerated: true,
        description: 'Generated',
        preparedWeightGrams: 640,
        nutritionBasis: 'per_serving',
        recipeServingsCount: 4,
        servingGrams: 160,
      });
    });

    // A meal saved without its meal_food rows looks fine in the list but has no macros,
    // so the save verifies itself rather than trusting the batch.
    it('fails loudly when fewer meal_food rows come back than were written', async () => {
      wire({ mealFind: stubMeal({}, [{}]) });

      await expect(
        MealService.createMealFromFoods('Chicken bowl', [
          { foodId: 'food-1', amount: 150 },
          { foodId: 'food-2', amount: 80 },
        ])
      ).rejects.toThrow('expected 2 meal_food rows but found 1');
    });

    it('fails loudly when the saved meal has no meal_food rows at all', async () => {
      wire({ mealFind: stubMeal({}, []) });

      await expect(
        MealService.createMealFromFoods('Chicken bowl', [{ foodId: 'food-1', amount: 150 }])
      ).rejects.toThrow('meal was saved without any meal_food rows');
    });

    it('fails loudly when the meal cannot be reloaded after the save', async () => {
      wire({ mealFind: stubMeal({ deletedAt: 1 }, [{}]) });

      await expect(
        MealService.createMealFromFoods('Chicken bowl', [{ foodId: 'food-1', amount: 150 }])
      ).rejects.toThrow('meal could not be reloaded after save');
    });
  });

  describe('reads', () => {
    it('paginates newest-first and only takes when the offset is zero', async () => {
      const { meals } = wire();

      await MealService.getMealsPaginated(25, 0);

      expect(Q.where).toHaveBeenCalledWith('deleted_at', IS_NULL);
      expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(Q.take).toHaveBeenCalledWith(25);
      expect(Q.skip).not.toHaveBeenCalled();
      expect(meals.queryClauses[0]).toHaveLength(2);
    });

    it('skips then takes for a later page, and paginates nothing for a non-positive limit', async () => {
      wire();

      await MealService.getMealsPaginated(25, 50);
      expect(Q.skip).toHaveBeenCalledWith(50);
      expect(Q.take).toHaveBeenCalledWith(25);

      jest.clearAllMocks();
      wire();
      await MealService.getMealsPaginated(0, 0);
      expect(Q.take).not.toHaveBeenCalled();
      expect(Q.skip).not.toHaveBeenCalled();
    });

    it('searches by a wildcard name match, still excluding soft-deleted meals', async () => {
      wire();

      await MealService.searchMeals('chick');

      expect(Q.like).toHaveBeenCalledWith('%chick%');
      expect(Q.where).toHaveBeenCalledWith('deleted_at', IS_NULL);
    });

    it('hides soft-deleted meal_foods from a loaded meal', async () => {
      const live = stubMealFood({ id: 'live' });
      const removed = stubMealFood({ id: 'removed', deletedAt: 123 });
      wire({ mealFind: stubMeal({}, [live, removed]) });

      const result = await MealService.getMealWithFoods('meal-1');

      expect(result?.foods).toEqual([live]);
    });

    it('treats a soft-deleted meal as missing', async () => {
      wire({ mealFind: stubMeal({ deletedAt: 999 }) });

      await expect(MealService.getMealWithFoods('meal-1')).resolves.toBeNull();
      await expect(MealService.getMealImageUrl('meal-1')).resolves.toBeUndefined();
    });

    it('reports a load failure and resolves to null instead of throwing at the caller', async () => {
      const { meals } = wire();
      meals.find.mockRejectedValue(new Error('database disk image is malformed'));

      await expect(MealService.getMealWithFoods('meal-1')).resolves.toBeNull();
      expect(retryAfterRepair).toHaveBeenCalledWith(
        expect.any(Error),
        'meals',
        expect.any(Function)
      );
      expect(handleError).toHaveBeenCalledWith(
        expect.any(Error),
        'MealService.getMealWithFoods',
        expect.objectContaining({ showSnackbar: false })
      );
    });

    it('orders non-favourite meals by how often they were logged, then newest first', async () => {
      // Logs link back to a saved meal by `logged_meal_name` — never by `group_id`, which
      // is a per-log-instance UUID. A fixture keyed on meal ids would pass against a
      // frequency map that can never match anything in production.
      wire({
        mealRows: [
          stubMeal({ id: 'a', name: 'Favourite', isFavorite: true }),
          stubMeal({ id: 'b', name: 'Never logged, newest', createdAt: 100 }),
          stubMeal({ id: 'c', name: 'Logged twice', createdAt: 10 }),
          stubMeal({ id: 'd', name: 'Logged once', createdAt: 50 }),
          stubMeal({ id: 'e', name: 'Never logged, oldest', createdAt: 0 }),
        ],
        nutritionLogRows: [
          // One meal logged twice; the first occurrence spans two ingredient rows that
          // share a group id and must count once.
          { id: 'l1', loggedMealName: 'Logged twice', groupId: 'g1', date: 1000 },
          { id: 'l2', loggedMealName: 'Logged twice', groupId: 'g1', date: 1000 },
          { id: 'l3', loggedMealName: 'Logged twice', groupId: 'g2', date: 2000 },
          // A single-food log carries no group id and still counts as one occurrence.
          { id: 'l4', loggedMealName: 'Logged once', date: 3000 },
        ],
      });

      const suggestions = await MealService.getMealSuggestions(3);

      expect(suggestions.map((m) => m.id)).toEqual(['c', 'd', 'b']);
    });

    it('looks logs up by meal name, not by meal id', async () => {
      const { nutritionLogs } = wire({
        mealRows: [stubMeal({ id: 'a', name: 'Chicken bowl' })],
        nutritionLogRows: [],
      });

      await MealService.getMealSuggestions(5);

      const clauses = nutritionLogs.query.mock.calls[0] ?? [];
      expect(JSON.stringify(clauses)).toContain('logged_meal_name');
      expect(JSON.stringify(clauses)).toContain('Chicken bowl');
      expect(JSON.stringify(clauses)).not.toContain('group_id');
    });

    it('does not query at all when every meal is a favourite', async () => {
      const { nutritionLogs } = wire({
        mealRows: [stubMeal({ id: 'a', isFavorite: true })],
      });

      await expect(MealService.getMealSuggestions(5)).resolves.toEqual([]);
      expect(nutritionLogs.query).not.toHaveBeenCalled();
    });
  });

  describe('updateMeal', () => {
    it('reads the meal inside the write so the deleted-check and the update are atomic', async () => {
      const { meals } = wire({ mealFind: stubMeal() });

      (mockDatabase.write as jest.Mock).mockImplementationOnce(async (callback: () => unknown) => {
        expect(meals.find).not.toHaveBeenCalled();
        return await callback();
      });

      await MealService.updateMeal('meal-1', { name: 'Renamed' });

      expect(meals.find).toHaveBeenCalledTimes(1);
    });

    it('leaves untouched every field the patch omits', async () => {
      const meal = stubMeal();
      wire({ mealFind: meal });

      await MealService.updateMeal('meal-1', { name: 'Renamed' });

      expect(meal.name).toBe('Renamed');
      expect(meal.description).toBe('Weeknight staple');
      expect(meal.imageUrl).toBe('file://meal.jpg');
      expect(meal.servingGrams).toBe(250);
      expect(meal.preparedWeightGrams).toBe(500);
    });

    // The nullable fields use `in updates`, not `!== undefined`, so an explicit null clears.
    it('clears nullable fields when they are explicitly set to null', async () => {
      const meal = stubMeal();
      wire({ mealFind: meal });

      await MealService.updateMeal('meal-1', {
        imageUrl: null,
        preparedWeightGrams: null,
        recipeServingsCount: null,
        defaultPortionName: null,
        servingGrams: null,
      });

      expect(meal.imageUrl).toBeUndefined();
      expect(meal.preparedWeightGrams).toBeUndefined();
      expect(meal.recipeServingsCount).toBeUndefined();
      expect(meal.defaultPortionName).toBeUndefined();
      expect(meal.servingGrams).toBeUndefined();
    });

    it('refuses to update a soft-deleted meal', async () => {
      const meal = stubMeal({ deletedAt: 42 });
      wire({ mealFind: meal });

      await expect(MealService.updateMeal('meal-1', { name: 'x' })).rejects.toThrow(
        'Cannot update deleted meal'
      );
      expect(meal.update).not.toHaveBeenCalled();
    });
  });

  describe('writer nesting', () => {
    // `MealFood.updateAmount` is a @writer; nesting a second database.write() around it
    // would stall the write queue, so it has to join the open one via callWriter.
    it('runs updateMealFoodAmount through callWriter inside a single transaction', async () => {
      const mealFood = stubMealFood();
      wire({ mealFoodFind: mealFood });
      const callWriter = jest.fn(async (fn: () => unknown) => fn());
      (mockDatabase.write as jest.Mock).mockImplementationOnce(
        async (callback: (writer: unknown) => unknown) => callback({ callWriter })
      );

      await MealService.updateMealFoodAmount('meal-food-1', 250);

      expect(callWriter).toHaveBeenCalledTimes(1);
      expect(mealFood.updateAmount).toHaveBeenCalledWith(250);
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });

    it('refuses to change the amount of a removed meal food', async () => {
      const mealFood = stubMealFood({ deletedAt: 7 });
      wire({ mealFoodFind: mealFood });

      await expect(MealService.updateMealFoodAmount('meal-food-1', 250)).rejects.toThrow(
        'Cannot update deleted meal food'
      );
      expect(mealFood.updateAmount).not.toHaveBeenCalled();
    });

    it.each([
      ['deleteMeal', () => MealService.deleteMeal('meal-1')],
      ['toggleMealFavorite', () => MealService.toggleMealFavorite('meal-1')],
      ['removeFoodFromMeal', () => MealService.removeFoodFromMeal('meal-food-1')],
    ])('%s delegates to the model @writer without opening a nested write', async (_name, run) => {
      wire({ mealFind: stubMeal(), mealFoodFind: stubMealFood() });

      await run();

      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });

  describe('duplicateMeal', () => {
    it('copies live foods only and starts the copy unfavourited', async () => {
      const original = stubMeal({ isFavorite: true }, [
        stubMealFood({ id: 'live', amount: 120 }),
        stubMealFood({ id: 'gone', deletedAt: 5 }),
      ]);
      const { meals, mealFoods } = wire({ mealFind: original });

      const copy = await MealService.duplicateMeal('meal-1');

      expect(meals.created[0].name).toBe('Chicken bowl (Copy)');
      expect(meals.created[0].isFavorite).toBe(false);
      expect(mealFoods.created).toHaveLength(1);
      expect(mealFoods.created[0]).toMatchObject({ mealId: copy.id, amount: 120 });
      expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
      expect((mockDatabase.batch as jest.Mock).mock.calls[0]).toHaveLength(2);
    });

    it('honours an explicit new name and carries the recipe shape across', async () => {
      const { meals } = wire({ mealFind: stubMeal({}, []) });

      await MealService.duplicateMeal('meal-1', 'Meal prep v2');

      expect(meals.created[0]).toMatchObject({
        name: 'Meal prep v2',
        nutritionBasis: 'per_recipe',
        recipeServingsCount: 2,
        defaultPortionName: 'bowl',
        servingGrams: 250,
        preparedWeightGrams: 500,
      });
    });

    it('refuses to duplicate a soft-deleted meal', async () => {
      wire({ mealFind: stubMeal({ deletedAt: 3 }) });

      await expect(MealService.duplicateMeal('meal-1')).rejects.toThrow(
        'Cannot duplicate deleted meal'
      );
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });
});
