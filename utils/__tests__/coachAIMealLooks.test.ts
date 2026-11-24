import { type CoachAIConfig, trackMeal } from '../coachAI';

const mockCreate = jest.fn();
const mockThinking: { level: 'off' | 'medium' | 'high' | 'tokenmaxxing' } = { level: 'off' };

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
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../aiErrorNotice', () => ({ notifyUserFacingAiError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => mockThinking.level),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
    getNutritionDisplay: jest.fn(async () => '11101'),
  },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: jest.fn(async (ingredients: unknown[]) => ingredients),
  },
}));
jest.mock('@/utils/aiImage', () => ({
  prepareOwnKeyImage: jest.fn(async () => ({ base64: 'prepared', mimeType: 'image/jpeg' })),
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };

const schemaNameOf = (call: number): string =>
  mockCreate.mock.calls[call][0].response_format.json_schema.name;
const callsFor = (name: string): number[] =>
  mockCreate.mock.calls.flatMap((_, index) => (schemaNameOf(index) === name ? [index] : []));
// The user turn is a string for a typed meal and a list of parts (text, image) for a photo.
const userTextOf = (call: number): string => {
  const content = mockCreate.mock.calls[call][0].messages.at(-1).content;

  return typeof content === 'string'
    ? content
    : content.find((part: { type: string }) => part.type === 'text').text;
};

const reply = (value: unknown) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });
let lookNumber = 0;
const observation = () => ({
  mealCount: 1,
  items: [
    { name: `Rice look ${++lookNumber}`, portion: 'a fist', preparation: '', confidence: 'high' },
  ],
  scaleCues: [],
  addedFats: [],
  extras: [],
  uncertain: [],
});
const recipe = {
  meals: [
    { mealType: 'lunch', mealName: 'Rice bowl', ingredients: [{ name: 'Rice', grams: 150 }] },
  ],
};
const macros = {
  ingredients: [
    { name: 'Rice', grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5, fiber: 0.6 },
  ],
};

/** Answers each request by what it is: the schema name tells a look, a recipe, macros or a review. */
function answerByKind(options: { failLooks?: number } = {}) {
  let failures = options.failLooks ?? 0;
  mockCreate.mockImplementation(async (params: any) => {
    switch (params.response_format.json_schema.name) {
      case 'observeMeal':
        if (failures > 0) {
          failures--;
          throw new Error('look failed');
        }

        return reply(observation());
      case 'extractRecipe':
        return reply(recipe);
      case 'estimateMissingIngredients':
        return reply(macros);
      case 'reviewMealEstimate':
        return reply({ missingIngredients: [], corrections: [] });
      default:
        throw new Error(`unexpected request ${params.response_format.json_schema.name}`);
    }
  });
}

describe('meal estimate first looks', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    mockThinking.level = 'off';
    lookNumber = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['off', 'medium', 'high'] as const)('makes no first look at %s', async (level) => {
    mockThinking.level = level;
    answerByKind();

    await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('observeMeal')).toHaveLength(0);
  });

  it('takes two looks at tokenmaxxing and gives each to two recipe samples', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind();

    const result = await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('observeMeal')).toHaveLength(2);
    const recipes = callsFor('extractRecipe');
    expect(recipes).toHaveLength(4);
    const lookOfRecipe = recipes.map((call) => /Rice look (\d)/.exec(userTextOf(call))?.[1]);
    expect(lookOfRecipe.every(Boolean)).toBe(true);
    expect(lookOfRecipe.filter((look) => look === '1')).toHaveLength(2);
    expect(lookOfRecipe.filter((look) => look === '2')).toHaveLength(2);
    expect(userTextOf(recipes[0])).toContain('--- FIRST LOOK ---');
    expect(result?.meals[0].ingredients.map((ingredient) => ingredient.name)).toEqual(['Rice']);
  });

  it('reports the look first and then compares four estimates', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind();
    const progress: { step: string; count?: number }[] = [];

    await trackMeal(openai, 'a bowl of rice', undefined, (step) => progress.push(step));

    const steps = progress.map(({ step }) => step);
    expect(steps[0]).toBe('reading');
    expect(steps[1]).toBe('observing');
    expect(progress.find(({ step }) => step === 'comparing')?.count).toBe(4);
  });

  it('carries the look with the photo, which is still sent', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind();

    await trackMeal(openai, 'my lunch', 'data:image/jpeg;base64,AAAA');

    const [firstRecipe] = callsFor('extractRecipe');
    const content = mockCreate.mock.calls[firstRecipe][0].messages.at(-1).content;
    expect(content.some((part: { type: string }) => part.type === 'image_url')).toBe(true);
    expect(userTextOf(firstRecipe)).toContain('--- FIRST LOOK ---');
    const looks = callsFor('observeMeal');
    expect(
      mockCreate.mock.calls[looks[0]][0].messages
        .at(-1)
        .content.some((part: { type: string }) => part.type === 'image_url')
    ).toBe(true);
  });

  it('goes on with one look when the other fails', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind({ failLooks: 1 });

    const result = await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('extractRecipe')).toHaveLength(2);
    expect(result?.meals).toHaveLength(1);
  });

  it('falls back to the three plain samples when no look can be read', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind({ failLooks: 2 });

    const result = await trackMeal(openai, 'a bowl of rice');

    const recipes = callsFor('extractRecipe');
    expect(recipes).toHaveLength(3);
    expect(recipes.some((call) => userTextOf(call).includes('FIRST LOOK'))).toBe(false);
    expect(result?.meals).toHaveLength(1);
  });
});
