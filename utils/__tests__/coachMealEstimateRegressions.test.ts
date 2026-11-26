import { SettingsService } from '@/database/services/SettingsService';
import { NutritionService } from '@/database/services/NutritionService';

import { type CoachAIConfig } from '../coachAI';
import { estimateNutritionFromPhoto, trackMeal } from '../coachMealEstimate';
import { getMealAnalysisPrompt } from '../prompts';

const mockSendOnDeviceStructured = jest.fn();
const mockCreate = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI() {
    return { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);
  return { __esModule: true, default: Mock };
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendOnDeviceStructured(...args),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../aiErrorNotice', () => ({ notifyUserFacingAiError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn().mockResolvedValue('medium'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: {
    searchFoods: jest.fn(async () => []),
    searchFoodsByTerms: jest.fn(async () => []),
  },
}));
jest.mock('@/utils/aiImage', () => ({
  prepareOwnKeyImage: jest.fn(async (base64: string) => ({ base64, mimeType: 'image/jpeg' })),
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    // A known foodId gets its own numbers (130 kcal per 100 g) scaled to the grams.
    normalizeAiMealIngredients: jest.fn(async (ingredients: { foodId?: string; grams: number }[]) =>
      ingredients.map((ingredient) => {
        if (ingredient.foodId !== 'food-rice') {
          const { foodId: _, ...rest } = ingredient;
          return rest;
        }

        const scale = ingredient.grams / 100;
        return {
          ...ingredient,
          kcal: 130 * scale,
          protein: 2.7 * scale,
          carbs: 28 * scale,
          fat: 0.3 * scale,
          fiber: 0,
        };
      })
    ),
  },
}));

const ON_DEVICE = { provider: 'on-device' } as unknown as CoachAIConfig;
const setLevel = (level: string) => (SettingsService.get as jest.Mock).mockResolvedValue(level);
const label = (name: string, kcal: number, protein: number, carbs: number, fat: number) => ({
  name,
  kcal,
  protein,
  carbs,
  fat,
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSendOnDeviceStructured.mockReset();
  mockCreate.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
  setLevel('medium');
});

describe('a partial estimate never shortens the meal (verified path)', () => {
  const recipe = {
    meals: [
      {
        mealType: 'lunch',
        mealName: 'Plate',
        ingredients: [
          { name: 'Chicken', grams: 150 },
          { name: 'Olive oil', grams: 10 },
          { name: 'Broccoli', grams: 80 },
        ],
      },
    ],
  };

  function script(labelAnswers: (prompt: string, call: number) => unknown) {
    let labelCall = 0;
    mockSendOnDeviceStructured.mockImplementation(async (_config, prompt: string) => {
      if (prompt.includes('Nutrition facts labels')) {
        return labelAnswers(prompt, labelCall++);
      }

      return recipe;
    });
  }

  it('keeps all three ingredients and estimates the omitted one in the recheck', async () => {
    setLevel('medium');
    script((_prompt, call) =>
      call === 0
        ? { foods: [label('Chicken', 165, 31, 0, 3.6), label('Olive oil', 884, 0, 0, 100)] }
        : { foods: [label('Broccoli', 34, 2.8, 7, 0.4)] }
    );

    const result = await trackMeal(ON_DEVICE, 'plate');
    const ingredients = result?.meals[0].ingredients ?? [];

    expect(ingredients.map((i) => [i.name, i.grams])).toEqual([
      ['Chicken', 150],
      ['Olive oil', 10],
      ['Broccoli', 80],
    ]);
    const broccoli = ingredients.find((i) => i.name === 'Broccoli');
    expect(broccoli?.kcal).toBeGreaterThan(0);
    expect(broccoli?.kcal).toBeCloseTo(27.2, 0);
  });

  it('leaves the ingredient in the meal with zero numbers when the second estimate omits it too', async () => {
    setLevel('medium');
    script(() => ({
      foods: [label('Chicken', 165, 31, 0, 3.6), label('Olive oil', 884, 0, 0, 100)],
    }));

    const result = await trackMeal(ON_DEVICE, 'plate');
    const ingredients = result?.meals[0].ingredients ?? [];

    expect(ingredients.map((i) => i.name)).toEqual(['Chicken', 'Olive oil', 'Broccoli']);
    expect(ingredients[2]).toMatchObject({ grams: 80, kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('the consensus re-reads matched foods from the database', () => {
  it('applies the lookup to the averaged meal at the median grams', async () => {
    setLevel('tokenmaxxing');
    const grams = [100, 150, 200];
    let recipeCall = 0;
    mockSendOnDeviceStructured.mockImplementation(async (_config, prompt: string) => {
      if (prompt.includes('reviewing a meal estimate')) {
        return { missingIngredients: [], corrections: [] };
      }

      const answer = {
        meals: [
          {
            mealType: 'lunch',
            mealName: 'Rice',
            ingredients: [{ name: 'Rice', grams: grams[recipeCall++ % 3], foodId: 'food-rice' }],
          },
        ],
      };
      return answer;
    });

    const result = await trackMeal(ON_DEVICE, 'rice');

    expect(recipeCall).toBe(3);
    const normalize = NutritionService.normalizeAiMealIngredients as jest.Mock;
    const lastCall = normalize.mock.calls.at(-1)?.[0] as { grams: number; foodId?: string }[];
    expect(lastCall).toEqual([expect.objectContaining({ foodId: 'food-rice', grams: 150 })]);
    const rice = result?.meals[0].ingredients[0];
    expect(rice).toMatchObject({ foodId: 'food-rice', grams: 150 });
    expect(rice?.kcal).toBeCloseTo(195, 5);
  });
});

describe('estimateNutritionFromPhoto language', () => {
  const openai: CoachAIConfig = {
    provider: 'openai',
    model: 'gpt',
    apiKey: 'k',
    language: 'pt-BR',
  };
  const answer = {
    meals: [
      {
        mealType: 'lunch',
        mealName: 'Prato',
        ingredients: [{ name: 'Arroz', grams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }],
      },
    ],
  };

  const systemPromptOf = (call: number): string => {
    const messages = mockCreate.mock.calls[call][0].messages as {
      role: string;
      content: unknown;
    }[];
    const system = messages.find((m) => m.role === 'system' || m.role === 'developer');

    return String(system?.content ?? '');
  };

  it('sends the language note in the meal-analysis system prompt at the Off level', async () => {
    setLevel('off');
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(answer) } }] });

    await estimateNutritionFromPhoto(openai, 'data:image/jpeg;base64,AAAA');

    const expected = await getMealAnalysisPrompt(null, 'pt-BR');
    expect(expected).toContain('pt-BR');
    expect(systemPromptOf(0)).toContain(expected);
  });
});
