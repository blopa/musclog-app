import { SettingsService } from '@/database/services/SettingsService';

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
    get: jest.fn().mockResolvedValue('medium'),
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

describe('trackMeal (thinking levels above medium)', () => {
  const recipe = (items: { name: string; grams: number }[]) => ({
    meals: [{ mealType: 'lunch', mealName: 'Chicken', ingredients: items }],
  });
  const label = (name: string, kcal: number, protein: number, carbs: number, fat: number) => ({
    name,
    kcal,
    protein,
    carbs,
    fat,
  });

  type Scripts = { review?: () => unknown; recipe?: () => unknown };
  const calls = { recipe: 0, label: 0, review: 0 };

  function script({ review, recipe: recipeFn }: Scripts) {
    mockSendOnDeviceStructured.mockImplementation(async (_config, prompt: string) => {
      if (prompt.includes('reviewing a meal estimate')) {
        calls.review++;
        return review ? review() : { missingIngredients: [], corrections: [] };
      }

      if (prompt.includes('Nutrition facts labels')) {
        calls.label++;
        const foods = [];
        if (prompt.includes('Chicken')) {
          foods.push(label('Chicken', 165, 31, 0, 3.6));
        }

        if (prompt.includes('Olive oil')) {
          foods.push(label('Olive oil', 884, 0, 0, 100));
        }

        return { foods };
      }

      calls.recipe++;
      return recipeFn ? recipeFn() : recipe([{ name: 'Chicken', grams: 100 }]);
    });
  }

  const setLevel = (level: string) => (SettingsService.get as jest.Mock).mockResolvedValue(level);

  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
    calls.recipe = 0;
    calls.label = 0;
    calls.review = 0;
  });

  afterAll(() => setLevel('medium'));

  it('makes no review request at medium', async () => {
    setLevel('medium');
    script({});
    await trackMeal({ provider: 'on-device' } as never, 'chicken');
    expect(calls).toEqual({ recipe: 1, label: 1, review: 0 });
  });

  it('reviews once at high and estimates an added ingredient', async () => {
    setLevel('high');
    script({
      review: () => ({
        missingIngredients: [{ name: 'Olive oil', grams: 10 }],
        corrections: [],
      }),
    });
    const progress: string[] = [];
    const result = await trackMeal({ provider: 'on-device' } as never, 'chicken', undefined, (p) =>
      progress.push(p.step)
    );

    expect(calls.recipe).toBe(1);
    expect(calls.review).toBe(1);
    expect(progress).toContain('reviewing');
    const names = result?.meals[0].ingredients.map((i) => i.name);
    expect(names).toEqual(['Chicken', 'Olive oil']);
    expect(result?.meals[0].ingredients[1].kcal).toBeCloseTo(88.4, 0);
  });

  it('never lets an implausible added ingredient through unreconciled', async () => {
    setLevel('high');
    mockSendOnDeviceStructured.mockImplementation(async (_config, prompt: string) => {
      if (prompt.includes('reviewing a meal estimate')) {
        return { missingIngredients: [{ name: 'Mystery', grams: 100 }], corrections: [] };
      }

      if (prompt.includes('Nutrition facts labels')) {
        // The added food claims 1 kcal with 50 g of fat per 100 g: not plausible.
        return prompt.includes('Mystery')
          ? { foods: [label('Mystery', 1, 0, 0, 50)] }
          : { foods: [label('Chicken', 165, 31, 0, 3.6)] };
      }

      return recipe([{ name: 'Chicken', grams: 100 }]);
    });
    const result = await trackMeal({ provider: 'on-device' } as never, 'chicken');
    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients.flatMap((i) => ingredientMacroProblems(i))).toEqual([]);
  });

  it('keeps the estimate when the review fails', async () => {
    setLevel('high');
    script({
      review: () => {
        throw new Error('boom');
      },
    });
    const result = await trackMeal({ provider: 'on-device' } as never, 'chicken');
    expect(result?.meals[0].ingredients.map((i) => i.name)).toEqual(['Chicken']);
  });

  it('stops reviewing at tokenmaxxing after a round that changes nothing', async () => {
    setLevel('tokenmaxxing');
    script({});
    await trackMeal({ provider: 'on-device' } as never, 'chicken');

    expect(calls.review).toBe(1);
  });

  it('runs three recipe extractions and up to two reviews at tokenmaxxing', async () => {
    setLevel('tokenmaxxing');
    const progress: string[] = [];
    script({
      review: () => ({
        missingIngredients: [{ name: 'Olive oil', grams: 10 }],
        corrections: [],
      }),
    });
    await trackMeal({ provider: 'on-device' } as never, 'chicken', undefined, (p) =>
      progress.push(p.step)
    );

    expect(calls.recipe).toBe(3);
    expect(progress).toContain('comparing');
    // The second round finds the same oil already listed and adds nothing, but is still asked.
    expect(calls.review).toBe(2);
  });
});
