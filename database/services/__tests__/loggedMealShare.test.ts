import type NutritionLog from '@/database/models/NutritionLog';
import {
  buildLoggedMealShareEnvelope,
  buildLoggedMealSharePayload,
} from '@/database/share/buildLoggedMealShare';
import { parseShareEnvelope } from '@/utils/share/shareEnvelope';

jest.mock('@/utils/file', () => ({ createThumbnail: jest.fn() }));

function portion(id: string, name: string, overrides: Record<string, unknown> = {}) {
  const columns = {
    deleted_at: null,
    gram_weight: 50,
    id,
    name,
    owner_id: null,
    owner_type: null,
    source: 'basic',
    ...overrides,
  };
  return {
    _raw: columns,
    deletedAt: undefined,
    gramWeight: columns.gram_weight ?? undefined,
    id,
    name,
    ownerId: columns.owner_id ?? undefined,
    ownerType: columns.owner_type ?? undefined,
  };
}

function food(id: string, name: string, basis: 'per_100g' | 'per_serving') {
  const defaultPortion = portion(`${id}-default`, '100 g');
  return {
    _raw: {
      _status: 'synced',
      calories: 100,
      carbs: 10,
      fat: 3,
      fiber: 1,
      id,
      is_favorite: true,
      name,
      nutrition_basis: basis,
      protein: 5,
    },
    deletedAt: undefined,
    defaultPortion,
    foodPortions: {
      fetch: jest.fn().mockResolvedValue([
        {
          _raw: {
            food_id: id,
            food_portion_id: defaultPortion.id,
            id: `default-${id}`,
            is_default: true,
          },
          deletedAt: undefined,
          foodPortion: defaultPortion,
          id: `default-${id}`,
          isDefault: true,
        },
      ]),
    },
    id,
    name,
    resolvedNutritionBasis: basis,
  };
}

function log(
  id: string,
  linkedFood: null | ReturnType<typeof food>,
  options: {
    amount?: number;
    portion?: ReturnType<typeof portion>;
    gramWeight?: number;
  } = {}
) {
  const amount = options.amount ?? 2;
  return {
    amount,
    deletedAt: undefined,
    food: linkedFood ? Promise.resolve(linkedFood) : Promise.reject(new Error('missing food')),
    getGramWeight: jest.fn().mockResolvedValue(options.gramWeight ?? amount),
    getNutrients: jest.fn().mockResolvedValue({
      alcohol: 0,
      calories: 200,
      carbs: 20,
      fat: 6,
      fiber: 2,
      protein: 10,
    }),
    id,
    portion: options.portion ? Promise.resolve(options.portion) : undefined,
    portionId: options.portion?.id,
  } as unknown as NutritionLog;
}

describe('buildLoggedMealShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('turns a diary section into a meal envelope, amounts and portions intact', async () => {
    const rice = food('food-1', 'Rice', 'per_100g');
    const bar = food('food-2', 'Protein bar', 'per_serving');
    const scoop = portion('portion-scoop', 'Scoop');

    const envelope = await buildLoggedMealShareEnvelope(
      [log('log-1', rice, { portion: scoop }), log('log-2', bar)],
      { name: 'Breakfast · 10/8/2026' }
    );

    // The receiver's importer only ever sees a `meal` kind — there is no logged-meal kind to learn.
    expect(envelope.kind).toBe('meal');
    expect(envelope.rootTable).toBe('meals');
    expect(envelope.records.meals[0]).toMatchObject({
      id: envelope.rootId,
      name: 'Breakfast · 10/8/2026',
      nutrition_basis: 'per_recipe',
      recipe_servings_count: 1,
    });
    expect(envelope.records.meal_foods).toEqual([
      expect.objectContaining({
        amount: 2,
        food_id: 'food-1',
        meal_id: envelope.rootId,
        portion_id: 'portion-scoop',
      }),
      expect.objectContaining({ amount: 2, food_id: 'food-2', meal_id: envelope.rootId }),
    ]);
    expect(envelope.records.meal_foods[1]).not.toHaveProperty('portion_id');
    expect(envelope.records.foods.map((row) => row.id)).toEqual(['food-1', 'food-2']);
    // The logged portion plus each food's default portion, so the receiver's copy opens with the
    // serving size the sender sees.
    expect(envelope.records.food_portions.map((row) => row.id).sort()).toEqual([
      'food-1-default',
      'food-2-default',
      'portion-scoop',
    ]);
    expect(envelope.records.meal_food_portions).toEqual([]);
    expect(envelope.summary.ingredients).toEqual([
      { amount: 2, calories: 200, name: 'Rice', portionName: 'Scoop', unit: 'portion' },
      { amount: 2, calories: 200, name: 'Protein bar', unit: 'serving' },
    ]);
    expect(envelope.summary.totals).toEqual({
      calories: 400,
      carbs: 40,
      fat: 12,
      fiber: 4,
      protein: 20,
    });
  });

  // A portion owned by a meal has no owner in the envelope to point at. Dropping it alone would
  // silently reinterpret the amount as grams, so the amount is converted along with it.
  it('converts the amount to grams when the logged portion cannot travel', async () => {
    const rice = food('food-1', 'Rice', 'per_100g');
    const bowl = portion('portion-bowl', 'Bowl', { owner_id: 'meal-9', owner_type: 'meal' });

    const envelope = await buildLoggedMealShareEnvelope(
      [log('log-1', rice, { amount: 2, gramWeight: 500, portion: bowl })],
      { name: 'Dinner' }
    );

    expect(envelope.records.meal_foods[0]).not.toHaveProperty('portion_id');
    expect(envelope.records.meal_foods[0].amount).toBe(500);
    expect(envelope.records.food_portions.map((row) => row.id)).not.toContain('portion-bowl');
    expect(envelope.summary.ingredients[0].unit).toBe('g');
  });

  it('skips a log whose food is gone and refuses a section with nothing left', async () => {
    const rice = food('food-1', 'Rice', 'per_100g');

    const envelope = await buildLoggedMealShareEnvelope([log('log-1', null), log('log-2', rice)], {
      name: 'Lunch',
    });
    expect(envelope.records.meal_foods).toHaveLength(1);

    await expect(
      buildLoggedMealShareEnvelope([log('log-3', null)], { name: 'Lunch' })
    ).rejects.toThrow('without ingredients');
  });

  it('builds a payload the receiver can parse', async () => {
    const rice = food('food-1', 'Rice', 'per_100g');

    const payload = await buildLoggedMealSharePayload([log('log-1', rice)], { name: 'Breakfast' });

    expect(payload.json).not.toContain('null');
    const parsed = parseShareEnvelope(payload.json);
    expect(parsed.kind).toBe('meal');
    expect(parsed.summary.name).toBe('Breakfast');
  });
});
