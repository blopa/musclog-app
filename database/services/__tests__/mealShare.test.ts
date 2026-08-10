import { database } from '@/database/database-instance';
import { buildMealShareEnvelope, buildMealSharePayload } from '@/database/share/buildMealShare';
import { MealService } from '@/database/services/MealService';
import { createThumbnail } from '@/utils/file';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import { parseShareEnvelope } from '@/utils/share/shareEnvelope';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value: unknown) => ({ kind: 'eq', value })),
    where: jest.fn((field: string, value: unknown) => ({ field, value })),
  },
}));

jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));

jest.mock('@/database/services/MealService', () => ({
  MealService: { getMealWithFoods: jest.fn() },
}));

jest.mock('@/utils/file', () => ({
  createThumbnail: jest.fn(async () => ({
    base64: 'AQIDBA==',
    height: 300,
    uri: 'file:///thumb.jpg',
    width: 400,
  })),
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockGetMeal = MealService.getMealWithFoods as jest.Mock;

function portion(id: string, name: string) {
  return {
    _raw: {
      _changed: '',
      _status: 'synced',
      deleted_at: null,
      gram_weight: 50,
      id,
      name,
      source: 'custom',
    },
    deletedAt: undefined,
    id,
    name,
  };
}

function defaultLink(foodId: string, linkedPortion: ReturnType<typeof portion>) {
  return {
    _raw: {
      created_at: 1,
      food_id: foodId,
      food_portion_id: linkedPortion.id,
      id: `default-${foodId}`,
      is_default: true,
      updated_at: 1,
    },
    deletedAt: undefined,
    foodPortion: linkedPortion,
    id: `default-${foodId}`,
    isDefault: true,
  };
}

function food(
  id: string,
  name: string,
  basis: 'per_100g' | 'per_serving',
  link: ReturnType<typeof defaultLink>,
  imageUrl?: string
) {
  return {
    _raw: {
      _status: 'synced',
      brand: null,
      calories: 100,
      carbs: 10,
      description: '',
      fat: 3,
      fiber: 1,
      id,
      image_url: imageUrl,
      is_favorite: true,
      name,
      nutrition_basis: basis,
      protein: 5,
    },
    deletedAt: undefined,
    foodPortions: { fetch: jest.fn().mockResolvedValue([link]) },
    id,
    name,
    resolvedNutritionBasis: basis,
  };
}

function mealFood(
  id: string,
  linkedFood: ReturnType<typeof food>,
  linkedPortion?: ReturnType<typeof portion>
) {
  return {
    _raw: {
      amount: 2,
      food_id: linkedFood.id,
      id,
      meal_id: 'meal-1',
      portion_id: linkedPortion?.id,
    },
    amount: 2,
    food: linkedFood,
    foodId: linkedFood.id,
    getNutrients: jest.fn().mockResolvedValue({
      calories: 200,
      carbs: 20,
      fat: 6,
      fiber: 2,
      protein: 10,
    }),
    id,
    portion: linkedPortion,
    portionId: linkedPortion?.id,
  };
}

function fixture() {
  const used = portion('portion-used', 'Scoop');
  const mealPrivate = portion('portion-meal', 'Bowl');
  const foodDefault1 = portion('portion-default-1', '100 g');
  const foodDefault2 = portion('portion-default-2', 'Bar');
  const link1 = defaultLink('food-1', foodDefault1);
  const link2 = defaultLink('food-2', foodDefault2);
  const food1 = food('food-1', 'Rice', 'per_100g', link1);
  const food2 = food('food-2', 'Protein bar', 'per_serving', link2);
  const mealFoods = [mealFood('mf-1', food1, used), mealFood('mf-2', food2)];
  const meal = {
    _raw: {
      _status: 'synced',
      description: 'Dinner',
      id: 'meal-1',
      image_url: 'file:///meal.jpg',
      is_favorite: true,
      name: 'Rice bowl',
      nutrition_basis: 'per_recipe',
      prepared_weight_grams: null,
    },
    description: 'Dinner',
    getTotalNutrients: jest.fn().mockResolvedValue({
      calories: 400,
      carbs: 40,
      fat: 12,
      fiber: 4,
      protein: 20,
    }),
    id: 'meal-1',
    imageUrl: 'file:///meal.jpg',
    name: 'Rice bowl',
    // `null`, not `undefined`: that is what WatermelonDB hands back for an unset optional column,
    // whatever the model's `?: number` typing says. A fixture using `undefined` here is what let
    // v2.11.0 ship a summary full of explicit nulls that the receiver's validator rejected.
    preparedWeightGrams: null,
    recipeServingsCount: 2,
    resolvedNutritionBasis: 'per_recipe' as const,
    servingGrams: 250,
  };
  const mealPortionLink = {
    _raw: {
      food_portion_id: mealPrivate.id,
      id: 'meal-portion-link',
      is_default: true,
      meal_id: meal.id,
    },
    deletedAt: undefined,
    foodPortion: mealPrivate,
    id: 'meal-portion-link',
  };
  return { meal, mealFoods, mealPortionLink };
}

describe('buildMealShareEnvelope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carries only referenced portions and each food default link', async () => {
    const { meal, mealFoods, mealPortionLink } = fixture();
    mockGetMeal.mockResolvedValue({ foods: mealFoods, meal });
    mockDatabase.get.mockReturnValue({
      query: () => ({ fetch: jest.fn().mockResolvedValue([mealPortionLink]) }),
    } as any);

    const { envelope, photo } = await buildMealShareEnvelope(meal.id, { includeImage: false });

    expect(envelope.records.food_portions.map((row) => row.id).sort()).toEqual([
      'portion-default-1',
      'portion-default-2',
      'portion-meal',
      'portion-used',
    ]);
    expect(envelope.records.food_food_portions.map((row) => row.id).sort()).toEqual([
      'default-food-1',
      'default-food-2',
    ]);
    expect(envelope.records.meal_food_portions).toHaveLength(1);
    expect(envelope.records.foods[0]).not.toHaveProperty('_status');
    expect(envelope.records.foods[0]).not.toHaveProperty('brand');
    expect(envelope.records.foods[0]).not.toHaveProperty('description');
    expect(envelope.records.meals[0]).not.toHaveProperty('image_url');
    expect(envelope.assets).toBeUndefined();
    expect(photo).toBe('none');
    expect(envelope.summary.totals).toEqual({
      calories: 400,
      carbs: 40,
      fat: 12,
      fiber: 4,
      protein: 20,
    });
    expect(envelope.summary.ingredients).toEqual([
      { amount: 2, calories: 200, name: 'Rice', portionName: 'Scoop', unit: 'portion' },
      { amount: 2, calories: 200, name: 'Protein bar', unit: 'serving' },
    ]);
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  it('embeds an optional thumbnail and marks the optical payload as a share', async () => {
    const { meal, mealFoods } = fixture();
    mockGetMeal.mockResolvedValue({ foods: mealFoods, meal });
    mockDatabase.get.mockReturnValue({
      query: () => ({ fetch: jest.fn().mockResolvedValue([]) }),
    } as any);

    const payload = await buildMealSharePayload(meal.id, { includeImage: true });
    const envelope = JSON.parse(payload.json);

    expect(payload.payloadKind).toBe(OPTICAL_PAYLOAD_KIND_SHARE);
    expect(payload.exportVersion).toBe(OPTICAL_EXPORT_VERSION_SHARE);
    expect(envelope.records.meals[0].image_url).toBe('share-asset:mealImage');
    expect(envelope.assets.mealImage).toMatchObject({
      base64: 'AQIDBA==',
      height: 300,
      width: 400,
    });
    expect(envelope.summary.hasImage).toBe(true);
    expect(payload.photo).toBe('embedded');
    expect(createThumbnail).toHaveBeenCalledWith('file:///meal.jpg', 400);
  });

  // Only the meal's OWN photo can be embedded or go missing. An ingredient's photo is never
  // carried as an asset, so it must not colour what the send screen tells the user about the
  // transfer it is about to make.
  it('reports no photo when only an ingredient has one', async () => {
    const { meal, mealFoods } = fixture();
    const withPhoto = food(
      'food-1',
      'Rice',
      'per_100g',
      defaultLink('food-1', portion('p', 'P')),
      'file:///ingredient.jpg'
    );
    mockGetMeal.mockResolvedValue({
      foods: [{ ...mealFoods[0], food: withPhoto, foodId: withPhoto.id }],
      meal: { ...meal, imageUrl: undefined },
    });
    mockDatabase.get.mockReturnValue({
      query: () => ({ fetch: jest.fn().mockResolvedValue([]) }),
    } as any);

    const { photo } = await buildMealShareEnvelope(meal.id, { includeImage: true });

    expect(photo).toBe('none');
    expect(createThumbnail).not.toHaveBeenCalled();
  });

  // The contract that was missing: every previous test read the builder's output directly, so
  // nothing checked that a receiver could actually parse it. v2.11.0 shipped a builder whose
  // output `parseShareEnvelope` rejected outright, and the receive screen reported that as "sent
  // by a newer version of Musclog" on two phones running the identical build.
  it.each([
    ['a fully populated meal', {}],
    [
      'a meal with every optional measurement unset',
      {
        preparedWeightGrams: null,
        recipeServingsCount: null,
        servingGrams: null,
      },
    ],
  ])('builds a payload the receiver can parse: %s', async (_label, mealOverrides) => {
    const { meal, mealFoods, mealPortionLink } = fixture();
    mockGetMeal.mockResolvedValue({ foods: mealFoods, meal: { ...meal, ...mealOverrides } });
    mockDatabase.get.mockReturnValue({
      query: () => ({ fetch: jest.fn().mockResolvedValue([mealPortionLink]) }),
    } as any);

    const payload = await buildMealSharePayload(meal.id, { includeImage: true });

    // Through JSON, exactly as the optical container carries it — an `undefined` disappears on the
    // way but an explicit `null` does not, which is the whole distinction being pinned here.
    expect(payload.json).not.toContain('null');
    const parsed = parseShareEnvelope(payload.json);
    expect(parsed.summary.name).toBe('Rice bowl');
    expect(parsed.rootId).toBe('meal-1');
  });

  // An ingredient's photo is never embedded — twenty ingredients would blow the asset budget on
  // pictures nobody asked for. A remote URL is free and works on the other phone; a sender-local
  // path names a file that does not exist there, so carrying it would only produce a broken image.
  it.each([
    ['a sender-local path', 'file:///ingredient.jpg', false, false],
    ['a remote URL, photos off', 'https://images.example.org/rice.jpg', false, false],
    ['a remote URL, photos on', 'https://images.example.org/rice.jpg', true, true],
  ])('carries an ingredient photo for %s', async (_label, imageUrl, includeImage, carried) => {
    const { meal, mealFoods } = fixture();
    const withPhoto = food(
      'food-1',
      'Rice',
      'per_100g',
      defaultLink('food-1', portion('p', 'P')),
      imageUrl
    );
    mockGetMeal.mockResolvedValue({
      foods: [{ ...mealFoods[0], food: withPhoto, foodId: withPhoto.id }],
      meal,
    });
    mockDatabase.get.mockReturnValue({
      query: () => ({ fetch: jest.fn().mockResolvedValue([]) }),
    } as any);

    const { envelope } = await buildMealShareEnvelope(meal.id, { includeImage });

    expect(envelope.records.foods[0].image_url).toBe(carried ? imageUrl : undefined);
    expect(envelope.assets?.foodImage).toBeUndefined();
  });

  it('rejects a meal with no surviving ingredients', async () => {
    const { meal } = fixture();
    mockGetMeal.mockResolvedValue({ foods: [], meal });

    await expect(buildMealShareEnvelope(meal.id, { includeImage: false })).rejects.toThrow(
      'without ingredients'
    );
  });
});
