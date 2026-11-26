import { reportAiEvent } from '../aiTelemetry';
import { type CoachAIConfig } from '../coachAI';
import { trackMeal } from '../coachMealEstimate';
import { observeMeal } from '../coachMealSteps';

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
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../aiTelemetry', () => ({ reportAiEvent: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => 'off'),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { normalizeAiMealIngredients: jest.fn(async (items: unknown[]) => items) },
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const say = (value: unknown) =>
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(value) } }] });

describe('meal estimate quality signals', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockCreate.mockReset();
    jest.mocked(reportAiEvent).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports a first look the model answered with nothing usable', async () => {
    say({ items: [] });

    await expect(observeMeal(openai, 'a plate of rice')).resolves.toBeNull();

    expect(reportAiEvent).toHaveBeenCalledWith('ai-meal-look-unusable', {
      provider: 'openai',
      operation: 'observeMeal',
    });
  });

  it('reports nothing for a first look that read fine', async () => {
    say({ items: [{ name: 'rice', fill: 'half' }] });

    await observeMeal(openai, 'a plate of rice');

    expect(reportAiEvent).not.toHaveBeenCalledWith('ai-meal-look-unusable', expect.anything());
  });

  it('reports an estimate that came back with no ingredients at all', async () => {
    say({ meals: [] });

    await expect(trackMeal(openai, 'a plate of rice')).resolves.toEqual({ meals: [] });

    expect(reportAiEvent).toHaveBeenCalledWith('ai-meal-estimate-empty', {
      provider: 'openai',
      operation: 'estimateMeal',
    });
  });

  it('reports nothing for an estimate that has ingredients', async () => {
    say({
      meals: [
        {
          mealType: 'lunch',
          mealName: 'Rice',
          ingredients: [
            { name: 'Rice', grams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
          ],
        },
      ],
    });

    await trackMeal(openai, 'a plate of rice');

    expect(reportAiEvent).not.toHaveBeenCalledWith('ai-meal-estimate-empty', expect.anything());
  });
});
