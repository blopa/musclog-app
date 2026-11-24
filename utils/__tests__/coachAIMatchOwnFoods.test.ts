import { SettingsService } from '@/database/services/SettingsService';

import { type CoachAIConfig, trackMeal } from '../coachAI';

/**
 * A meal's ingredients that the model named without a confirmed food id are looked up BY NAME in
 * the foods this phone has before anything is estimated, for every provider. The model sees at most
 * 200 foundation foods (a local server none), so its claimed ids miss what the person really eats.
 */

const mockSendOnDeviceStructured = jest.fn();
const mockCreate = jest.fn();
const mockSearchFoods = jest.fn();

jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
  // The error classes `reportAiError` tests an error against (`isAiConnectionError`).
  class APIConnectionError extends Error {}

  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock, APIConnectionError });
});

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
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: { searchFoods: (...args: unknown[]) => mockSearchFoods(...args) },
}));

// Per 100 g, as the real lookup scales them by grams.
const PER_100G: Record<string, { kcal: number; protein: number; carbs: number; fat: number }> = {
  'own-chicken': { kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  'own-olive': { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  'own-rice': { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
};

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    // The real contract: a known foodId gets its own numbers scaled to the grams, any other id is
    // stripped so the ingredient reads as unmatched.
    normalizeAiMealIngredients: jest.fn(async (ingredients: { foodId?: string; grams: number }[]) =>
      ingredients.map((ingredient) => {
        if (!ingredient.foodId) {
          return ingredient;
        }

        const per100 = PER_100G[ingredient.foodId];
        if (!per100) {
          const { foodId: _, ...rest } = ingredient;
          return rest;
        }

        const scale = ingredient.grams / 100;
        return {
          ...ingredient,
          kcal: per100.kcal * scale,
          protein: per100.protein * scale,
          carbs: per100.carbs * scale,
          fat: per100.fat * scale,
          fiber: 0,
        };
      })
    ),
  },
}));

type StoredFood = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  nutritionBasis?: 'per_100g' | 'per_serving';
};

const stored = (id: string, name: string, extra: Partial<StoredFood> = {}): StoredFood => ({
  id,
  name,
  calories: PER_100G[id]?.kcal ?? 100,
  protein: PER_100G[id]?.protein ?? 1,
  carbs: PER_100G[id]?.carbs ?? 1,
  fat: PER_100G[id]?.fat ?? 1,
  fiber: 0,
  ...extra,
});

/** A foods table the `LIKE %term%` lookup reads. */
function useFoods(foods: StoredFood[]) {
  mockSearchFoods.mockImplementation(async (term: string) =>
    foods.filter((food) => food.name.toLowerCase().includes(term.toLowerCase()))
  );
}

const ON_DEVICE = { provider: 'on-device' } as unknown as CoachAIConfig;

const recipe = (items: { name: string; grams: number; foodId?: string }[]) => ({
  meals: [{ mealType: 'lunch', mealName: 'Lunch', ingredients: items }],
});

describe('trackMeal: unmatched ingredients are matched to the person’s foods by name', () => {
  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
    mockCreate.mockReset();
    mockSearchFoods.mockReset();
    (SettingsService.get as jest.Mock).mockResolvedValue('medium');
  });

  it('gives a name match its own food and numbers and does not send it to the estimate request', async () => {
    useFoods([stored('own-chicken', 'Chicken breast')]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(
        recipe([
          { name: 'Chicken breast', grams: 150 },
          { name: 'Mystery sauce', grams: 20 },
        ])
      )
      // The on-device estimate asks for a label per 100 g; 200 kcal at 20 g is 40.
      .mockResolvedValueOnce({
        foods: [{ name: 'Mystery sauce', kcal: 200, protein: 1, carbs: 40, fat: 1 }],
      });
    const progress: unknown[] = [];

    const result = await trackMeal(ON_DEVICE, 'chicken with sauce', undefined, (step) =>
      progress.push(step)
    );

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    const estimatePrompt = mockSendOnDeviceStructured.mock.calls[1][1] as string;
    expect(estimatePrompt).toContain('Mystery sauce');
    expect(estimatePrompt).not.toContain('Chicken breast');

    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients.find((item) => item.name === 'Chicken breast')).toMatchObject({
      foodId: 'own-chicken',
      grams: 150,
      kcal: 247.5,
      protein: 46.5,
    });
    expect(ingredients.find((item) => item.name === 'Mystery sauce')?.foodId).toBeUndefined();
    expect(progress).toContainEqual({ step: 'estimating', count: 1, matched: 1 });
  });

  it('makes no estimate request at all when every ingredient is matched', async () => {
    useFoods([stored('own-chicken', 'Chicken breast'), stored('own-rice', 'Rice, white')]);
    mockSendOnDeviceStructured.mockResolvedValueOnce(
      recipe([
        { name: 'chicken breast', grams: 100 },
        { name: 'Rice', grams: 200 },
      ])
    );

    const result = await trackMeal(ON_DEVICE, 'chicken and rice');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(result?.meals[0].ingredients).toEqual([
      expect.objectContaining({ name: 'chicken breast', foodId: 'own-chicken', kcal: 165 }),
      expect.objectContaining({ name: 'Rice', foodId: 'own-rice', kcal: 260 }),
    ]);
  });

  it('counts a model-claimed id and a name match together in the progress step', async () => {
    useFoods([stored('own-chicken', 'Chicken breast')]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(
        recipe([
          { name: 'Rice', grams: 100, foodId: 'own-rice' },
          { name: 'Chicken breast', grams: 100 },
          { name: 'Mystery sauce', grams: 20 },
        ])
      )
      .mockResolvedValueOnce({
        foods: [{ name: 'Mystery sauce', kcal: 200, protein: 1, carbs: 40, fat: 1 }],
      });
    const progress: unknown[] = [];

    await trackMeal(ON_DEVICE, 'lunch', undefined, (step) => progress.push(step));

    expect(progress).toContainEqual({ step: 'estimating', count: 1, matched: 2 });
  });

  it('leaves an ambiguous name unmatched and estimates it', async () => {
    useFoods([stored('a', 'Chicken breast fillet'), stored('b', 'Chicken breast strips')]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(recipe([{ name: 'Chicken breast', grams: 100 }]))
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    const chicken = result?.meals[0].ingredients[0];
    expect(chicken?.foodId).toBeUndefined();
    expect(chicken?.kcal).toBe(165);
  });

  it('never matches a food whose numbers are per serving (they cannot be scaled by grams)', async () => {
    useFoods([stored('own-chicken', 'Chicken breast', { nutritionBasis: 'per_serving' })]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(recipe([{ name: 'Chicken breast', grams: 100 }]))
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0].foodId).toBeUndefined();
  });

  it('carries on with the estimate when the food lookup fails', async () => {
    mockSearchFoods.mockRejectedValue(new Error('database is closed'));
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(recipe([{ name: 'Chicken breast', grams: 100 }]))
      .mockResolvedValueOnce({
        foods: [{ name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0]).toMatchObject({ name: 'Chicken breast', kcal: 165 });
  });

  it('matches nothing for a name with no letters it can search (Cyrillic): it is estimated', async () => {
    useFoods([stored('own-chicken', 'Chicken breast')]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(recipe([{ name: 'Куриная грудка', grams: 100 }]))
      .mockResolvedValueOnce({
        foods: [{ name: 'Куриная грудка', kcal: 165, protein: 31, carbs: 0, fat: 3.6 }],
      });

    const result = await trackMeal(ON_DEVICE, 'курица');

    expect(mockSearchFoods).not.toHaveBeenCalled();
    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0].foodId).toBeUndefined();
  });

  it('works for a cloud provider too (a custom server that sees no foundation foods)', async () => {
    useFoods([stored('own-chicken', 'Chicken breast')]);
    const reply = (value: unknown) => ({
      choices: [{ message: { content: JSON.stringify(value) } }],
    });
    mockCreate.mockImplementation(async (payload: { messages: { content: string }[] }) => {
      const system = payload.messages[0].content;
      if (system.includes('Identify ALL meals')) {
        return reply(
          recipe([
            { name: 'Chicken breast', grams: 150 },
            { name: 'Mystery sauce', grams: 20 },
          ])
        );
      }

      return reply({
        ingredients: [
          {
            name: 'Mystery sauce',
            grams: 20,
            kcal: 40,
            protein: 0.2,
            carbs: 8,
            fat: 0.2,
            fiber: 0,
          },
        ],
      });
    });
    const local = {
      provider: 'local',
      model: 'llama',
      apiKey: 'k',
      baseUrl: 'http://localhost:1234/v1',
    } as CoachAIConfig;

    const result = await trackMeal(local, 'chicken with sauce');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const estimateRequest = JSON.stringify(mockCreate.mock.calls[1][0]);
    expect(estimateRequest).toContain('Mystery sauce');
    expect(estimateRequest).toContain('Estimate macros for the missing ingredients');
    expect(estimateRequest).not.toContain('"name":"Chicken breast","grams":150,"kcal":0');
    expect(
      result?.meals[0].ingredients.find((item) => item.name === 'Chicken breast')
    ).toMatchObject({ foodId: 'own-chicken', kcal: 247.5 });
  });
});

describe('trackMeal: an ingredient a review adds is matched by name too', () => {
  const label = (name: string, kcal: number, protein: number, carbs: number, fat: number) => ({
    name,
    kcal,
    protein,
    carbs,
    fat,
  });

  function script(options: { review: unknown }) {
    const calls = { label: [] as string[], review: 0 };
    mockSendOnDeviceStructured.mockImplementation(async (_config, prompt: string) => {
      if (prompt.includes('reviewing a meal estimate')) {
        calls.review++;
        return options.review;
      }

      if (prompt.includes('Nutrition facts labels')) {
        calls.label.push(prompt);
        const foods = [];
        if (prompt.includes('Chicken breast')) {
          foods.push(label('Chicken breast', 165, 31, 0, 3.6));
        }

        if (prompt.includes('Mystery sauce')) {
          foods.push(label('Mystery sauce', 200, 1, 40, 1));
        }

        return { foods };
      }

      return recipe([{ name: 'Chicken breast', grams: 100 }]);
    });

    return calls;
  }

  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
    mockSearchFoods.mockReset();
    (SettingsService.get as jest.Mock).mockResolvedValue('high');
  });

  afterAll(() => (SettingsService.get as jest.Mock).mockResolvedValue('medium'));

  it('takes an added ingredient from the person’s own food instead of estimating it', async () => {
    useFoods([stored('own-olive', 'Olive oil')]);
    const calls = script({
      review: { missingIngredients: [{ name: 'Olive oil', grams: 10 }], corrections: [] },
    });

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(calls.review).toBeGreaterThan(0);
    // High reads a label twice, but every label request is about the original chicken: the oil
    // never needed one.
    expect(calls.label.length).toBeGreaterThan(0);
    for (const prompt of calls.label) {
      expect(prompt).toContain('Chicken breast');
      expect(prompt).not.toContain('Olive oil');
    }
    const oil = result?.meals[0].ingredients.find((item) => item.name === 'Olive oil');
    expect(oil).toMatchObject({ foodId: 'own-olive', kcal: 88.4 });
  });

  it('still estimates an added ingredient the person has no food for', async () => {
    useFoods([stored('own-olive', 'Olive oil')]);
    const calls = script({
      review: { missingIngredients: [{ name: 'Mystery sauce', grams: 20 }], corrections: [] },
    });

    const result = await trackMeal(ON_DEVICE, 'chicken');

    expect(calls.label.some((prompt) => prompt.includes('Mystery sauce'))).toBe(true);
    const sauce = result?.meals[0].ingredients.find((item) => item.name === 'Mystery sauce');
    expect(sauce?.foodId).toBeUndefined();
    expect(sauce?.kcal).toBeCloseTo(40, 0);
  });
});
