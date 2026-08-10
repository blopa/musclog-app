import { database } from '@/database/database-instance';
import { importShareEnvelope } from '@/database/share/importShareEnvelope';
import {
  deleteFoodImage,
  deleteMealImage,
  saveBase64ImageToFile,
  saveBase64MealImage,
} from '@/utils/file';
import type { FoodShareEnvelope, MealShareEnvelope, ShareRow } from '@/utils/share/shareEnvelope';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    where: jest.fn((field: string, value: unknown) => ({ field, value })),
  },
}));

let mockInsideWrite = false;
const mockUnsafeResetDatabase = jest.fn();

jest.mock('@/database/database-instance', () => ({
  database: {
    batch: jest.fn(async () => undefined),
    get: jest.fn(),
    unsafeResetDatabase: mockUnsafeResetDatabase,
    write: jest.fn(async (callback: () => unknown) => {
      mockInsideWrite = true;
      try {
        return await callback();
      } finally {
        mockInsideWrite = false;
      }
    }),
  },
}));

jest.mock('@/utils/file', () => ({
  deleteFoodImage: jest.fn(async () => undefined),
  deleteMealImage: jest.fn(async () => undefined),
  saveBase64ImageToFile: jest.fn(async () => 'file:///food_images/imported.jpg'),
  saveBase64MealImage: jest.fn(async () => 'file:///meals/imported.jpg'),
}));

const mockDatabase = database as jest.Mocked<typeof database>;

interface EnvelopeOptions {
  image?: boolean;
  foodPortions?: ShareRow[];
  /** Attaches the ingredient to this portion, the way a real per-serving ingredient is stored. */
  ingredientPortionId?: string;
  /** Links the meal itself to this portion, the way a recipe serving size is stored. */
  mealPortionId?: string;
}

function envelope(options: EnvelopeOptions = {}): MealShareEnvelope {
  return {
    _musclogShare: 1,
    assets: options.image
      ? { mealImage: { base64: 'AQIDBA==', height: 1, mime: 'image/jpeg', width: 1 } }
      : undefined,
    createdAtMs: 1,
    kind: 'meal',
    kindVersion: 1,
    records: {
      food_food_portions: [],
      food_portions: options.foodPortions ?? [],
      foods: [
        {
          barcode: '123',
          calories: 100,
          carbs: 10,
          external_id: 'external-1',
          fat: 3,
          fiber: 1,
          id: 'sender-food',
          name: 'Shared food',
          nutrition_basis: 'per_100g',
          protein: 5,
        },
      ],
      meal_food_portions: options.mealPortionId
        ? [
            {
              food_portion_id: options.mealPortionId,
              id: 'sender-mfp',
              is_default: true,
              meal_id: 'sender-meal',
            },
          ]
        : [],
      meal_foods: [
        {
          amount: 100,
          food_id: 'sender-food',
          id: 'sender-mf',
          meal_id: 'sender-meal',
          ...(options.ingredientPortionId
            ? { portion_id: options.ingredientPortionId }
            : undefined),
        },
      ],
      meals: [
        {
          id: 'sender-meal',
          image_url: options.image ? 'share-asset:mealImage' : undefined,
          name: 'Shared meal',
        },
      ],
    },
    rootId: 'sender-meal',
    rootTable: 'meals',
    summary: {
      hasImage: Boolean(options.image),
      ingredients: [{ amount: 100, calories: 100, name: 'Shared food', unit: 'g' }],
      name: 'Shared meal',
      nutritionBasis: 'per_recipe',
      totals: { calories: 100, carbs: 10, fat: 3, fiber: 1, protein: 5 },
    },
  };
}

interface FoodEnvelopeOptions {
  image?: boolean;
  /** A portion private to the shared food, the shape a per-serving custom food stores. */
  ownedPortion?: boolean;
}

/**
 * A `food` share: the same food graph a meal share carries per ingredient, rooted at the food. It
 * reuses the meal envelope's food row deliberately — the two must dedupe against the same identity.
 */
function foodEnvelope(options: FoodEnvelopeOptions = {}): FoodShareEnvelope {
  return {
    _musclogShare: 1,
    assets: options.image
      ? { foodImage: { base64: 'AQIDBA==', height: 1, mime: 'image/jpeg', width: 1 } }
      : undefined,
    createdAtMs: 1,
    kind: 'food',
    kindVersion: 1,
    records: {
      food_food_portions: [
        {
          food_id: 'sender-food',
          food_portion_id: 'sender-portion',
          id: 'sender-link',
          is_default: true,
        },
      ],
      food_portions: [
        {
          gram_weight: 50,
          id: 'sender-portion',
          kind: 'mass',
          name: 'Scoop',
          scope: options.ownedPortion ? 'private' : 'global',
          source: 'basic',
          ...(options.ownedPortion
            ? { owner_id: 'sender-food', owner_type: 'food' }
            : undefined),
        },
      ],
      foods: [
        {
          barcode: '123',
          calories: 100,
          carbs: 10,
          external_id: 'external-1',
          fat: 3,
          fiber: 1,
          id: 'sender-food',
          image_url: options.image ? 'share-asset:foodImage' : undefined,
          name: 'Shared food',
          nutrition_basis: 'per_100g',
          protein: 5,
        },
      ],
    },
    rootId: 'sender-food',
    rootTable: 'foods',
    summary: {
      hasImage: Boolean(options.image),
      name: 'Shared food',
      nutrients: { calories: 100, carbs: 10, fat: 3, fiber: 1, protein: 5 },
      nutritionBasis: 'per_100g',
      portions: [{ gramWeight: 50, isDefault: true, name: 'Scoop' }],
    },
  };
}

/**
 * A food the receiver already has, carrying BOTH its raw columns (what the query clauses filter on)
 * and the model accessors the identity checks read. Keeping the two derived from one bag is what
 * lets the mock below apply clauses for real, so a test can no longer pass by handing every query
 * the same candidate.
 */
function storedFood(overrides: Record<string, unknown> = {}) {
  const columns = {
    barcode: '123',
    brand: null,
    calories: 100,
    carbs: 10,
    deleted_at: null,
    external_id: 'external-1',
    fat: 3,
    fiber: 1,
    id: 'local-food',
    name: 'Shared food',
    nutrition_basis: 'per_100g',
    protein: 5,
    ...overrides,
  };
  return {
    ...columns,
    brand: columns.brand ?? undefined,
    resolvedNutritionBasis: columns.nutrition_basis,
  };
}

function storedPortion(overrides: Record<string, unknown> = {}) {
  const columns = {
    deleted_at: null,
    gram_weight: 50,
    id: 'local-portion',
    kind: 'mass',
    name: 'Scoop',
    owner_id: null,
    owner_type: null,
    scope: 'global',
    source: 'basic',
    ...overrides,
  };
  return {
    ...columns,
    gramWeight: columns.gram_weight ?? undefined,
    resolvedKind: columns.kind === 'named' ? 'named' : 'mass',
    resolvedScope: columns.scope === 'private' ? 'private' : 'global',
    resolvedSource: columns.source === 'custom' ? 'custom' : 'basic',
  };
}

function matchesClauses(record: Record<string, unknown>, clauses: any[]): boolean {
  return clauses.every(({ field, value }) => {
    const expected = value && typeof value === 'object' && 'kind' in value ? value.value : value;
    return (record[field] ?? null) === (expected ?? null);
  });
}

function wire(stored: { foods?: unknown[]; food_portions?: unknown[] } = {}) {
  const created: Record<string, any[]> = {};
  const queriedTables: string[] = [];
  mockDatabase.get.mockImplementation(((table: string) => ({
    prepareCreate: (callback: (record: any) => void) => {
      const record = { _raw: {}, table };
      callback(record);
      (created[table] ??= []).push(record);
      return record;
    },
    query: (...clauses: any[]) => {
      queriedTables.push(table);
      const rows = (stored as Record<string, unknown[]>)[table] ?? [];
      return {
        fetch: jest
          .fn()
          .mockResolvedValue(rows.filter((row) => matchesClauses(row as any, clauses))),
      };
    },
  })) as any);
  return { created, queriedTables };
}

/**
 * `assignRawColumns` writes through camelCase model setters and only the id lands on `_raw`, so a
 * created record is read the same way the real models expose it.
 */
const createdId = (records: any[] | undefined, index = 0) => records?.[index]?._raw?.id;
const createdField = (records: any[] | undefined, field: string, index = 0) =>
  records?.[index]?.[field];

describe('importShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDatabase.batch as jest.Mock).mockImplementation(async () => {
      expect(mockInsideWrite).toBe(true);
    });
  });

  it('dedupes an external-id match and performs one non-destructive write', async () => {
    const { created } = wire({ foods: [storedFood()] });
    const result = await importShareEnvelope(envelope());

    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    expect(mockUnsafeResetDatabase).not.toHaveBeenCalled();
    expect(created.foods).toBeUndefined();
    expect(result.reused).toContainEqual({
      localId: 'local-food',
      sourceId: 'sender-food',
      table: 'foods',
    });
  });

  it('dedupes a barcode match even when no external id lines up', async () => {
    const { created } = wire({ foods: [storedFood({ external_id: 'other-external' })] });
    const result = await importShareEnvelope(envelope());

    expect(created.foods).toBeUndefined();
    expect(result.reused).toContainEqual({
      localId: 'local-food',
      sourceId: 'sender-food',
      table: 'foods',
    });
  });

  it('dedupes on exact name and macros when there is no barcode or external id', async () => {
    const { created } = wire({
      foods: [storedFood({ barcode: null, external_id: null })],
    });
    const bare = envelope();
    delete bare.records.foods[0].barcode;
    delete bare.records.foods[0].external_id;

    const result = await importShareEnvelope(bare);

    expect(created.foods).toBeUndefined();
    expect(result.reused).toContainEqual({
      localId: 'local-food',
      sourceId: 'sender-food',
      table: 'foods',
    });
  });

  // The three lookups are an OR, not a short circuit: a barcoded ingredient whose barcode nothing
  // answers still gets the name + macros check, so it matches the copy a receiver typed in by hand.
  it('falls through to name and macros when the incoming barcode matches nothing', async () => {
    const { created } = wire({
      foods: [storedFood({ barcode: null, external_id: null })],
    });
    const result = await importShareEnvelope(envelope());

    expect(created.foods).toBeUndefined();
    expect(result.reused).toContainEqual({
      localId: 'local-food',
      sourceId: 'sender-food',
      table: 'foods',
    });
  });

  it('never reuses a same-named food whose macros differ', async () => {
    const { created } = wire({
      foods: [storedFood({ barcode: null, external_id: null, protein: 6 })],
    });
    const bare = envelope();
    delete bare.records.foods[0].barcode;
    delete bare.records.foods[0].external_id;

    const result = await importShareEnvelope(bare);

    expect(created.foods).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(0);
  });

  it('never reuses a food across a nutrition-basis mismatch', async () => {
    const { created } = wire({ foods: [storedFood({ nutrition_basis: 'per_serving' })] });
    const result = await importShareEnvelope(envelope());

    expect(created.foods).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(0);
  });

  it('only looks for matches in the tables the kind spec marks for dedupe', async () => {
    // The strategy per table lives in MEAL_SHARE_SPEC.dedupe, not in this module. Tables left at
    // the default 'create' must never be queried, so an imported meal is always a new meal.
    const { created, queriedTables } = wire({ foods: [storedFood()] });
    const result = await importShareEnvelope(envelope());

    expect(queriedTables).toContain('foods');
    expect(queriedTables).not.toContain('meals');
    expect(queriedTables).not.toContain('meal_foods');
    expect(created.meals).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'meals')).toHaveLength(0);
  });

  it('removes a written asset when the batch fails', async () => {
    wire();

    (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));

    await expect(importShareEnvelope(envelope({ image: true }))).rejects.toThrow('batch failed');
    expect(saveBase64MealImage).toHaveBeenCalledTimes(1);
    expect(deleteMealImage).toHaveBeenCalledWith('file:///meals/imported.jpg');
    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockUnsafeResetDatabase).not.toHaveBeenCalled();
  });

  describe('food share', () => {
    it('creates the food, its portions and their links when nothing matches', async () => {
      const { created } = wire();
      const result = await importShareEnvelope(foodEnvelope());

      expect(created.foods).toHaveLength(1);
      expect(created.food_portions).toHaveLength(1);
      expect(created.food_food_portions).toHaveLength(1);
      expect(createdField(created.food_food_portions, 'foodId')).toBe(createdId(created.foods));
      expect(createdField(created.food_food_portions, 'foodPortionId')).toBe(
        createdId(created.food_portions)
      );
      expect(result.rootId).toBe(createdId(created.foods));
    });

    // A food-private portion is only meaningful under its owner, and in this kind the only owner is
    // the shared food itself — so it must point at the copy that was just created.
    it('repoints a food-private portion at the newly created food', async () => {
      const { created } = wire();
      await importShareEnvelope(foodEnvelope({ ownedPortion: true }));

      expect(createdField(created.food_portions, 'ownerId')).toBe(createdId(created.foods));
      expect(createdField(created.food_portions, 'ownerType')).toBe('food');
    });

    // The whole envelope is one food. When the receiver already has it, the share collapses to
    // nothing written at all — the existing food keeps the portions it already had.
    it('writes nothing when the receiver already has the food', async () => {
      const { created } = wire({ foods: [storedFood()] });
      const result = await importShareEnvelope(foodEnvelope());

      expect(created.foods).toBeUndefined();
      expect(created.food_portions).toBeUndefined();
      expect(created.food_food_portions).toBeUndefined();
      expect(result.rootId).toBe('local-food');
      expect(result.reused).toContainEqual({
        localId: 'local-food',
        sourceId: 'sender-food',
        table: 'foods',
      });
    });

    it('reuses a portion the receiver already has under the same food', async () => {
      const { created } = wire({
        foods: [storedFood()],
        food_portions: [
          storedPortion({ owner_id: 'local-food', owner_type: 'food', scope: 'private' }),
        ],
      });
      const result = await importShareEnvelope(foodEnvelope({ ownedPortion: true }));

      expect(created.food_portions).toBeUndefined();
      expect(result.reused).toContainEqual({
        localId: 'local-portion',
        sourceId: 'sender-portion',
        table: 'food_portions',
      });
    });

    // A shared food's photo belongs beside the app's other food photos, not in the meals folder.
    it('writes its photo to the food image store and takes it back if the batch fails', async () => {
      wire();
      await importShareEnvelope(foodEnvelope({ image: true }));

      expect(saveBase64ImageToFile).toHaveBeenCalledTimes(1);
      expect(saveBase64MealImage).not.toHaveBeenCalled();

      (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));
      await expect(importShareEnvelope(foodEnvelope({ image: true }))).rejects.toThrow(
        'batch failed'
      );
      expect(deleteFoodImage).toHaveBeenCalledWith('file:///food_images/imported.jpg');
      expect(deleteMealImage).not.toHaveBeenCalled();
    });
  });

  describe('portion dedupe', () => {
    const globalPortion = (overrides: ShareRow = {}): ShareRow => ({
      gram_weight: 50,
      id: 'sender-portion',
      kind: 'mass',
      name: 'Scoop',
      scope: 'global',
      source: 'basic',
      ...overrides,
    });

    // A per-serving custom food stores its serving as a portion PRIVATE to that food
    // (`FoodService.createCustomFood`), which is the shape that used to be recreated every time.
    const ownedPortion = (overrides: ShareRow = {}): ShareRow => ({
      id: 'sender-portion',
      kind: 'named',
      name: '1 serving',
      owner_id: 'sender-food',
      owner_type: 'food',
      scope: 'private',
      source: 'custom',
      ...overrides,
    });

    it('reuses a global portion with the same name and size', async () => {
      const { created } = wire({ food_portions: [storedPortion()] });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [globalPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(created.food_portions).toBeUndefined();
      expect(result.reused).toContainEqual({
        localId: 'local-portion',
        sourceId: 'sender-portion',
        table: 'food_portions',
      });
      expect(createdField(created.meal_foods, 'portionId')).toBe('local-portion');
    });

    // `forcedColumns` stamps every imported portion `custom`, so a first receive turns the sender's
    // `basic` portion into a local `custom` one. Matching on source would make the second receive
    // duplicate it, and the third duplicate it again.
    it('reuses a portion whose source differs, so receiving the same meal twice adds nothing', async () => {
      const { created } = wire({ food_portions: [storedPortion({ source: 'custom' })] });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [globalPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(created.food_portions).toBeUndefined();
      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(1);
    });

    it.each([
      ['the size differs', { gram_weight: 60 }],
      ['the name differs', { name: 'Ladle' }],
      ['a mass portion faces a named one', { gram_weight: null, kind: 'named' }],
      ['a global portion faces a private one', { scope: 'private' }],
    ])('never reuses a global portion when %s', async (_label, overrides) => {
      const { created } = wire({ food_portions: [storedPortion(overrides)] });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [globalPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(created.food_portions).toHaveLength(1);
      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
    });

    it('reuses a food-private portion when the receiver already had the owning food', async () => {
      const { created } = wire({
        foods: [storedFood()],
        food_portions: [
          storedPortion({
            gram_weight: null,
            id: 'local-serving',
            kind: 'named',
            name: '1 serving',
            owner_id: 'local-food',
            owner_type: 'food',
            scope: 'private',
            source: 'custom',
          }),
        ],
      });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [ownedPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(created.food_portions).toBeUndefined();
      expect(result.reused).toContainEqual({
        localId: 'local-serving',
        sourceId: 'sender-portion',
        table: 'food_portions',
      });
      expect(createdField(created.meal_foods, 'portionId')).toBe('local-serving');
    });

    // Scoping is enforced by the query, not by the identity check: an identical portion hanging off
    // some other food must not be borrowed.
    it('never reuses an identical portion owned by a different food', async () => {
      const { created } = wire({
        foods: [storedFood()],
        food_portions: [
          storedPortion({
            gram_weight: null,
            id: 'other-foods-serving',
            kind: 'named',
            name: '1 serving',
            owner_id: 'some-other-food',
            owner_type: 'food',
            scope: 'private',
            source: 'custom',
          }),
        ],
      });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [ownedPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(created.food_portions).toHaveLength(1);
      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(createdField(created.food_portions, 'ownerId')).toBe('local-food');
    });

    it('never reuses a food-private portion when the owning food is created fresh', async () => {
      const { created } = wire({
        food_portions: [
          storedPortion({
            gram_weight: null,
            id: 'local-serving',
            kind: 'named',
            name: '1 serving',
            owner_id: 'local-food',
            owner_type: 'food',
            scope: 'private',
            source: 'custom',
          }),
        ],
      });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [ownedPortion()], ingredientPortionId: 'sender-portion' })
      );

      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(created.food_portions).toHaveLength(1);
      // The fresh portion hangs off the food that was just created, never off the receiver's.
      expect(createdField(created.food_portions, 'ownerId')).toBe(createdId(created.foods));
      expect(createdField(created.food_portions, 'ownerId')).not.toBe('local-food');
    });

    // The meal is the share's root and is always new, so there is no existing owner to match
    // against — a meal-owned portion must be recreated even when its name and size look familiar.
    it('never reuses a meal-owned portion', async () => {
      const { created } = wire({
        foods: [storedFood()],
        food_portions: [
          storedPortion({
            gram_weight: null,
            id: 'local-bowl',
            kind: 'named',
            name: 'Bowl',
            owner_id: 'local-meal',
            owner_type: 'meal',
            scope: 'private',
            source: 'custom',
          }),
        ],
      });
      const senderBowl = ownedPortion({
        id: 'sender-bowl',
        name: 'Bowl',
        owner_id: 'sender-meal',
        owner_type: 'meal',
      });
      const result = await importShareEnvelope(
        envelope({ foodPortions: [senderBowl], mealPortionId: 'sender-bowl' })
      );

      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(created.food_portions).toHaveLength(1);
      expect(createdField(created.food_portions, 'ownerId')).toBe(createdId(created.meals));
    });
  });
});
