import { SettingsService } from '@/database/services/SettingsService';

import { type CoachAIConfig, generateMealPlan } from '../coachAI';
import { trackMeal } from '../coachMealEstimate';

/**
 * The foundation foods a meal estimate offers: every one of them, one `reference|name` line each in a
 * stable order, to every provider that takes them (a custom local server now too), read back by
 * reference against the very list that was sent; and an English name next to the displayed one so a
 * name in another language still finds the stored food.
 */

const mockCreate = jest.fn();
const mockSendOnDeviceStructured = jest.fn();
const mockSearchFoods = jest.fn();
const mockFoundation = jest.fn();

jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
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
    get: jest.fn(),
    getSendFoundationFoodsToLlm: jest.fn(),
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: {
    searchFoods: (...args: unknown[]) => mockSearchFoods(...args),
    searchFoodsByTerms: async (terms: string[], options: { includeDescription?: boolean }) =>
      (
        await Promise.all(
          terms.map((term) =>
            mockSearchFoods(term, { includeDescription: options.includeDescription })
          )
        )
      ).flat(),
    getFoundationFoodsSorted: (...args: unknown[]) => mockFoundation(...args),
  },
}));
// The plan prompt reads the person's profile; only the foundation block matters here.
jest.mock('../prompts', () => ({
  ...jest.requireActual('../prompts'),
  getGenerateMealPlanPrompt: jest.fn(
    async (
      _language: unknown,
      _targets: unknown,
      _phase: unknown,
      _context: unknown,
      foundation: { text: string } | null
    ) => `PLAN PROMPT\n${foundation?.text ?? ''}`
  ),
}));

// Per 100 g, as the real lookup scales them by grams.
const PER_100G: Record<string, { kcal: number; protein: number; carbs: number; fat: number }> = {
  'fx-broccoli': { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  'own-oats': { kcal: 389, protein: 17, carbs: 66, fat: 7 },
};

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
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

const UUID_BROCCOLI = 'fx-broccoli';
const FOUNDATION = [
  // Deliberately out of order: the list is sorted by name.
  { id: UUID_BROCCOLI, name: 'Broccoli, raw' },
  { id: 'fx-almond-milk', name: 'Almond Milk' },
];

const OPENAI = { provider: 'openai', model: 'gpt', apiKey: 'k' } as CoachAIConfig;
const LOCAL = {
  provider: 'local',
  model: 'llama',
  apiKey: 'k',
  baseUrl: 'http://localhost:1234/v1',
} as CoachAIConfig;
const ON_DEVICE = { provider: 'on-device' } as unknown as CoachAIConfig;

const reply = (value: unknown) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });

const oneMeal = (ingredients: Record<string, unknown>[]) => ({
  meals: [{ mealType: 'lunch', mealName: 'Lunch', ingredients }],
});

// Numbers that hang together, so nothing is re-estimated by the plausibility check.
const PLAUSIBLE = { kcal: 165, protein: 10, carbs: 20, fat: 5, fiber: 0 };

type StoredFood = {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const stored = (id: string, name: string, description?: string): StoredFood => ({
  id,
  name,
  ...(description ? { description } : {}),
  calories: PER_100G[id]?.kcal ?? 100,
  protein: PER_100G[id]?.protein ?? 1,
  carbs: PER_100G[id]?.carbs ?? 1,
  fat: PER_100G[id]?.fat ?? 1,
  fiber: 0,
});

/** A foods table the `LIKE %term%` lookup reads; the description only when the caller asks for it. */
function useFoods(foods: StoredFood[]) {
  mockSearchFoods.mockImplementation(
    async (term: string, options?: { includeDescription?: boolean }) =>
      foods.filter(
        (food) =>
          food.name.toLowerCase().includes(term.toLowerCase()) ||
          (options?.includeDescription &&
            food.description?.toLowerCase().includes(term.toLowerCase()))
      )
  );
}

const systemPromptOf = (call: number) =>
  mockCreate.mock.calls[call][0].messages[0].content as string;
const schemaOf = (call: number) =>
  mockCreate.mock.calls[call][0].response_format.json_schema.schema;
const ingredientSchemaOf = (call: number) =>
  schemaOf(call).properties.meals.items.properties.ingredients.items;

beforeEach(() => {
  mockCreate.mockReset();
  mockSendOnDeviceStructured.mockReset();
  mockSearchFoods.mockReset();
  mockFoundation.mockReset();
  mockFoundation.mockResolvedValue(FOUNDATION);
  (SettingsService.get as jest.Mock).mockResolvedValue('off');
  (SettingsService.getSendFoundationFoodsToLlm as jest.Mock).mockResolvedValue(true);
});

describe('which providers are offered the list', () => {
  it('sends a custom local server every foundation food: sorted, no ids, nothing required', async () => {
    mockCreate.mockResolvedValue(
      reply(oneMeal([{ name: 'Apple', englishName: 'apple', grams: 100, ...PLAUSIBLE }]))
    );

    await trackMeal(LOCAL, 'an apple');

    expect(mockFoundation).toHaveBeenCalledWith(1000);
    const system = systemPromptOf(0);
    expect(system).toContain('1|Almond Milk\n2|Broccoli, raw');
    expect(system).not.toContain('fx-almond-milk');
    const schema = ingredientSchemaOf(0);
    expect(schema.properties.foodId).toBeDefined();
    expect(schema.properties.englishName).toBeDefined();
    // A local server enforces no schema, so a missing field would cost a repair request.
    expect(schema.required).not.toContain('foodId');
    expect(schema.required).not.toContain('englishName');
  });

  it('still leaves the list out for a local server when the person turned it off', async () => {
    (SettingsService.getSendFoundationFoodsToLlm as jest.Mock).mockResolvedValue(false);
    mockCreate.mockResolvedValue(
      reply(oneMeal([{ name: 'Apple', englishName: 'apple', grams: 100, ...PLAUSIBLE }]))
    );

    await trackMeal(LOCAL, 'an apple');

    expect(mockFoundation).not.toHaveBeenCalled();
    expect(systemPromptOf(0)).not.toContain('Foundation Foods');
    expect(ingredientSchemaOf(0).properties.foodId).toBeUndefined();
    expect(ingredientSchemaOf(0).properties.englishName).toBeDefined();
  });

  it('never sends it to the on-device model', async () => {
    mockSendOnDeviceStructured.mockResolvedValue(
      oneMeal([{ name: 'Apple', grams: 100, ...PLAUSIBLE }])
    );

    await trackMeal(ON_DEVICE, 'an apple');

    expect(mockFoundation).not.toHaveBeenCalled();
    expect(mockSendOnDeviceStructured.mock.calls[0][1]).not.toContain('Foundation Foods');
  });

  it('lists every property as required for OpenAI strict mode, a missing food as null', async () => {
    mockCreate.mockResolvedValue(
      reply(oneMeal([{ name: 'Apple', englishName: 'apple', grams: 100, ...PLAUSIBLE }]))
    );

    await trackMeal(OPENAI, 'an apple');

    const schema = ingredientSchemaOf(0);
    expect(Object.keys(schema.properties).sort()).toEqual([...schema.required].sort());
    expect(schema.properties.foodId.type).toEqual(['string', 'null']);
    expect(schema.required).toContain('englishName');
  });

  it('builds the same prompt on every request, so a provider prompt cache can hit', async () => {
    mockCreate.mockResolvedValue(
      reply(oneMeal([{ name: 'Apple', englishName: 'apple', grams: 100, ...PLAUSIBLE }]))
    );

    await trackMeal(OPENAI, 'an apple');
    await trackMeal(OPENAI, 'a pear');

    expect(systemPromptOf(0)).toBe(systemPromptOf(1));
  });
});

describe('a reference the model returns is read against the list it was sent', () => {
  it('turns it into the real food id and takes that food’s numbers, keeping the model’s name', async () => {
    mockCreate.mockResolvedValue(
      reply(
        oneMeal([
          {
            name: 'Brócolis',
            englishName: 'broccoli',
            grams: 200,
            foodId: '2', // sorted: 1 = Almond Milk, 2 = Broccoli, raw
            kcal: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
          },
        ])
      )
    );

    const result = await trackMeal(OPENAI, 'broccoli');

    expect(result?.meals[0].ingredients[0]).toMatchObject({
      name: 'Brócolis',
      foodId: UUID_BROCCOLI,
      kcal: 68,
    });
  });

  it('drops a reference that names nothing like an invented id: the ingredient is estimated', async () => {
    mockCreate
      .mockResolvedValueOnce(
        reply(
          oneMeal([
            {
              name: 'Mystery',
              englishName: 'mystery',
              grams: 100,
              foodId: '999',
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        reply({ ingredients: [{ name: 'Mystery', grams: 100, ...PLAUSIBLE }] })
      );

    const result = await trackMeal(OPENAI, 'mystery');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0].foodId).toBeUndefined();
    expect(result?.meals[0].ingredients[0].kcal).toBe(165);
  });

  it('reads a meal plan’s references too, once, after any critique round', async () => {
    mockCreate.mockResolvedValue(
      reply({
        description: 'Plan',
        meals: [
          {
            day: 1,
            mealType: 'lunch',
            name: 'Bowl',
            description: 'A bowl',
            ingredients: [
              {
                name: 'Broccoli',
                kcal: 34,
                carbs: 7,
                fat: 0.4,
                protein: 2.8,
                fiber: 2.6,
                grams: 100,
                foodId: '2',
              },
              {
                name: 'Water',
                kcal: 0,
                carbs: 0,
                fat: 0,
                protein: 0,
                fiber: 0,
                grams: 100,
                foodId: 'null',
              },
            ],
          },
        ],
      })
    );

    const plan = await generateMealPlan(OPENAI, [], undefined, 'nutrition');

    expect(systemPromptOf(0)).toContain('2|Broccoli, raw');
    const [broccoli, water] = plan?.meals[0].ingredients ?? [];
    expect(broccoli.foodId).toBe(UUID_BROCCOLI);
    expect(water.foodId).toBeUndefined();
  });
});

describe('a name in the person’s language is matched through its English name', () => {
  const recipeOf = (ingredients: Record<string, unknown>[]) => oneMeal(ingredients);

  beforeEach(() => {
    (SettingsService.get as jest.Mock).mockResolvedValue('medium');
  });

  it('matches a Russian name by its English name and keeps the Russian name', async () => {
    useFoods([stored(UUID_BROCCOLI, 'Broccoli, raw')]);
    mockSendOnDeviceStructured.mockResolvedValueOnce(
      recipeOf([{ name: 'Брокколи', englishName: 'broccoli', grams: 150 }])
    );

    const result = await trackMeal(ON_DEVICE, 'брокколи');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(result?.meals[0].ingredients[0]).toMatchObject({
      name: 'Брокколи',
      foodId: UUID_BROCCOLI,
      kcal: 51,
    });
  });

  it('matches on the description alone, which the name search cannot see', async () => {
    useFoods([stored('own-oats', 'Quick Oats', 'Oats, whole grain, steel cut')]);
    mockSendOnDeviceStructured.mockResolvedValueOnce(
      recipeOf([{ name: 'Avena integral', englishName: 'whole grain oats', grams: 50 }])
    );

    const result = await trackMeal(ON_DEVICE, 'avena');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(1);
    expect(mockSearchFoods).toHaveBeenCalledWith(expect.any(String), { includeDescription: true });
    expect(result?.meals[0].ingredients[0]).toMatchObject({
      name: 'Avena integral',
      foodId: 'own-oats',
    });
  });

  it('leaves an ambiguous English name unmatched: it is estimated', async () => {
    useFoods([stored('a', 'Broccoli florets'), stored('b', 'Broccoli crowns')]);
    mockSendOnDeviceStructured
      .mockResolvedValueOnce(recipeOf([{ name: 'Brócolis', englishName: 'broccoli', grams: 100 }]))
      .mockResolvedValueOnce({
        foods: [{ name: 'Brócolis', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 }],
      });

    const result = await trackMeal(ON_DEVICE, 'brócolis');

    expect(mockSendOnDeviceStructured).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients[0].foodId).toBeUndefined();
  });

  it('falls back to the displayed name when the model gave no English one', async () => {
    useFoods([stored(UUID_BROCCOLI, 'Broccoli, raw')]);
    mockSendOnDeviceStructured.mockResolvedValueOnce(recipeOf([{ name: 'Broccoli', grams: 100 }]));

    const result = await trackMeal(ON_DEVICE, 'broccoli');

    expect(result?.meals[0].ingredients[0].foodId).toBe(UUID_BROCCOLI);
  });
});
