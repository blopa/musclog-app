import { trackMeal } from '../coachAI';

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
    getUseThinkingMode: jest.fn().mockResolvedValue(true),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(true),
    // Index 3 is fiber: hidden, so the on-device estimate makes no fiber request.
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));

const KNOWN_FOOD_ID = 'food-rice';

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    // Mirrors the real contract: a foodId the database knows gets real macros, any other
    // foodId is stripped so the ingredient is treated as unmatched.
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

describe('trackMeal (thinking mode: verified path)', () => {
  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
  });

  it('estimates an ingredient whose claimed foodId is not a real food instead of logging it at 0 kcal', async () => {
    mockSendOnDeviceStructured
      .mockResolvedValueOnce({
        meals: [
          {
            mealType: 'lunch',
            mealName: 'Chicken and rice',
            ingredients: [
              { name: 'Rice', grams: 100, foodId: KNOWN_FOOD_ID },
              { name: 'Chicken', grams: 150, foodId: 'null' },
            ],
          },
        ],
      })
      // The on-device estimate asks for a nutrition label per 100 g; 165 kcal at 150 g is 248.
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal({ provider: 'on-device' } as never, 'chicken and rice');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    const estimationPrompt = mockSendOnDeviceStructured.mock.calls[1][1] as string;
    expect(estimationPrompt).toContain('Chicken');

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

  it('skips the estimation call when every claimed foodId resolves', async () => {
    mockSendOnDeviceStructured.mockResolvedValueOnce({
      meals: [
        {
          mealType: 'lunch',
          mealName: 'Rice',
          ingredients: [{ name: 'Rice', grams: 100, foodId: KNOWN_FOOD_ID }],
        },
      ],
    });

    const result = await trackMeal({ provider: 'on-device' } as never, 'rice');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(result?.meals[0].ingredients).toEqual([
      expect.objectContaining({ foodId: KNOWN_FOOD_ID, kcal: 130 }),
    ]);
  });
});
