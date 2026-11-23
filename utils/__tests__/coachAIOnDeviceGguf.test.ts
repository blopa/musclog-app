import { AiCancelledError, OnDeviceUnavailableError } from '../aiErrors';
import {
  type CoachAIConfig,
  estimateNutritionFromPhoto,
  requestStructured,
  sendCoachMessage,
  trackMeal,
} from '../coachAI';
import { LOCAL_PHOTO_UNMATCHED_FOOD_ID } from '../localFoodPhoto';

const mockSendLocalMessage = jest.fn();
const mockStreamLocalMessage = jest.fn();
const mockSendLocalStructuredRaw = jest.fn();
const mockSearchFoods = jest.fn();
const mockSendAppleStructured = jest.fn();
const mockGetUseThinkingMode = jest.fn().mockResolvedValue(false);

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendAppleStructured(...args),
  streamOnDeviceMessage: jest.fn(),
}));

jest.mock('../onDeviceLocal', () => ({
  sendLocalMessage: (...args: unknown[]) => mockSendLocalMessage(...args),
  streamLocalMessage: (...args: unknown[]) => mockStreamLocalMessage(...args),
  sendLocalStructuredRaw: (...args: unknown[]) => mockSendLocalStructuredRaw(...args),
}));

jest.mock('../aiImage', () => ({
  prepareOnDeviceImage: jest.fn(async (base64: string, mimeType: string) => ({ base64, mimeType })),
}));

jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../prompts', () => ({
  ...jest.requireActual('../prompts'),
  getChatMessagePromptContent: jest.fn().mockResolvedValue('SYSTEM'),
}));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getUseThinkingMode: () => mockGetUseThinkingMode(),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: { searchFoods: (...args: unknown[]) => mockSearchFoods(...args) },
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    // Same contract as the real one: a known id gets real numbers, an unknown id is stripped.
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

const schema = {
  type: 'object',
  required: ['answer'],
  properties: { answer: { type: 'string' } },
};

const request = {
  operation: 'test',
  schemaName: 'test',
  systemPrompt: 'sys',
  history: [],
  userMessage: 'hi',
  buildSchema: jest.fn(() => schema),
};

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllMocks();
  mockGetUseThinkingMode.mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

describe('requestStructured on the downloaded engine', () => {
  it('asks for the gguf dialect and accepts a conforming reply', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"answer":"ok"}');
    const result = await requestStructured(gguf, request);

    expect(request.buildSchema).toHaveBeenCalledWith('gguf');
    expect(result).toEqual({ kind: 'ok', value: { answer: 'ok' } });
    expect(mockSendLocalStructuredRaw.mock.calls[0][2]).toBe(schema);
  });

  it('turns a reply that parses but breaks the schema into malformed', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"other":1}');
    const result = await requestStructured(gguf, request);

    expect(result.kind).toBe('malformed');
  });

  it('reads JSON behind a leaked chat-template header (a real Pixel 10 Pro reply)', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('<|im_start|>assistant { "answer": "ok" }');

    expect(await requestStructured(gguf, request)).toEqual({
      kind: 'ok',
      value: { answer: 'ok' },
    });
  });

  it('reads JSON that has a sentence around it', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('Sure! {"answer":"ok"} Anything else?');

    expect((await requestStructured(gguf, request)).kind).toBe('ok');
  });

  it('turns text that is not JSON into malformed', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('Sure! Here you go');
    expect((await requestStructured(gguf, request)).kind).toBe('malformed');
  });

  it('leaves Apple on its own path, unchecked, with the on-device dialect', async () => {
    mockSendAppleStructured.mockResolvedValue({ other: 1 });
    const apple: CoachAIConfig = { ...gguf, engine: 'apple', vision: false };
    const result = await requestStructured(apple, request);

    expect(request.buildSchema).toHaveBeenCalledWith('on-device');
    expect(result).toEqual({ kind: 'ok', value: { other: 1 } });
    expect(mockSendLocalStructuredRaw).not.toHaveBeenCalled();
  });

  it('lets a not-ready error through rather than swallowing it', async () => {
    mockSendLocalStructuredRaw.mockRejectedValue(new OnDeviceUnavailableError('notReady'));
    await expect(requestStructured(gguf, request)).rejects.toBeInstanceOf(OnDeviceUnavailableError);
  });
});

describe('sendCoachMessage on the downloaded engine', () => {
  it('streams through the local model', async () => {
    mockStreamLocalMessage.mockImplementation(
      async (_m: unknown, _s: unknown, onDelta: (d: string) => void) => {
        onDelta('Hello ');
        onDelta('there');

        return 'Hello there';
      }
    );
    const seen: string[] = [];
    const reply = await sendCoachMessage(gguf, [], 'hi', 'general', {
      onText: (text) => seen.push(text),
    });

    expect(reply.msg4User).toBe('Hello there');
    expect(seen[seen.length - 1]).toBe('Hello there');
    expect(mockSendLocalMessage).not.toHaveBeenCalled();
  });

  it('rethrows a typed not-ready error instead of a generic apology', async () => {
    mockSendLocalMessage.mockRejectedValue(new OnDeviceUnavailableError('loadFailed'));
    await expect(sendCoachMessage(gguf, [], 'hi')).rejects.toMatchObject({ reason: 'loadFailed' });
  });

  it('rethrows a cancel', async () => {
    mockSendLocalMessage.mockRejectedValue(new AiCancelledError());
    await expect(sendCoachMessage(gguf, [], 'hi')).rejects.toBeInstanceOf(AiCancelledError);
  });
});

describe('estimateNutritionFromPhoto on the downloaded engine', () => {
  const food = (id: string, name: string) => ({
    id,
    name,
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
  });

  it('rejects when the GGUF projector is not installed', async () => {
    await expect(
      estimateNutritionFromPhoto({ ...gguf, vision: false }, 'AAAA')
    ).rejects.toMatchObject({
      reason: 'photosNotInstalled',
    });
    expect(mockSendLocalStructuredRaw).not.toHaveBeenCalled();
  });

  it('rejects photos on the Apple model with its unsupported reason', async () => {
    await expect(
      estimateNutritionFromPhoto({ ...gguf, engine: 'apple', vision: true }, 'AAAA')
    ).rejects.toMatchObject({ reason: 'photosUnsupported' });
  });

  it('routes Track Meal photos through local identification in thinking mode with context', async () => {
    mockGetUseThinkingMode.mockResolvedValue(true);
    mockSendLocalStructuredRaw.mockResolvedValue('{"items":[{"name":"rice","grams":150}]}');
    mockSearchFoods.mockResolvedValue([food('food-rice', 'White rice')]);

    const result = await trackMeal(gguf, 'steamed jasmine rice', 'data:image/jpeg;base64,AAAA');

    const [messages, , schemaSent, options] = mockSendLocalStructuredRaw.mock.calls[0];
    expect(messages[0].content).toMatch(/photo/i);
    expect(messages[0].content).toContain('steamed jasmine rice');
    expect(schemaSent).toBeDefined();
    expect(options.image).toBe('data:image/jpeg;base64,AAAA');
    expect(result?.meals[0].ingredients).toEqual(
      expect.arrayContaining([expect.objectContaining({ foodId: 'food-rice', kcal: 195 })])
    );
  });

  it('lets a camera model load failure reach the caller', async () => {
    mockSendLocalStructuredRaw.mockRejectedValue(new OnDeviceUnavailableError('loadFailed'));

    await expect(estimateNutritionFromPhoto(gguf, 'AAAA')).rejects.toMatchObject({
      reason: 'loadFailed',
    });
  });

  it('names foods, matches the ones the phone has and estimates the rest by name', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce(
        JSON.stringify({
          items: [
            { name: 'white rice', grams: 150 },
            { name: 'mystery stew', grams: 200 },
          ],
        })
      )
      // The follow-up estimate for the unmatched item.
      .mockResolvedValueOnce(
        JSON.stringify({
          ingredients: [
            {
              name: 'mystery stew',
              grams: 200,
              kcal: 300,
              protein: 20,
              carbs: 20,
              fat: 15,
              fiber: 3,
            },
          ],
        })
      );
    mockSearchFoods.mockImplementation(async (term: string) =>
      term === 'rice' || term === 'white' ? [food('food-rice', 'White rice')] : []
    );

    const result = await estimateNutritionFromPhoto(gguf, 'data:image/jpeg;base64,AAAA');

    // The photo request carried the image and the identify schema, and never asked for macros.
    const [messages, , schemaSent, options] = mockSendLocalStructuredRaw.mock.calls[0];
    expect(messages[0].content).toMatch(/photo/i);
    expect(JSON.stringify(schemaSent)).not.toMatch(/kcal|calorie|protein/i);
    expect(options.image).toBe('data:image/jpeg;base64,AAAA');

    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients.find((i) => i.name === 'White rice')).toMatchObject({
      foodId: 'food-rice',
      kcal: 195,
    });
    const stew = ingredients.find((i) => i.name === 'mystery stew');
    expect(stew?.kcal).toBe(300);
    expect(stew?.foodId).not.toBe(LOCAL_PHOTO_UNMATCHED_FOOD_ID);
  });

  it('returns null when nothing recognisable is in the photo', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"items":[]}');
    expect(await estimateNutritionFromPhoto(gguf, 'AAAA')).toBeNull();
  });

  it('returns null when the reply breaks the schema', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"foods":["rice"]}');
    expect(await estimateNutritionFromPhoto(gguf, 'AAAA')).toBeNull();
  });
});
