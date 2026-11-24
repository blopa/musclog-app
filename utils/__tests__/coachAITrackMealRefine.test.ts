import { type CoachAIConfig } from '../coachAI';
import { trackMeal } from '../coachMealEstimate';
import { ingredientMacroProblems } from '../mealPlausibility';

const mockSendOnDeviceStructured = jest.fn();

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendOnDeviceStructured(...args),
}));

jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));

jest.mock('../handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn().mockResolvedValue('off'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(true),
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    // Mirrors the real contract: a known foodId gets real macros, any other foodId is stripped.
    normalizeAiMealIngredients: jest.fn(async (ingredients: { foodId?: string }[]) =>
      ingredients.map((ingredient) => {
        if (!ingredient.foodId) {
          return ingredient;
        }
        if (ingredient.foodId === 'food-rice') {
          return { ...ingredient, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 };
        }
        const { foodId: _, ...rest } = ingredient;
        return rest;
      })
    ),
  },
}));

const ON_DEVICE = { provider: 'on-device' } as unknown as CoachAIConfig;

const KNOWN_FOOD_ID = 'food-rice';

describe('trackMeal (normal path: refinement)', () => {
  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
  });

  it('re-estimates only the invented-id ingredient with no numbers, in one follow-up request', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'lunch',
            mealName: 'Chicken and rice',
            ingredients: [
              {
                name: 'Rice',
                grams: 100,
                foodId: KNOWN_FOOD_ID,
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
              {
                name: 'Chicken',
                grams: 150,
                foodId: 'null',
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal(ON_DEVICE, 'chicken and rice');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    const followUpPrompt = mockSendOnDeviceStructured.mock.calls[1][1] as string;
    expect(followUpPrompt).toContain('Chicken');
    expect(followUpPrompt).not.toContain('Rice,');

    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients).toHaveLength(2);
    expect(ingredients.find((i) => i.name === 'Rice')).toMatchObject({
      foodId: KNOWN_FOOD_ID,
      kcal: 130,
    });
    const chicken = ingredients.find((i) => i.name === 'Chicken');
    expect(chicken).toMatchObject({ kcal: 248 });
    expect(chicken?.foodId).toBeUndefined();
  });

  it('makes exactly one request when every claimed id resolves or the numbers are coherent', async () => {
    mockSendOnDeviceStructured.mockResolvedValueOnce({
      meals: [
        {
          mealType: 'lunch',
          mealName: 'Rice and egg',
          ingredients: [
            {
              name: 'Rice',
              grams: 100,
              foodId: KNOWN_FOOD_ID,
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
            { name: 'Egg', grams: 50, kcal: 70, protein: 6, carbs: 0.6, fat: 5 },
          ],
        },
      ],
    });

    const result = await trackMeal(ON_DEVICE, 'rice and an egg');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(result?.meals[0].ingredients).toHaveLength(2);
  });

  it('does not re-estimate an ingredient that has no foodId and no numbers (water)', async () => {
    mockSendOnDeviceStructured.mockResolvedValueOnce({
      meals: [
        {
          mealType: 'snack',
          mealName: 'Water',
          ingredients: [{ name: 'Water', grams: 250, kcal: 0, protein: 0, carbs: 0, fat: 0 }],
        },
      ],
    });

    const result = await trackMeal(ON_DEVICE, 'a glass of water');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(result?.meals[0].ingredients).toEqual([
      expect.objectContaining({ name: 'Water', kcal: 0 }),
    ]);
  });

  it('replaces implausible numbers with a coherent recheck estimate', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'dinner',
            mealName: 'Sauce',
            ingredients: [
              { name: 'Mystery sauce', grams: 100, kcal: 900, protein: 10, carbs: 10, fat: 5 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        ingredients: [
          { name: 'Mystery sauce', grams: 100, kcal: 125, protein: 10, carbs: 10, fat: 5 },
        ],
      });

    const result = await trackMeal(ON_DEVICE, 'mystery sauce');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0]).toMatchObject({
      kcal: 125,
      protein: 10,
      carbs: 10,
      fat: 5,
    });
  });

  it('reconciles the numbers when the recheck is just as implausible', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'dinner',
            mealName: 'Sauce',
            ingredients: [
              { name: 'Mystery sauce', grams: 100, kcal: 900, protein: 10, carbs: 10, fat: 5 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        ingredients: [
          { name: 'Mystery sauce', grams: 100, kcal: 900, protein: 10, carbs: 10, fat: 5 },
        ],
      });

    const result = await trackMeal(ON_DEVICE, 'mystery sauce');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(ingredientMacroProblems(result!.meals[0].ingredients[0])).toEqual([]);
  });

  it('returns the result with the original ingredient when the follow-up request throws', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'lunch',
            mealName: 'Chicken',
            ingredients: [
              {
                name: 'Chicken',
                grams: 150,
                foodId: 'null',
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
            ],
          },
        ],
      })
      .mockRejectedValueOnce(new Error('boom'));

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(result?.meals[0].ingredients).toEqual([
      expect.objectContaining({ name: 'Chicken', kcal: 0, grams: 150 }),
    ]);
  });

  it('reconciles impossible numbers when the recheck request throws', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'snack',
            mealName: 'Nuts',
            ingredients: [
              { name: 'Almonds', grams: 10, kcal: 10, protein: 4, carbs: 4, fat: 9, fiber: 2 },
            ],
          },
        ],
      })
      .mockRejectedValueOnce(new Error('boom'));

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(ingredientMacroProblems(result!.meals[0].ingredients[0])).toEqual([]);
  });

  it('reconciles impossible numbers when the recheck returns the same impossible ones', async () => {
    const almonds = {
      name: 'Almonds',
      grams: 10,
      kcal: 10,
      protein: 4,
      carbs: 4,
      fat: 9,
      fiber: 2,
    };
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [{ mealType: 'snack', mealName: 'Nuts', ingredients: [almonds] }],
      })
      .mockResolvedValueOnce({ ingredients: [almonds] });

    const result = await trackMeal(ON_DEVICE, 'almonds');

    expect(ingredientMacroProblems(result!.meals[0].ingredients[0])).toEqual([]);
  });

  it('reports progress in order and ignores a listener that throws', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'lunch',
            mealName: 'Chicken and rice',
            ingredients: [
              {
                name: 'Rice',
                grams: 100,
                foodId: KNOWN_FOOD_ID,
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
              {
                name: 'Chicken',
                grams: 150,
                foodId: 'null',
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const onProgress = jest.fn();
    await trackMeal(ON_DEVICE, 'chicken and rice', undefined, onProgress);

    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      { step: 'reading', photo: false },
      { step: 'estimating', count: 1, matched: 1 },
    ]);

    const throwing = jest.fn(() => {
      throw new Error('listener failed');
    });
    mockSendOnDeviceStructured.mockResolvedValueOnce({
      meals: [
        {
          mealType: 'lunch',
          mealName: 'Rice',
          ingredients: [
            {
              name: 'Rice',
              grams: 100,
              foodId: KNOWN_FOOD_ID,
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
          ],
        },
      ],
    });
    const result = await trackMeal(ON_DEVICE, 'rice', undefined, throwing);
    expect(result?.meals[0].ingredients[0]).toMatchObject({ kcal: 130 });
  });
});
