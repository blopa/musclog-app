import { database } from '@/database/database-instance';
import { importShareEnvelope } from '@/database/share/importShareEnvelope';
import {
  deleteFoodImage,
  deleteMealImage,
  saveBase64ImageToFile,
  saveBase64MealImage,
} from '@/utils/file';
import type {
  FoodShareEnvelope,
  MealShareEnvelope,
  NutritionDayShareEnvelope,
  ShareRow,
} from '@/utils/share/shareEnvelope';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    gte: jest.fn((value: unknown) => ({ kind: 'gte', value })),
    lt: jest.fn((value: unknown) => ({ kind: 'lt', value })),
    oneOf: jest.fn((values: unknown[]) => ({ kind: 'oneOf', values })),
    where: jest.fn((field: string, value: unknown) => ({ field, value })),
  },
}));

// The receiver re-encrypts the plaintext macro snapshot with ITS key; the values themselves are not
// what these tests are about, so the transform is stubbed to something recognisable.
jest.mock('@/database/encryptionHelpers', () => ({
  encryptNutritionLogSnapshot: jest.fn(async (plain: Record<string, unknown>) => ({
    loggedCalories: `enc:${plain.loggedCalories}`,
    loggedCarbs: `enc:${plain.loggedCarbs}`,
    loggedFat: `enc:${plain.loggedFat}`,
    loggedFiber: `enc:${plain.loggedFiber}`,
    loggedFoodName: `enc:${plain.loggedFoodName ?? ''}`,
    loggedMicrosJson: 'enc:{}',
    loggedProtein: `enc:${plain.loggedProtein}`,
  })),
  readPlainNutritionLogSnapshotRow: jest.fn((row: Record<string, unknown>) => ({
    loggedCalories: Number(row.logged_calories ?? 0),
    loggedCarbs: Number(row.logged_carbs ?? 0),
    loggedFat: Number(row.logged_fat ?? 0),
    loggedFiber: Number(row.logged_fiber ?? 0),
    loggedFoodName: row.logged_food_name,
    loggedProtein: Number(row.logged_protein ?? 0),
  })),
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
          ...(options.ownedPortion ? { owner_id: 'sender-food', owner_type: 'food' } : undefined),
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
    externalId: columns.external_id ?? undefined,
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
    ownerId: columns.owner_id ?? undefined,
    ownerType: columns.owner_type ?? undefined,
    resolvedKind: columns.kind === 'named' ? 'named' : 'mass',
    resolvedScope: columns.scope === 'private' ? 'private' : 'global',
    resolvedSource: columns.source === 'custom' ? 'custom' : 'basic',
  };
}

function matchesClauses(record: Record<string, unknown>, clauses: any[]): boolean {
  return clauses.every(({ field, value }) => {
    if (value?.kind === 'oneOf') {
      return value.values.includes(record[field] ?? null);
    }
    if (value?.kind === 'gte') {
      return Number(record[field]) >= Number(value.value);
    }
    if (value?.kind === 'lt') {
      return Number(record[field]) < Number(value.value);
    }
    const expected = value?.kind === 'eq' ? value.value : value;
    return (record[field] ?? null) === (expected ?? null);
  });
}

function wire(
  stored: { foods?: unknown[]; food_portions?: unknown[]; nutrition_logs?: unknown[] } = {}
) {
  const created: Record<string, any[]> = {};
  const queriedTables: string[] = [];
  mockDatabase.get.mockImplementation(((table: string) => ({
    prepareCreateFromDirtyRaw: (raw: Record<string, unknown>) => {
      const record = { _raw: { ...raw }, table };
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

/** Created records stay in their raw schema shape, just like `prepareCreateFromDirtyRaw` input. */
const createdId = (records: any[] | undefined, index = 0) => records?.[index]?._raw?.id;
const createdColumn = (records: any[] | undefined, column: string, index = 0) =>
  records?.[index]?._raw?.[column];

describe('importShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDatabase.batch as jest.Mock).mockImplementation(async () => {
      expect(mockInsideWrite).toBe(true);
    });
  });

  it('dedupes an external-id match and performs one non-destructive write', async () => {
    const { created } = wire({ foods: [storedFood()] });
    const result = await importShareEnvelope({ envelope: envelope() });

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

  it('resolves many foods with one bounded query per populated identity field', async () => {
    const shared = envelope();
    shared.records.foods = Array.from({ length: 20 }, (_, index) => ({
      ...shared.records.foods[0],
      barcode: undefined,
      external_id: `external-${index}`,
      id: `sender-food-${index}`,
      name: `Shared food ${index}`,
    }));
    shared.records.meal_foods = [];
    const { queriedTables } = wire({
      foods: Array.from({ length: 20 }, (_, index) =>
        storedFood({
          barcode: null,
          external_id: `external-${index}`,
          id: `local-food-${index}`,
          name: `Shared food ${index}`,
        })
      ),
    });

    const result = await importShareEnvelope({ envelope: shared });

    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(20);
    expect(queriedTables.filter((table) => table === 'foods')).toHaveLength(2);
  });

  it('dedupes a barcode match even when no external id lines up', async () => {
    const { created } = wire({ foods: [storedFood({ external_id: 'other-external' })] });
    const result = await importShareEnvelope({ envelope: envelope() });

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

    const result = await importShareEnvelope({ envelope: bare });

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
    const result = await importShareEnvelope({ envelope: envelope() });

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

    const result = await importShareEnvelope({ envelope: bare });

    expect(created.foods).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(0);
  });

  it('never reuses a food across a nutrition-basis mismatch', async () => {
    const { created } = wire({ foods: [storedFood({ nutrition_basis: 'per_serving' })] });
    const result = await importShareEnvelope({ envelope: envelope() });

    expect(created.foods).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(0);
  });

  it('only looks for matches in the tables the kind spec marks for dedupe', async () => {
    // The strategy per table lives in MEAL_SHARE_SPEC.dedupe, not in this module. Tables left at
    // the default 'create' must never be queried, so an imported meal is always a new meal.
    const { created, queriedTables } = wire({ foods: [storedFood()] });
    const result = await importShareEnvelope({ envelope: envelope() });

    expect(queriedTables).toContain('foods');
    expect(queriedTables).not.toContain('meals');
    expect(queriedTables).not.toContain('meal_foods');
    expect(created.meals).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'meals')).toHaveLength(0);
  });

  it('removes a written asset when the batch fails', async () => {
    wire();

    (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));

    await expect(importShareEnvelope({ envelope: envelope({ image: true }) })).rejects.toThrow(
      'batch failed'
    );
    expect(saveBase64MealImage).toHaveBeenCalledTimes(1);
    expect(deleteMealImage).toHaveBeenCalledWith('file:///meals/imported.jpg');
    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockUnsafeResetDatabase).not.toHaveBeenCalled();
  });

  it('preserves the database error when best-effort asset cleanup also fails', async () => {
    wire();
    (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));
    (deleteMealImage as jest.Mock).mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(importShareEnvelope({ envelope: envelope({ image: true }) })).rejects.toThrow(
      'batch failed'
    );
    expect(deleteMealImage).toHaveBeenCalledWith('file:///meals/imported.jpg');
  });

  describe('food share', () => {
    it('creates the food, its portions and their links when nothing matches', async () => {
      const { created } = wire();
      const result = await importShareEnvelope({ envelope: foodEnvelope() });

      expect(created.foods).toHaveLength(1);
      expect(created.food_portions).toHaveLength(1);
      expect(created.food_food_portions).toHaveLength(1);
      expect(createdColumn(created.food_food_portions, 'food_id')).toBe(createdId(created.foods));
      expect(createdColumn(created.food_food_portions, 'food_portion_id')).toBe(
        createdId(created.food_portions)
      );
      expect(result.rootId).toBe(createdId(created.foods));
    });

    // A food-private portion is only meaningful under its owner, and in this kind the only owner is
    // the shared food itself — so it must point at the copy that was just created.
    it('repoints a food-private portion at the newly created food', async () => {
      const { created } = wire();
      await importShareEnvelope({ envelope: foodEnvelope({ ownedPortion: true }) });

      expect(createdColumn(created.food_portions, 'owner_id')).toBe(createdId(created.foods));
      expect(createdColumn(created.food_portions, 'owner_type')).toBe('food');
    });

    // The whole envelope is one food. When the receiver already has it, the share collapses to
    // nothing written at all — the existing food keeps the portions it already had.
    it('writes nothing when the receiver already has the food', async () => {
      const { created } = wire({ foods: [storedFood()] });
      const result = await importShareEnvelope({ envelope: foodEnvelope() });

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

    it('removes an incoming photo when the existing food makes it unused', async () => {
      wire({ foods: [storedFood()] });

      await importShareEnvelope({ envelope: foodEnvelope({ image: true }) });

      expect(saveBase64ImageToFile).toHaveBeenCalledTimes(1);
      expect(deleteFoodImage).toHaveBeenCalledWith('file:///food_images/imported.jpg');
    });

    it('reuses a portion the receiver already has under the same food', async () => {
      const { created } = wire({
        foods: [storedFood()],
        food_portions: [
          storedPortion({ owner_id: 'local-food', owner_type: 'food', scope: 'private' }),
        ],
      });
      const result = await importShareEnvelope({ envelope: foodEnvelope({ ownedPortion: true }) });

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
      await importShareEnvelope({ envelope: foodEnvelope({ image: true }) });

      expect(saveBase64ImageToFile).toHaveBeenCalledTimes(1);
      expect(saveBase64MealImage).not.toHaveBeenCalled();

      (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));
      await expect(
        importShareEnvelope({ envelope: foodEnvelope({ image: true }) })
      ).rejects.toThrow('batch failed');
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
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [globalPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

      expect(created.food_portions).toBeUndefined();
      expect(result.reused).toContainEqual({
        localId: 'local-portion',
        sourceId: 'sender-portion',
        table: 'food_portions',
      });
      expect(createdColumn(created.meal_foods, 'portion_id')).toBe('local-portion');
    });

    // `forcedColumns` stamps every imported portion `custom`, so a first receive turns the sender's
    // `basic` portion into a local `custom` one. Matching on source would make the second receive
    // duplicate it, and the third duplicate it again.
    it('reuses a portion whose source differs, so receiving the same meal twice adds nothing', async () => {
      const { created } = wire({ food_portions: [storedPortion({ source: 'custom' })] });
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [globalPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

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
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [globalPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

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
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [ownedPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

      expect(created.food_portions).toBeUndefined();
      expect(result.reused).toContainEqual({
        localId: 'local-serving',
        sourceId: 'sender-portion',
        table: 'food_portions',
      });
      expect(createdColumn(created.meal_foods, 'portion_id')).toBe('local-serving');
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
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [ownedPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

      expect(created.food_portions).toHaveLength(1);
      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(createdColumn(created.food_portions, 'owner_id')).toBe('local-food');
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
      const result = await importShareEnvelope({
        envelope: envelope({
          foodPortions: [ownedPortion()],
          ingredientPortionId: 'sender-portion',
        }),
      });

      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(created.food_portions).toHaveLength(1);
      // The fresh portion hangs off the food that was just created, never off the receiver's.
      expect(createdColumn(created.food_portions, 'owner_id')).toBe(createdId(created.foods));
      expect(createdColumn(created.food_portions, 'owner_id')).not.toBe('local-food');
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
      const result = await importShareEnvelope({
        envelope: envelope({ foodPortions: [senderBowl], mealPortionId: 'sender-bowl' }),
      });

      expect(result.reused.filter((item) => item.table === 'food_portions')).toHaveLength(0);
      expect(created.food_portions).toHaveLength(1);
      expect(createdColumn(created.food_portions, 'owner_id')).toBe(createdId(created.meals));
    });
  });
});

/**
 * A `nutritionDay` share: one day of the diary, which the receiver MERGES rather than restores.
 *
 * Two things separate it from the other kinds and are what these tests hold down — the macro
 * snapshot crosses the wire in plaintext and has to be re-encrypted with this device's key, and the
 * user picks between adding to the day and replacing it, which is the only destructive path any
 * share has.
 */
const DAY_MS = Date.UTC(2026, 7, 14, 12, 0, 0);

function dayEnvelope(overrides: Partial<ShareRow>[] = []): NutritionDayShareEnvelope {
  const logs =
    overrides.length > 0
      ? overrides.map((override, index) => ({
          amount: 150,
          date: DAY_MS,
          food_id: 'sender-food',
          id: `sender-log-${index}`,
          logged_calories: 100,
          logged_carbs: 10,
          logged_fat: 3,
          logged_fiber: 1,
          logged_food_name: 'Shared food',
          logged_protein: 5,
          snapshot_basis: 'per_100g',
          timezone: '+00:00',
          type: 'lunch',
          ...override,
        }))
      : [
          {
            amount: 150,
            date: DAY_MS,
            food_id: 'sender-food',
            id: 'sender-log-0',
            logged_calories: 100,
            logged_carbs: 10,
            logged_fat: 3,
            logged_fiber: 1,
            logged_food_name: 'Shared food',
            logged_protein: 5,
            snapshot_basis: 'per_100g',
            timezone: '+00:00',
            type: 'lunch',
          },
        ];

  return {
    _musclogShare: 1,
    createdAtMs: 1,
    kind: 'nutritionDay',
    kindVersion: 1,
    records: {
      food_food_portions: [],
      food_portions: [],
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
      nutrition_logs: logs,
    },
    summary: {
      dayKey: '2026-08-14',
      entries: [{ amount: 150, calories: 150, mealType: 'lunch', name: 'Shared food', unit: 'g' }],
      totals: { calories: 150, carbs: 15, fat: 4.5, fiber: 1.5, protein: 7.5 },
    },
  };
}

/** A log the receiver already has, in both its raw and accessor shapes (see `storedFood`). */
function storedLog(overrides: Record<string, unknown> = {}) {
  const columns = {
    date: DAY_MS,
    deleted_at: null,
    id: 'local-log',
    timezone: '+00:00',
    ...overrides,
  };
  return {
    ...columns,
    prepareUpdate: jest.fn((mutator: (record: any) => void) => {
      const record: any = { id: columns.id };
      mutator(record);
      return { table: 'nutrition_logs', update: record };
    }),
  };
}

describe('importShareEnvelope — nutritionDay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDatabase.batch as jest.Mock).mockImplementation(async () => {
      expect(mockInsideWrite).toBe(true);
    });
  });

  // There is deliberately no "refuses to guess between adding and replacing" test here any more.
  // Defaulting either way is a data-loss bug in one direction and a double-counted day in the
  // other, and that used to be a runtime throw worth asserting. `ShareImportRequest` now pairs a
  // `nutritionDay` envelope with its mode in a discriminated union, so a day import naming no mode
  // does not compile — and this file is not typechecked (`tsconfig.json` excludes `__tests__`, and
  // Jest transforms via Babel), so a `@ts-expect-error` here would assert nothing at all.

  it('re-encrypts the plaintext snapshot with this device key before writing', async () => {
    const { created } = wire({ foods: [storedFood()] });

    await importShareEnvelope({ dayMode: 'add', envelope: dayEnvelope() });

    // The wire carries plaintext because the sender's key means nothing here; what lands in the
    // database must be ciphertext all the same.
    expect(createdColumn(created.nutrition_logs, 'logged_calories')).toBe('enc:100');
    expect(createdColumn(created.nutrition_logs, 'logged_food_name')).toBe('enc:Shared food');
  });

  it('keeps each entry on its own day and reuses the food the receiver already had', async () => {
    const { created } = wire({ foods: [storedFood()] });

    const result = await importShareEnvelope({ dayMode: 'add', envelope: dayEnvelope() });

    expect(created.foods).toBeUndefined();
    expect(createdColumn(created.nutrition_logs, 'food_id')).toBe('local-food');
    // `date` + `timezone` travel unchanged: that pair is what files the entry on the sender's
    // calendar day no matter which timezone the receiver is in.
    expect(createdColumn(created.nutrition_logs, 'date')).toBe(DAY_MS);
    expect(createdColumn(created.nutrition_logs, 'timezone')).toBe('+00:00');
    expect(result.replaced).toBe(0);
  });

  it('adds without touching what the day already had', async () => {
    const existing = storedLog();
    wire({ foods: [storedFood()], nutrition_logs: [existing] });

    const result = await importShareEnvelope({ dayMode: 'add', envelope: dayEnvelope() });

    expect(existing.prepareUpdate).not.toHaveBeenCalled();
    expect(result.replaced).toBe(0);
  });

  it('replaces only the days it is actually writing to', async () => {
    const sameDay = storedLog({ id: 'local-same-day' });
    const otherDay = storedLog({ date: DAY_MS - 3 * 86_400_000, id: 'local-other-day' });
    wire({ foods: [storedFood()], nutrition_logs: [sameDay, otherDay] });

    const result = await importShareEnvelope({ dayMode: 'replace', envelope: dayEnvelope() });

    // Membership is decided by each row's own date + timezone, the way every day-bucketed read in
    // the app decides it — never by the summary's dayKey, which is display metadata.
    expect(sameDay.prepareUpdate).toHaveBeenCalledTimes(1);
    expect(otherDay.prepareUpdate).not.toHaveBeenCalled();
    expect(result.replaced).toBe(1);
  });

  it('soft-deletes the replaced rows in the same batch as the new ones', async () => {
    const existing = storedLog();
    wire({ foods: [storedFood()], nutrition_logs: [existing] });

    await importShareEnvelope({ dayMode: 'replace', envelope: dayEnvelope() });

    // One batch, one writer: a delete that commits without its replacement would leave the user
    // with an emptied day.
    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    const [mutator] = existing.prepareUpdate.mock.calls[0];
    const record: any = {};
    mutator(record);
    expect(record.deletedAt).toEqual(expect.any(Number));
    expect(record.updatedAt).toEqual(expect.any(Number));
  });

  it("rewrites a meal group id instead of pointing at the sender's", async () => {
    const { created } = wire({ foods: [storedFood()] });

    await importShareEnvelope({
      dayMode: 'add',
      envelope: dayEnvelope([
        { group_id: 'sender-group' },
        { group_id: 'sender-group' },
        { group_id: 'sender-other' },
      ]),
    });

    const groups = created.nutrition_logs.map((record: any) => record._raw.group_id);
    // Entries logged together stay together, but under an id minted here — the sender's may be a
    // `meals` id, and reusing it could collide with an unrelated local group.
    expect(groups[0]).toBe(groups[1]);
    expect(groups[2]).not.toBe(groups[0]);
    expect(groups).not.toContain('sender-group');
  });
});
