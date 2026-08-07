import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { FoodPortionService } from '@/database/services/FoodPortionService';
import { FoodService } from '@/database/services/FoodService';
import { getProductName } from '@/utils/openFoodFactsMapper';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    lt: jest.fn((value: unknown) => ({ kind: 'lt', value })),
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

jest.mock('@/database/services/FoodPortionService', () => ({
  FoodPortionService: {
    createFoodPortion: jest.fn(),
    getPortionById: jest.fn(),
  },
}));

jest.mock('@/utils/openFoodFactsMapper', () => ({
  getProductName: jest.fn(() => 'Resolved product name'),
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockPortions = FoodPortionService as jest.Mocked<typeof FoodPortionService>;

const IS_NULL = { kind: 'eq', value: null };

function makeCollection(prefix: string, options: { find?: unknown; rows?: unknown[] } = {}) {
  const created: any[] = [];
  const queryClauses: unknown[][] = [];

  return {
    created,
    queryClauses,
    find: jest.fn().mockResolvedValue(options.find),
    create: jest.fn((callback: (r: any) => void) => {
      const record: any = { id: `${prefix}-${created.length + 1}` };
      callback(record);
      created.push(record);
      return record;
    }),
    query: jest.fn((...clauses: unknown[]) => {
      queryClauses.push(clauses);
      const built: any = {
        extend: jest.fn(() => built),
        fetch: jest.fn().mockResolvedValue(options.rows ?? []),
      };
      return built;
    }),
  };
}

type Collections = Record<string, ReturnType<typeof makeCollection>>;

/** Routes `database.get(table)` to a per-table stub, creating empty ones on demand. */
function wire(config: Record<string, { find?: unknown; rows?: unknown[] }> = {}): Collections {
  const map: Collections = {};
  mockDatabase.get.mockImplementation(
    ((table: string) => (map[table] ??= makeCollection(table, config[table] ?? {}))) as any
  );
  return map;
}

function stubFood(overrides: Record<string, unknown> = {}) {
  const record: any = {
    id: 'food-1',
    name: 'Greek yogurt',
    brand: 'Fage',
    barcode: '5201054000010',
    externalId: 'off-123',
    description: 'Milk, cultures',
    imageUrl: 'https://img/yogurt.jpg',
    isAiGenerated: false,
    calories: 97,
    protein: 9,
    carbs: 4,
    fat: 5,
    fiber: 0,
    micros: { sugar: 4 },
    isFavorite: true,
    source: 'openfood',
    deletedAt: undefined,
    ...overrides,
  };
  record.update = jest.fn(async (mutator: (r: any) => void) => mutator(record));
  record.markAsDeleted = jest.fn().mockResolvedValue(undefined);
  record.toggleFavorite = jest.fn().mockResolvedValue(undefined);
  record.prepareUpdate = jest.fn((mutator: (r: any) => void) => {
    mutator(record);
    return record;
  });
  return record;
}

const BASE_MACROS = { calories: 100, protein: 10, carbs: 5, fat: 2 };

describe('FoodService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPortions.createFoodPortion.mockResolvedValue({ id: 'portion-created' } as any);
    mockPortions.getPortionById.mockResolvedValue(null as any);
  });

  describe('createCustomFood — per_100g portion resolution', () => {
    it('creates a shared 100g mass portion and links it as the default', async () => {
      const map = wire();

      await FoodService.createCustomFood('Oats', BASE_MACROS);

      expect(mockPortions.createFoodPortion).toHaveBeenCalledWith('100g', 100, undefined, 'basic', {
        kind: 'mass',
        scope: 'global',
      });
      const [link] = map.food_food_portions.created;
      expect(link).toMatchObject({
        foodId: map.foods.created[0].id,
        foodPortionId: 'portion-created',
        isDefault: true,
      });
      expect(map.foods.created[0]).toMatchObject({
        source: 'user',
        nutritionBasis: 'per_100g',
        isFavorite: false,
        isAiGenerated: false,
      });
    });

    it('converts an ounce serving to grams and names the portion generically', async () => {
      wire();

      await FoodService.createCustomFood('Steak', BASE_MACROS, undefined, 4, 'oz');

      const [name, gramWeight] = mockPortions.createFoodPortion.mock.calls[0];
      expect(name).toBe('Default');
      expect(gramWeight).toBeCloseTo(113.398, 2);
    });

    it('treats millilitres as grams 1:1', async () => {
      wire();

      await FoodService.createCustomFood('Milk', BASE_MACROS, undefined, 250, 'ml');

      expect(mockPortions.createFoodPortion.mock.calls[0][1]).toBe(250);
    });

    it('reuses a selected portion as the default rather than minting a duplicate', async () => {
      const map = wire();
      mockPortions.getPortionById.mockResolvedValue({ id: 'portion-cup', gramWeight: 240 } as any);

      await FoodService.createCustomFood('Rice', BASE_MACROS, undefined, 100, 'g', undefined, {
        selectedPortionIds: ['portion-cup'],
      });

      expect(mockPortions.createFoodPortion).not.toHaveBeenCalled();
      expect(map.food_food_portions.created).toHaveLength(1);
      expect(map.food_food_portions.created[0]).toMatchObject({
        foodPortionId: 'portion-cup',
        isDefault: true,
      });
    });

    // A named portion with no gram weight cannot anchor per-100g maths, so it must not
    // become the default.
    it('falls back to a mass portion when the selected portion carries no gram weight', async () => {
      wire();
      mockPortions.getPortionById.mockResolvedValue({ id: 'portion-slice' } as any);

      await FoodService.createCustomFood('Bread', BASE_MACROS, undefined, 100, 'g', undefined, {
        selectedPortionIds: ['portion-slice'],
      });

      expect(mockPortions.createFoodPortion).toHaveBeenCalledTimes(1);
    });

    it('links the remaining selected portions as non-default without duplicating the default', async () => {
      const map = wire();
      mockPortions.getPortionById.mockResolvedValue({ id: 'portion-cup', gramWeight: 240 } as any);

      await FoodService.createCustomFood('Rice', BASE_MACROS, undefined, 100, 'g', undefined, {
        selectedPortionIds: ['portion-cup', 'portion-tbsp'],
      });

      expect(map.food_food_portions.created).toEqual([
        expect.objectContaining({ foodPortionId: 'portion-cup', isDefault: true }),
        expect.objectContaining({ foodPortionId: 'portion-tbsp', isDefault: false }),
      ]);
    });
  });

  describe('createCustomFood — per_serving', () => {
    it('creates a private named portion owned by the food instead of a shared mass portion', async () => {
      const map = wire();

      await FoodService.createCustomFood(
        'Protein bar',
        BASE_MACROS,
        undefined,
        60,
        'g',
        undefined,
        {
          nutritionBasis: 'per_serving',
          servingName: '  1 bar  ',
        }
      );

      expect(mockPortions.createFoodPortion).not.toHaveBeenCalled();
      const foodId = map.foods.created[0].id;
      expect(map.food_portions.created[0]).toMatchObject({
        name: '1 bar',
        source: 'custom',
        kind: 'named',
        scope: 'private',
        ownerType: 'food',
        ownerId: foodId,
      });
      expect(map.food_food_portions.created[0]).toMatchObject({
        foodPortionId: map.food_portions.created[0].id,
        isDefault: true,
      });
    });

    it('falls back to a generic serving name when the given one is blank', async () => {
      const map = wire();

      await FoodService.createCustomFood('Shake', BASE_MACROS, undefined, 300, 'ml', undefined, {
        nutritionBasis: 'per_serving',
        servingName: '   ',
      });

      expect(map.food_portions.created[0].name).toBe('1 serving');
    });
  });

  describe('macro normalisation', () => {
    it('clamps negative macros to zero and drops undefined micros', async () => {
      const map = wire();

      await FoodService.createCustomFood('Odd data', {
        calories: -50,
        protein: -1,
        carbs: 12,
        fat: -0.5,
        sugar: 3,
      });

      expect(map.foods.created[0]).toMatchObject({
        calories: 0,
        protein: 0,
        carbs: 12,
        fat: 0,
        fiber: 0,
        micros: { sugar: 3 },
      });
      expect(Object.keys(map.foods.created[0].micros)).toEqual(['sugar']);
    });
  });

  describe('createFromV3Product', () => {
    it('stores an Open Food Facts food per 100g with its default portion linked', async () => {
      const map = wire();

      const food = await FoodService.createFromV3Product(
        { code: '737628064502', brands: 'Acme', image_url: 'https://img', _id: 'off-abc' } as any,
        { ...BASE_MACROS, fiber: 2 }
      );

      expect(getProductName).toHaveBeenCalled();
      expect(map.foods.created[0]).toMatchObject({
        name: 'Resolved product name',
        brand: 'Acme',
        barcode: '737628064502',
        externalId: 'off-abc',
        source: 'openfood',
        nutritionBasis: 'per_100g',
        fiber: 2,
      });
      expect(map.food_food_portions.created[0]).toMatchObject({
        foodId: food.id,
        foodPortionId: 'portion-created',
        isDefault: true,
      });
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });

    it('prefers an explicitly supplied externalId over the product id', async () => {
      const map = wire();

      await FoodService.createFromV3Product(
        { code: '1', _id: 'off-abc' } as any,
        BASE_MACROS,
        null,
        'custom-external'
      );

      expect(map.foods.created[0].externalId).toBe('custom-external');
    });

    // Quality badges are optional; writing `undefined` would overwrite a real grade with
    // a blank one, so absent scores must leave the columns untouched.
    it('only writes quality badges that the product actually carries', async () => {
      const map = wire();

      await FoodService.createFromV3Product({ code: '1' } as any, {
        ...BASE_MACROS,
        nutriscore: 'a',
        novaGroup: 1,
      });

      const food = map.foods.created[0];
      expect(food.nutriscore).toBe('a');
      expect(food.novaGroup).toBe(1);
      expect('ecoscore' in food).toBe(false);
      expect('labels' in food).toBe(false);
    });

    it('reuses a caller-supplied portion instead of creating a 100g one', async () => {
      const map = wire();

      await FoodService.createFromV3Product({ code: '1' } as any, BASE_MACROS, {
        id: 'portion-custom',
      } as any);

      expect(mockPortions.createFoodPortion).not.toHaveBeenCalled();
      expect(map.food_food_portions.created[0].foodPortionId).toBe('portion-custom');
    });
  });

  describe('createFromMusclogProduct', () => {
    it('tags the source, uses the barcode as the external id and normalises quality scores', async () => {
      const map = wire();

      await FoodService.createFromMusclogProduct(
        { name: 'Kipfilet', brand: 'AH', nutriscore: 'B', novagroup: '2', vegan: false } as any,
        BASE_MACROS,
        '8710400011118'
      );

      expect(map.foods.created[0]).toMatchObject({
        name: 'Kipfilet',
        source: 'musclog',
        nutritionBasis: 'per_100g',
        barcode: '8710400011118',
        externalId: '8710400011118',
        nutriscore: 'b',
        novaGroup: 2,
        labels: { vegan: false },
      });
    });
  });

  describe('reads', () => {
    it('never returns a soft-deleted food by id, and swallows a lookup failure', async () => {
      const map = wire({ foods: { find: stubFood({ deletedAt: 5 }) } });
      await expect(FoodService.getFoodById('food-1')).resolves.toBeNull();

      map.foods.find.mockRejectedValue(new Error('no such row'));
      await expect(FoodService.getFoodById('food-1')).resolves.toBeNull();
    });

    it('returns null rather than an empty array when no barcode or external id matches', async () => {
      const map = wire({ foods: { rows: [] } });

      await expect(FoodService.getFoodByBarcode('000')).resolves.toBeNull();
      await expect(FoodService.getFoodByExternalId('missing')).resolves.toBeNull();
      expect(map.foods.queryClauses[0]).toEqual([
        { field: 'deleted_at', condition: IS_NULL },
        { field: 'barcode', condition: '000' },
      ]);
      expect(map.foods.queryClauses[1]).toEqual([
        { field: 'deleted_at', condition: IS_NULL },
        { field: 'external_id', condition: 'missing' },
      ]);
    });

    it('returns the first match for a barcode', async () => {
      const first = stubFood({ id: 'a' });
      wire({ foods: { rows: [first, stubFood({ id: 'b' })] } });

      await expect(FoodService.getFoodByBarcode('5201054000010')).resolves.toBe(first);
    });

    it('paginates newest-first, skipping only when the offset is non-zero', async () => {
      wire();

      await FoodService.getFoodsPaginated(20, 0);
      expect(Q.take).toHaveBeenCalledWith(20);
      expect(Q.skip).not.toHaveBeenCalled();

      jest.clearAllMocks();
      wire();
      await FoodService.getFoodsPaginated(20, 40);
      expect(Q.skip).toHaveBeenCalledWith(40);
      expect(Q.take).toHaveBeenCalledWith(20);
    });

    it('caps the foundation-food set the LLM prompt is built from', async () => {
      const map = wire();

      await FoodService.getFoundationFoods(50);

      expect(map.foods.queryClauses[0]).toEqual([
        { field: 'source', condition: 'foundation' },
        { field: 'deleted_at', condition: IS_NULL },
        { kind: 'take', count: 50 },
      ]);
    });
  });

  describe('updateFood', () => {
    it('leaves omitted fields alone and clamps the values it does write', async () => {
      const food = stubFood();
      wire({ foods: { find: food } });

      await FoodService.updateFood('food-1', { calories: -10, protein: 12 });

      expect(food.calories).toBe(0);
      expect(food.protein).toBe(12);
      expect(food.name).toBe('Greek yogurt');
      expect(food.brand).toBe('Fage');
      expect(food.imageUrl).toBe('https://img/yogurt.jpg');
    });

    it('clears the image only when imageUrl is present in the patch', async () => {
      const food = stubFood();
      wire({ foods: { find: food } });

      await FoodService.updateFood('food-1', { imageUrl: null });

      expect(food.imageUrl).toBeUndefined();
    });

    it('refuses to update a soft-deleted food', async () => {
      const food = stubFood({ deletedAt: 9 });
      wire({ foods: { find: food } });

      await expect(FoodService.updateFood('food-1', { name: 'x' })).rejects.toThrow(
        'Cannot update deleted food'
      );
      expect(food.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteFood', () => {
    it('cascades to meal_foods and portion links through callWriter in one transaction', async () => {
      const food = stubFood();
      const mealFoods = [stubFood({ id: 'mf-1' }), stubFood({ id: 'mf-2' })];
      const links = [stubFood({ id: 'ffp-1' })];
      const map = wire({
        foods: { find: food },
        meal_foods: { rows: mealFoods },
        food_food_portions: { rows: links },
      });

      const callWriter = jest.fn(async (fn: () => unknown) => fn());
      (mockDatabase.write as jest.Mock).mockImplementationOnce(
        async (callback: (writer: unknown) => unknown) => callback({ callWriter })
      );

      await FoodService.deleteFood('food-1');

      // One writer, four @writer calls joined into it — nesting database.write() here
      // would stall the queue.
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(callWriter).toHaveBeenCalledTimes(4);
      expect(food.markAsDeleted).toHaveBeenCalledTimes(1);
      expect(mealFoods.every((mf) => mf.markAsDeleted.mock.calls.length === 1)).toBe(true);
      expect(links[0].markAsDeleted).toHaveBeenCalledTimes(1);
      expect(map.meal_foods.queryClauses[0]).toEqual([
        { field: 'food_id', condition: 'food-1' },
        { field: 'deleted_at', condition: IS_NULL },
      ]);
    });
  });

  describe('toggleFavorite', () => {
    it('delegates to the model @writer without opening a nested write', async () => {
      const food = stubFood();
      wire({ foods: { find: food } });

      await expect(FoodService.toggleFavorite('food-1')).resolves.toBe(food);
      expect(food.toggleFavorite).toHaveBeenCalledTimes(1);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });

  describe('duplicateFood', () => {
    it('copies the macros and every portion link, unfavourited and suffixed', async () => {
      const original = stubFood();
      const map = wire({
        foods: { find: original },
        food_food_portions: {
          rows: [
            { foodPortionId: 'portion-a', isDefault: true },
            { foodPortionId: 'portion-b', isDefault: false },
          ],
        },
      });

      const copy = await FoodService.duplicateFood('food-1');

      expect(copy).toMatchObject({
        name: 'Greek yogurt (Copy)',
        isFavorite: false,
        calories: 97,
        protein: 9,
        externalId: 'off-123',
        source: 'openfood',
      });
      expect(map.food_food_portions.created).toEqual([
        expect.objectContaining({ foodId: copy.id, foodPortionId: 'portion-a', isDefault: true }),
        expect.objectContaining({ foodId: copy.id, foodPortionId: 'portion-b', isDefault: false }),
      ]);
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    });

    it('refuses to duplicate a soft-deleted food', async () => {
      wire({ foods: { find: stubFood({ deletedAt: 1 }) } });

      await expect(FoodService.duplicateFood('food-1')).rejects.toThrow(
        'Cannot duplicate deleted food'
      );
    });
  });

  describe('fixNegativeFiber', () => {
    it('opens no write when nothing is negative', async () => {
      wire({ foods: { rows: [] } });

      await FoodService.fixNegativeFiber();

      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(mockDatabase.batch).not.toHaveBeenCalled();
    });

    it('zeroes every negative fiber value in one batch', async () => {
      const broken = [stubFood({ id: 'a', fiber: -1 }), stubFood({ id: 'b', fiber: -3 })];
      const map = wire({ foods: { rows: broken } });

      await FoodService.fixNegativeFiber();

      expect(map.foods.queryClauses[0]).toEqual([
        { field: 'fiber', condition: { kind: 'lt', value: 0 } },
        { field: 'deleted_at', condition: IS_NULL },
      ]);
      expect(broken.map((f) => f.fiber)).toEqual([0, 0]);
      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect((mockDatabase.batch as jest.Mock).mock.calls[0]).toHaveLength(2);
      expect(broken[0].updatedAt).toBe(broken[1].updatedAt);
    });
  });
});
