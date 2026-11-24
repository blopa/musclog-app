import { AiTimeoutError } from '../aiErrors';
import { type CoachAIConfig } from '../coachAI';
import { estimateNutritionFromPhoto } from '../coachMealEstimate';

const mockSendLocalStructuredRaw = jest.fn();
const mockReportAiError = jest.fn();
const mockSearchFoods = jest.fn();

jest.mock('../coachAI', () => ({
  ...jest.requireActual('../coachAI'),
  reportAiError: (...args: unknown[]) => mockReportAiError(...args),
}));
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../onDeviceLocal', () => ({
  sendLocalMessage: jest.fn(),
  streamLocalMessage: jest.fn(),
  sendLocalStructuredRaw: (...args: unknown[]) => mockSendLocalStructuredRaw(...args),
}));
jest.mock('../aiImage', () => ({
  prepareOnDeviceImage: jest.fn(async (base64: string, mimeType: string) => ({ base64, mimeType })),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn().mockResolvedValue('off'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: {
    searchFoods: (...args: unknown[]) => mockSearchFoods(...args),
    searchFoodsByTerms: async (terms: string[]) =>
      (await Promise.all(terms.map((term) => mockSearchFoods(term)))).flat(),
  },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: jest.fn(async (ingredients: { foodId?: string }[]) =>
      ingredients.map((ingredient) => {
        if (ingredient.foodId === 'food-rice') {
          return { ...ingredient, kcal: 195, protein: 4, carbs: 42, fat: 0.4, fiber: 0.6 };
        }

        const { foodId: _foodId, ...rest } = ingredient;

        return rest;
      })
    ),
  },
}));

const gguf: CoachAIConfig = {
  provider: 'on-device',
  model: 'on-device',
  language: 'en-US',
  engine: 'gguf',
  vision: true,
};

const PHOTO = 'data:image/jpeg;base64,AAAA';
const RICE = '{"items":[{"name":"white rice","grams":150}]}';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllMocks();
  mockSearchFoods.mockImplementation(async (term: string) =>
    term === 'rice' || term === 'white'
      ? [
          {
            id: 'food-rice',
            name: 'White rice',
            calories: 130,
            protein: 2.7,
            carbs: 28,
            fat: 0.3,
            fiber: 0.4,
          },
        ]
      : []
  );
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('who reports a failed on-device meal photo', () => {
  it('lets a single failing photo reject without the util reporting it', async () => {
    const failure = new Error('boom');
    mockSendLocalStructuredRaw.mockRejectedValue(failure);

    await expect(estimateNutritionFromPhoto(gguf, PHOTO)).rejects.toBe(failure);
    expect(mockReportAiError).not.toHaveBeenCalled();
  });

  it('reports only the swallowed failure when one of several photos fails', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce(RICE)
      .mockRejectedValueOnce(new Error('second photo'))
      .mockResolvedValueOnce(RICE);

    const result = await estimateNutritionFromPhoto(gguf, [PHOTO, PHOTO, PHOTO]);

    expect(result?.meals[0].ingredients.length).toBeGreaterThan(0);
    expect(mockReportAiError).toHaveBeenCalledTimes(1);
    expect(mockReportAiError.mock.calls[0][0]).toMatchObject({ message: 'second photo' });
  });

  it('rejects with the first failure and reports none when every photo fails', async () => {
    const first = new Error('first');
    mockSendLocalStructuredRaw
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValueOnce(new Error('third'));

    await expect(estimateNutritionFromPhoto(gguf, [PHOTO, PHOTO, PHOTO])).rejects.toBe(first);
    expect(mockReportAiError).not.toHaveBeenCalled();
  });
});

describe('the timeout of an on-device photo request', () => {
  it('is an idle timeout: every token resets it', async () => {
    jest.useFakeTimers();
    mockSendLocalStructuredRaw.mockImplementation(
      (
        _messages: unknown,
        _system: unknown,
        _schema: unknown,
        options: { onDelta?: () => void; signal?: AbortSignal }
      ) =>
        new Promise<string>((resolve, reject) => {
          // The real runtime stops generating when it is aborted.
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          setTimeout(() => options.onDelta?.(), 30_000);
          setTimeout(() => options.onDelta?.(), 60_000);
          setTimeout(() => resolve(RICE), 90_000);
        })
    );

    const pending = estimateNutritionFromPhoto(gguf, PHOTO).then(
      (value) => ({ value }),
      (error: unknown) => ({ error })
    );
    await jest.advanceTimersByTimeAsync(95_000);
    const outcome = await pending;

    expect('error' in outcome ? outcome.error : null).not.toBeInstanceOf(AiTimeoutError);
    expect('error' in outcome).toBe(false);
    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(1);
  });
});
