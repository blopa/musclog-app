import { AiCancelledError } from '../aiErrors';
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
  scene: 'A hand holding a regular-size plate with rice, at a restaurant.',
  setting: 'restaurant',
  container: 'plate',
  containerSize: 'about 26 cm across',
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

/**
 * Answers each request by what it is: the schema name tells a look, a recipe, macros or a review.
 * `kcalPerEstimate` gives the energy of the n-th macro estimate (default: always the same, so the
 * samples agree), `uncertain` is what each look lists as uncertain, `implausible` makes the first
 * macro estimate fail the plausibility check (10 kcal for 150 g of rice with 42 g of carbs).
 */
function answerByKind(
  options: {
    failLooks?: number;
    kcalPerEstimate?: (n: number) => number;
    uncertain?: string[];
    implausible?: boolean;
  } = {}
) {
  let failures = options.failLooks ?? 0;
  let estimates = 0;
  mockCreate.mockImplementation(async (params: any) => {
    switch (params.response_format.json_schema.name) {
      case 'observeMeal':
        if (failures > 0) {
          failures--;
          throw new Error('look failed');
        }

        return reply({ ...observation(), uncertain: options.uncertain ?? [] });
      case 'extractRecipe':
        return reply(recipe);
      case 'estimateMissingIngredients': {
        const n = estimates++;
        const kcal = options.kcalPerEstimate?.(n) ?? 195;

        return reply({
          ingredients: [
            {
              ...macros.ingredients[0],
              kcal: options.implausible && n === 0 ? 10 : kcal,
            },
          ],
        });
      }
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

  it('stops after one look and its two samples when they agree and nothing is uncertain', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind();
    const progress: { step: string; count?: number }[] = [];

    const result = await trackMeal(openai, 'a bowl of rice', undefined, (step) =>
      progress.push(step)
    );

    expect(callsFor('observeMeal')).toHaveLength(1);
    const recipes = callsFor('extractRecipe');
    expect(recipes).toHaveLength(2);
    expect(recipes.every((call) => /Rice look 1/.test(userTextOf(call)))).toBe(true);
    expect(userTextOf(recipes[0])).toContain('--- FIRST LOOK ---');
    expect(result?.meals[0].ingredients.map((ingredient) => ingredient.name)).toEqual(['Rice']);
    // The line stays true: one look, then the two samples compared.
    const steps = progress.map(({ step }) => step);
    expect(steps.slice(0, 2)).toEqual(['reading', 'observing']);
    expect(steps.filter((step) => step === 'observing')).toHaveLength(1);
    expect(progress.find(({ step }) => step === 'comparing')?.count).toBe(2);
  });

  it('takes the second look and two more samples when the first samples disagree', async () => {
    mockThinking.level = 'tokenmaxxing';
    // 195 kcal against 400 kcal in the first stage: more than 15% apart.
    answerByKind({ kcalPerEstimate: (n) => (n === 1 ? 400 : 195) });
    const progress: { step: string; count?: number }[] = [];

    const result = await trackMeal(openai, 'a bowl of rice', undefined, (step) =>
      progress.push(step)
    );

    expect(callsFor('observeMeal')).toHaveLength(2);
    const recipes = callsFor('extractRecipe');
    expect(recipes).toHaveLength(4);
    const lookOfRecipe = recipes.map((call) => /Rice look (\d)/.exec(userTextOf(call))?.[1]);
    expect(lookOfRecipe.filter((look) => look === '1')).toHaveLength(2);
    expect(lookOfRecipe.filter((look) => look === '2')).toHaveLength(2);
    expect(result?.meals[0].ingredients.map((ingredient) => ingredient.name)).toEqual(['Rice']);
    expect(progress.filter(({ step }) => step === 'observing')).toHaveLength(2);
    expect(progress.find(({ step }) => step === 'comparing')?.count).toBe(4);
  });

  it('takes the second look when the first look lists something uncertain', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind({ uncertain: ['whether the rice is cooked in oil'] });

    await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('observeMeal')).toHaveLength(2);
    expect(callsFor('extractRecipe')).toHaveLength(4);
  });

  it('takes the second look when a sample needed the plausibility recheck', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind({ implausible: true });

    await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('observeMeal')).toHaveLength(2);
    expect(callsFor('extractRecipe')).toHaveLength(4);
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

  it('goes on with the second look when the first fails', async () => {
    mockThinking.level = 'tokenmaxxing';
    answerByKind({ failLooks: 1 });

    const result = await trackMeal(openai, 'a bowl of rice');

    expect(callsFor('observeMeal')).toHaveLength(2);
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

  it('stops at a cancel during the first look without sampling', async () => {
    mockThinking.level = 'tokenmaxxing';
    mockCreate.mockRejectedValue(new AiCancelledError());

    await expect(trackMeal(openai, 'a bowl of rice')).resolves.toBeNull();
    expect(callsFor('observeMeal')).toHaveLength(1);
    expect(callsFor('extractRecipe')).toHaveLength(0);
  });
});
