import { database } from '@/database/database-instance';
import { importShareEnvelope } from '@/database/share/importShareEnvelope';
import { deleteMealImage, saveBase64MealImage } from '@/utils/file';
import type { MealShareEnvelope } from '@/utils/share/shareEnvelope';

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
  deleteMealImage: jest.fn(async () => undefined),
  saveBase64MealImage: jest.fn(async () => 'file:///meals/imported.jpg'),
}));

const mockDatabase = database as jest.Mocked<typeof database>;

function envelope(options: { image?: boolean } = {}): MealShareEnvelope {
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
      meal_food_portions: [],
      meal_foods: [
        { amount: 100, food_id: 'sender-food', id: 'sender-mf', meal_id: 'sender-meal' },
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

function storedFood(nutritionBasis: 'per_100g' | 'per_serving') {
  return {
    barcode: '123',
    brand: undefined,
    calories: 100,
    carbs: 10,
    externalId: 'external-1',
    fat: 3,
    fiber: 1,
    id: 'local-food',
    name: 'Shared food',
    nutritionBasis,
    protein: 5,
    resolvedNutritionBasis: nutritionBasis,
  };
}

function wire(foodCandidates: unknown[]) {
  const created: Record<string, any[]> = {};
  mockDatabase.get.mockImplementation(((table: string) => ({
    prepareCreate: (callback: (record: any) => void) => {
      const record = { _raw: {}, table };
      callback(record);
      (created[table] ??= []).push(record);
      return record;
    },
    query: () => ({ fetch: jest.fn().mockResolvedValue(table === 'foods' ? foodCandidates : []) }),
  })) as any);
  return created;
}

describe('importShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDatabase.batch as jest.Mock).mockImplementation(async () => {
      expect(mockInsideWrite).toBe(true);
    });
  });

  it('dedupes an external-id match and performs one non-destructive write', async () => {
    const created = wire([storedFood('per_100g')]);
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

  it('never reuses a food across a nutrition-basis mismatch', async () => {
    const created = wire([storedFood('per_serving')]);
    const result = await importShareEnvelope(envelope());

    expect(created.foods).toHaveLength(1);
    expect(result.reused.filter((item) => item.table === 'foods')).toHaveLength(0);
  });

  it('removes a written asset when the batch fails', async () => {
    wire([]);
    (mockDatabase.batch as jest.Mock).mockRejectedValueOnce(new Error('batch failed'));

    await expect(importShareEnvelope(envelope({ image: true }))).rejects.toThrow('batch failed');
    expect(saveBase64MealImage).toHaveBeenCalledTimes(1);
    expect(deleteMealImage).toHaveBeenCalledWith('file:///meals/imported.jpg');
    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockUnsafeResetDatabase).not.toHaveBeenCalled();
  });
});
