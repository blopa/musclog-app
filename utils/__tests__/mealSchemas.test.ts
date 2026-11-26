import { FoodService } from '@/database/services/FoodService';

import {
  ENGLISH_NAME_PROMPT_NOTE,
  getFoundationFoodsPrompt,
  getGenerateMealPlanFunctions,
  getMealAnalysisPrompt,
  getMealReviewFunctions,
  getMealReviewPrompt,
  getRecipeExtractionFunctions,
  getRecipeExtractionPrompt,
  getTrackMealFunctions,
  type MealSchemaDialect,
} from '../prompts';

jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn(), getMemoriesForPrompt: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));

jest.mock('@/database/services/FoodService', () => ({
  FoodService: { getFoundationFoodsSorted: jest.fn() },
}));

const mockFoods = FoodService.getFoundationFoodsSorted as jest.Mock;

const ALL_DIALECTS: MealSchemaDialect[] = [
  'openai',
  'gemini',
  'claude',
  'on-device',
  'gguf',
  'optional',
];
const REQUIRED_DIALECTS: MealSchemaDialect[] = ['openai', 'gemini', 'claude'];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const FOODS = [
  { id: '6f1c2a3b-4d5e-4f60-8a71-9b0c1d2e3f40', name: 'Chicken Breast' },
  { id: '11111111-2222-4333-8444-555555555555', name: 'Broccoli' },
  { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', name: 'Apple' },
];

const trackIngredient = (dialect: MealSchemaDialect, foundation: boolean) =>
  (getTrackMealFunctions(foundation, dialect)[0] as any).parameters.properties.meals.items
    .properties.ingredients.items;

const recipeIngredient = (dialect: MealSchemaDialect, foundation: boolean) =>
  (getRecipeExtractionFunctions(foundation, dialect)[0] as any).parameters.properties.meals.items
    .properties.ingredients.items;

const planIngredient = (dialect: MealSchemaDialect, foundation: boolean) =>
  (getGenerateMealPlanFunctions(foundation, dialect)[0] as any).parameters.properties.meals.items
    .properties.ingredients.items;

const reviewMissing = (dialect: MealSchemaDialect) =>
  (getMealReviewFunctions(dialect)[0] as any).parameters.properties.missingIngredients.items;

const reviewCorrections = (dialect: MealSchemaDialect) =>
  (getMealReviewFunctions(dialect)[0] as any).parameters.properties.corrections.items;

const expectOpenAiStrict = (schema: { properties: object; required: string[] }) => {
  expect(Object.keys(schema.properties).sort()).toEqual([...schema.required].sort());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFoods.mockResolvedValue(FOODS);
});

describe('trackMeal schema', () => {
  it('requires englishName for the cloud dialects only', () => {
    for (const dialect of ALL_DIALECTS) {
      const schema = trackIngredient(dialect, false);
      expect(schema.properties.englishName).toEqual(expect.objectContaining({ type: 'string' }));
      expect(schema.required.includes('englishName')).toBe(REQUIRED_DIALECTS.includes(dialect));
    }
  });

  it('adds foodId only with foundation foods, nullable and required for openai', () => {
    expect(trackIngredient('openai', false).properties.foodId).toBeUndefined();
    expect(trackIngredient('gemini', false).properties.foodId).toBeUndefined();

    const openai = trackIngredient('openai', true);
    expect(openai.properties.foodId.type).toEqual(['string', 'null']);
    expect(openai.required).toContain('foodId');

    for (const dialect of ALL_DIALECTS.filter((d) => d !== 'openai')) {
      const schema = trackIngredient(dialect, true);
      expect(schema.properties.foodId.type).toBe('string');
      expect(schema.required).not.toContain('foodId');
    }
  });

  it('lists every property as required for openai, with and without foundation foods', () => {
    expectOpenAiStrict(trackIngredient('openai', true));
    expectOpenAiStrict(trackIngredient('openai', false));
  });

  it('defaults the dialect to gemini', () => {
    expect(getTrackMealFunctions(true)).toEqual(getTrackMealFunctions(true, 'gemini'));
  });
});

describe('recipe schema', () => {
  it('requires name and grams plus the lookup rules', () => {
    expect(recipeIngredient('openai', true).required.sort()).toEqual(
      ['name', 'grams', 'foodId', 'englishName'].sort()
    );
    expectOpenAiStrict(recipeIngredient('openai', true));
    expectOpenAiStrict(recipeIngredient('openai', false));

    for (const dialect of ALL_DIALECTS) {
      const schema = recipeIngredient(dialect, true);
      expect(schema.required.includes('englishName')).toBe(REQUIRED_DIALECTS.includes(dialect));
      if (dialect !== 'openai') {
        expect(schema.required).not.toContain('foodId');
      }
    }
  });

  it('is exactly name and grams for on-device without foundation foods', () => {
    const schema = recipeIngredient('on-device', false);
    expect(schema.required).toEqual(['name', 'grams']);
    expect(schema.properties.foodId).toBeUndefined();
  });
});

describe('meal plan schema', () => {
  it('has no englishName in any dialect', () => {
    for (const dialect of ALL_DIALECTS) {
      expect(planIngredient(dialect, true).properties.englishName).toBeUndefined();
      expect(planIngredient(dialect, false).properties.englishName).toBeUndefined();
    }
  });

  it('follows the foodId rules and the openai strict rule', () => {
    expect(planIngredient('openai', true).properties.foodId.type).toEqual(['string', 'null']);
    expect(planIngredient('gemini', true).properties.foodId.type).toBe('string');
    expect(planIngredient('gemini', true).required).not.toContain('foodId');
    expectOpenAiStrict(planIngredient('openai', true));
    expectOpenAiStrict(planIngredient('openai', false));
  });
});

describe('meal review schema', () => {
  it('requires englishName on missingIngredients only for the cloud dialects', () => {
    for (const dialect of ALL_DIALECTS) {
      const items = reviewMissing(dialect);
      expect(items.properties.englishName).toBeDefined();
      expect(items.required.includes('englishName')).toBe(REQUIRED_DIALECTS.includes(dialect));
    }
  });

  it('never gives corrections an englishName', () => {
    for (const dialect of ALL_DIALECTS) {
      expect(reviewCorrections(dialect).properties.englishName).toBeUndefined();
      expect(reviewCorrections(dialect).required).not.toContain('englishName');
    }
  });

  it('keeps openai strict for missingIngredients', () => {
    expectOpenAiStrict(reviewMissing('openai'));
  });

  it('defaults the dialect to gemini', () => {
    expect(getMealReviewFunctions()).toEqual(getMealReviewFunctions('gemini'));
  });
});

describe('foodId description', () => {
  it('names the reference number before "|" and no longer says ID', () => {
    const schema = trackIngredient('gemini', true);
    expect(schema.properties.foodId.description).toContain('digits before "|"');
    expect(schema.properties.foodId.description).not.toMatch(/\bID\b/);
    expect(trackIngredient('openai', true).properties.foodId.description).not.toMatch(/\bID\b/);
  });
});

describe('getFoundationFoodsPrompt', () => {
  it('reads 1000 foods and returns text, idByRef and count', async () => {
    const result = await getFoundationFoodsPrompt('estimate');

    expect(mockFoods).toHaveBeenCalledWith(1000);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
    expect(result!.idByRef.get('1')).toBe(FOODS[2].id);
  });

  it('lists one reference|name line per food in a code fence, sorted by name, with no UUIDs', async () => {
    const result = await getFoundationFoodsPrompt('estimate');
    const text = result!.text;

    expect(text).toContain('```');
    expect(text).toContain('1|Apple');
    expect(text).toContain('2|Broccoli');
    expect(text).toContain('3|Chicken Breast');
    expect(text.indexOf('1|Apple')).toBeLessThan(text.indexOf('2|Broccoli'));
    expect(text).not.toMatch(UUID_RE);

    const listing = text.split('```')[1].trim().split('\n');
    expect(listing).toHaveLength(3);
    for (const line of listing) {
      expect(line).toMatch(/^\d+\|[^|]+$/);
    }
  });

  it('gives the estimate and recipe styles their own instructions over the same lines', async () => {
    const estimate = await getFoundationFoodsPrompt('estimate');
    const recipe = await getFoundationFoodsPrompt('recipe');

    expect(estimate!.text).toContain('kcal');
    expect(estimate!.text).toContain('foodId');
    expect(estimate!.text).toContain('Never invent a reference number');

    expect(recipe!.text).toContain('no macros needed');
    expect(recipe!.text).toContain('Do NOT invent reference numbers');

    const listing = (text: string) => text.split('```')[1];
    expect(listing(recipe!.text)).toEqual(listing(estimate!.text));
  });

  it('is stable across two calls', async () => {
    const first = await getFoundationFoodsPrompt('estimate');
    const second = await getFoundationFoodsPrompt('estimate');
    expect(second!.text).toBe(first!.text);
  });

  it('returns null when the service resolves an empty list', async () => {
    mockFoods.mockResolvedValue([]);
    expect(await getFoundationFoodsPrompt('estimate')).toBeNull();
  });

  it('returns null and does not throw when the service rejects', async () => {
    mockFoods.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(getFoundationFoodsPrompt('recipe')).resolves.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('meal prompts', () => {
  it('include the foundation text when passed and not when omitted', async () => {
    const foundation = (await getFoundationFoodsPrompt('estimate'))!;

    const withAnalysis = await getMealAnalysisPrompt(foundation, 'English');
    const withRecipe = await getRecipeExtractionPrompt(foundation, 'English');
    expect(withAnalysis).toContain(foundation.text);
    expect(withRecipe).toContain(foundation.text);

    const withoutAnalysis = await getMealAnalysisPrompt(null, 'English');
    const withoutRecipe = await getRecipeExtractionPrompt(undefined, 'English');
    expect(withoutAnalysis).not.toContain('Foundation Foods');
    expect(withoutRecipe).not.toContain('Foundation Foods');
  });

  it('always carry the englishName note', async () => {
    const foundation = (await getFoundationFoodsPrompt('estimate'))!;

    expect(await getMealAnalysisPrompt(foundation, 'English')).toContain(ENGLISH_NAME_PROMPT_NOTE);
    expect(await getMealAnalysisPrompt(null, 'English')).toContain(ENGLISH_NAME_PROMPT_NOTE);
    expect(await getRecipeExtractionPrompt(null, 'English')).toContain(ENGLISH_NAME_PROMPT_NOTE);
  });

  it('getMealReviewPrompt mentions englishName', () => {
    const prompt = getMealReviewPrompt({
      mealName: 'Lunch',
      ingredients: [{ name: 'Rice', grams: 100, kcal: 130, protein: 3, carbs: 28, fat: 0 }],
    });
    expect(prompt).toContain('englishName');
  });
});
