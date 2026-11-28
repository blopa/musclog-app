import { AiCancelledError, OnDeviceUnavailableError } from '../aiErrors';
import {
  type CoachAIConfig,
  getNutritionInsights,
  requestStructured,
  sendCoachMessage,
} from '../coachAI';
import { estimateNutritionFromPhoto, trackMeal } from '../coachMealEstimate';

const mockSendLocalMessage = jest.fn();
const mockStreamLocalMessage = jest.fn();
const mockSendLocalStructuredRaw = jest.fn();
const mockSearchFoods = jest.fn();
const mockSendAppleStructured = jest.fn();
const mockGetThinkingLevel = jest.fn().mockResolvedValue('off');

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
  getNutritionInsightsPrompt: jest
    .fn()
    .mockResolvedValue('DATA: protein 120 g, calories 2150 kcal'),
}));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: () => mockGetThinkingLevel(),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
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
  },
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
  mockGetThinkingLevel.mockResolvedValue('off');
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

  it('hands the downloaded model the photo and the sampling temperature of the request', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"answer":"ok"}');

    await requestStructured(gguf, {
      ...request,
      images: [{ base64: 'AAAA', mimeType: 'image/png' }],
      temperature: 0.3,
    });

    expect(mockSendLocalStructuredRaw.mock.calls[0][3]).toEqual(
      expect.objectContaining({ image: 'data:image/png;base64,AAAA', temperature: 0.3 })
    );
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

  it('repairs almost-JSON, then still checks it against the schema', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue("{'answer': 'ok',}");
    expect(await requestStructured(gguf, request)).toEqual({
      kind: 'ok',
      value: { answer: 'ok' },
    });

    mockSendLocalStructuredRaw.mockResolvedValue("{'other': 1,}");
    expect((await requestStructured(gguf, request)).kind).toBe('malformed');
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

  it('hides leaked chat-template tokens while streaming and in the saved reply', async () => {
    mockStreamLocalMessage.mockImplementation(
      async (_m: unknown, _s: unknown, onDelta: (d: string) => void) => {
        onDelta('<|im_start|>assistant ');
        onDelta('Anytime!<|im_e');
        onDelta('nd|>');

        return '';
      }
    );
    const seen: string[] = [];
    const reply = await sendCoachMessage(gguf, [], 'thanks', 'general', {
      onText: (text) => seen.push(text),
    });

    expect(reply.msg4User).toBe('Anytime!');
    expect(seen.every((text) => !text.includes('<|'))).toBe(true);
  });

  it('answers an empty generation with an empty reply, never the apology as the coach’s words', async () => {
    // The reply service reads an empty reply as a failed send (message taken back, composer
    // restored). A saved apology would sit in the history, and a small model copies its replies.
    mockSendLocalMessage.mockResolvedValue('<|im_end|>');

    const reply = await sendCoachMessage(gguf, [], 'hi');

    expect(reply.msg4User).toBe('');
  });

  it('sends only the latest turns, and no penalties of its own (the model carries its vendor sampling)', async () => {
    mockSendLocalMessage.mockResolvedValue('Anytime!');
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('coach' as const),
      content: `turn ${i}`,
      at: 1_700_000_000_000 + i * 1000,
    }));

    await sendCoachMessage(gguf, history, 'thanks');

    const [messages, , , extra] = mockSendLocalMessage.mock.calls[0];
    // 6 history turns + the new message
    expect(messages).toHaveLength(7);
    expect(messages[0].content).toBe('turn 4');
    // (messages, system prompt, signal, usage callback): nothing is sampled differently, the
    // penalties are gone
    expect(extra).toEqual(expect.any(Function));
    expect(mockSendLocalMessage.mock.calls[0]).toHaveLength(4);
  });

  it('answers a chat reply in one request at the Tokenmaxxing level (no review round)', async () => {
    mockGetThinkingLevel.mockResolvedValue('tokenmaxxing');
    mockSendLocalMessage.mockResolvedValue('Anytime!');

    const reply = await sendCoachMessage(gguf, [], 'thanks');

    expect(mockSendLocalMessage).toHaveBeenCalledTimes(1);
    expect(reply.msg4User).toBe('Anytime!');
    for (const message of mockSendLocalMessage.mock.calls[0][0]) {
      expect(String(message.content)).not.toContain('Review round');
    }
  });

  it('streams a chat reply in one request at the Tokenmaxxing level (no reviewing phase)', async () => {
    mockGetThinkingLevel.mockResolvedValue('tokenmaxxing');
    mockStreamLocalMessage.mockResolvedValue('Anytime!');
    const onPhase = jest.fn();

    await sendCoachMessage(gguf, [], 'thanks', 'general', { onText: jest.fn(), onPhase });

    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(1);
    expect(onPhase).not.toHaveBeenCalledWith('reviewing');
  });

  it('never penalises a structured reply', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"answer":"x"}');
    await requestStructured(gguf, request);

    expect(mockSendLocalStructuredRaw.mock.calls[0][3]).not.toHaveProperty('penalties');
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

describe('an insight on the downloaded engine', () => {
  it('is one request at every thinking level, never fact-checked in rounds', async () => {
    for (const level of ['high', 'tokenmaxxing']) {
      mockGetThinkingLevel.mockResolvedValue(level);
      mockSendLocalMessage.mockReset();
      mockSendLocalMessage.mockResolvedValue('You ate 120 g of protein.');

      const insight = await getNutritionInsights(gguf, '2026-11-01', '2026-11-07');

      expect(insight).toBe('You ate 120 g of protein.');
      expect(mockSendLocalMessage).toHaveBeenCalledTimes(1);
    }
  });
});

describe('a chat reply that copies an earlier coach turn, on the downloaded engine', () => {
  const pplAnswer =
    'A push pull legs split trains pushing muscles on one day, pulling muscles on the next and ' +
    'legs on the third, so every muscle gets two sessions a week when you run it twice.';
  const history = [
    { role: 'user' as const, content: 'what is a ppl split?', at: 1_700_000_000_000 },
    { role: 'coach' as const, content: pplAnswer, at: 1_700_000_001_000 },
    { role: 'user' as const, content: 'thanks', at: 1_700_000_002_000 },
    { role: 'coach' as const, content: 'Anytime!', at: 1_700_000_003_000 },
  ];
  const chunksOf = (text: string) => text.match(/\S+\s*/g) ?? [];

  /** A mock of the runtime's stream that stops, like llama.rn, once its signal is aborted. */
  const streaming =
    (text: string, signals?: AbortSignal[]) =>
    async (_m: unknown, _s: unknown, onDelta: (d: string) => void, signal?: AbortSignal) => {
      if (signal) {
        signals?.push(signal);
      }

      for (const chunk of chunksOf(text)) {
        onDelta(chunk);
        if (signal?.aborted) {
          throw new AiCancelledError();
        }
      }

      return text;
    };

  it('stops the copy before any of it is shown and writes the reply from the person’s messages alone', async () => {
    const signals: AbortSignal[] = [];
    mockStreamLocalMessage
      .mockImplementationOnce(streaming(pplAnswer, signals))
      .mockImplementationOnce(streaming('Of course. What do you want to work on next?'));
    const seen: string[] = [];

    const reply = await sendCoachMessage(gguf, history, 'that is all you can say?', 'general', {
      onText: (text) => seen.push(text),
    });

    expect(reply.msg4User).toBe('Of course. What do you want to work on next?');
    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    // Nothing of the copy reached the screen, only the second reply did.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((text) => !text.includes('pushing muscles'))).toBe(true);
    expect(seen[seen.length - 1]).toBe('Of course. What do you want to work on next?');
    // The second request holds the person's messages and no coach turn, run into one message.
    const [secondMessages] = mockStreamLocalMessage.mock.calls[1];
    expect(secondMessages).toHaveLength(1);
    expect(secondMessages[0].role).toBe('user');
    expect(secondMessages[0].content).toContain('what is a ppl split?');
    expect(secondMessages[0].content).toContain('that is all you can say?');
    expect(secondMessages[0].content).not.toContain('pushing muscles');
  });

  it('shows a reply that is not a copy as it is written, in one request', async () => {
    mockStreamLocalMessage.mockImplementation(
      streaming(
        'Sure. Tell me your goal and how many days you can train, and I will suggest a plan.'
      )
    );
    const seen: string[] = [];

    const reply = await sendCoachMessage(gguf, history, 'what should I do next?', 'general', {
      onText: (text) => seen.push(text),
    });

    expect(reply.msg4User).toContain('Tell me your goal');
    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(1);
    expect(seen[0].startsWith('Sure.')).toBe(true);
    expect(seen[seen.length - 1]).toContain('suggest a plan');
  });

  it('writes a short reply again when it repeats an earlier coach turn word for word', async () => {
    mockStreamLocalMessage
      .mockImplementationOnce(streaming('Anytime!'))
      .mockImplementationOnce(streaming('You are welcome, glad to help.'));

    const reply = await sendCoachMessage(gguf, history, 'nice', 'general', { onText: jest.fn() });

    expect(reply.msg4User).toBe('You are welcome, glad to help.');
    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(2);
  });

  it('checks the whole reply when nothing is streamed', async () => {
    mockSendLocalMessage
      .mockResolvedValueOnce(pplAnswer)
      .mockResolvedValueOnce('Happy to help with anything else.');

    const reply = await sendCoachMessage(gguf, history, 'ok');

    expect(reply.msg4User).toBe('Happy to help with anything else.');
    expect(mockSendLocalMessage).toHaveBeenCalledTimes(2);
    for (const message of mockSendLocalMessage.mock.calls[1][0]) {
      expect(message.role).toBe('user');
    }
  });

  it('does not touch a conversation with no earlier coach turn', async () => {
    mockStreamLocalMessage.mockImplementation(streaming('Hello! How can I help you today?'));
    const onText = jest.fn();

    await sendCoachMessage(gguf, [], 'hi', 'general', { onText });

    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalled();
  });

  it('never turns the person’s own cancel into a second attempt', async () => {
    const controller = new AbortController();
    mockStreamLocalMessage.mockImplementation(
      async (_m: unknown, _s: unknown, onDelta: (d: string) => void) => {
        onDelta('A push ');
        controller.abort();

        throw new AiCancelledError();
      }
    );

    await expect(
      sendCoachMessage({ ...gguf, signal: controller.signal }, history, 'what next?', 'general', {
        onText: jest.fn(),
      })
    ).rejects.toBeInstanceOf(AiCancelledError);
    expect(mockStreamLocalMessage).toHaveBeenCalledTimes(1);
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
    mockGetThinkingLevel.mockResolvedValue('medium');
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
          foods: [{ name: 'mystery stew', kcal: 150, protein: 10, carbs: 10, fat: 7.5 }],
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
    // The person's own wording is kept; the numbers are the matched food's.
    expect(ingredients.find((i) => i.name === 'white rice')).toMatchObject({
      foodId: 'food-rice',
      kcal: 195,
    });
    const stew = ingredients.find((i) => i.name === 'mystery stew');
    expect(stew?.kcal).toBe(300);
    expect(stew?.foodId).toBeUndefined();
  });

  it('returns null when nothing recognisable is in the photo', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"items":[]}');
    expect(await estimateNutritionFromPhoto(gguf, 'AAAA')).toBeNull();
  });

  it('returns null when the reply breaks the schema, after a warmer retry and one repair call', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"foods":["rice"]}');
    expect(await estimateNutritionFromPhoto(gguf, 'AAAA')).toBeNull();

    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(3);
    expect(mockSendLocalStructuredRaw.mock.calls[0][3].temperature).toBeUndefined();
    expect(mockSendLocalStructuredRaw.mock.calls[1][3].temperature).toBe(0.3);
  });

  it('asks the model once, text only, to repair the broken reply, and uses the answer', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce('garbage one')
      .mockResolvedValueOnce('garbage two')
      .mockResolvedValueOnce('{"items":[{"name":"white rice","grams":150}]}');
    mockSearchFoods.mockImplementation(async () => [food('food-rice', 'White rice')]);

    const result = await estimateNutritionFromPhoto(gguf, 'AAAA');

    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(3);
    const [messages, systemPrompt, , options] = mockSendLocalStructuredRaw.mock.calls[2];
    expect(messages[0].content).toContain('garbage two');
    expect(systemPrompt).toMatch(/repair/i);
    expect(options.image).toBeUndefined();
    expect(result?.meals[0].ingredients.length).toBeGreaterThan(0);
  });

  it('survives a failing repair call and reports the original failure as null', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce('garbage one')
      .mockResolvedValueOnce('garbage two')
      .mockRejectedValueOnce(new Error('engine blew up'));

    expect(await estimateNutritionFromPhoto(gguf, 'AAAA')).toBeNull();
  });

  it('lets a cancel during the repair call through', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce('garbage one')
      .mockResolvedValueOnce('garbage two')
      .mockRejectedValueOnce(new AiCancelledError());

    await expect(estimateNutritionFromPhoto(gguf, 'AAAA')).rejects.toBeInstanceOf(AiCancelledError);
  });

  it('uses the retry when the first reply is unusable', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce('{"items":[{"name":"white rice","grams":150}]}');
    mockSearchFoods.mockImplementation(async () => [food('food-rice', 'White rice')]);

    const result = await estimateNutritionFromPhoto(gguf, 'AAAA');

    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(2);
    expect(result?.meals[0].ingredients.length).toBeGreaterThan(0);
  });

  it('does not retry an empty but valid list', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue('{"items":[]}');
    await estimateNutritionFromPhoto(gguf, 'AAAA');

    // A valid answer, even an empty one, never reaches the retry or the repair call.
    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(1);
  });
});

describe('estimateNutritionFromPhoto on the downloaded engine, by thinking level', () => {
  const rice = {
    id: 'food-rice',
    name: 'White rice',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
  };
  const items = (...list: [string, number][]) =>
    JSON.stringify({ items: list.map(([name, grams]) => ({ name, grams })) });
  const stewLabel = (kcal: number) =>
    JSON.stringify({ foods: [{ name: 'mystery stew', kcal, protein: 10, carbs: 10, fat: 7.5 }] });
  const photoCalls = () =>
    mockSendLocalStructuredRaw.mock.calls.filter(([, , , options]) => options?.image).length;

  beforeEach(() => {
    mockSearchFoods.mockImplementation(async (term: string) =>
      term === 'rice' || term === 'white' ? [rice] : []
    );
  });

  it('reads the photo once at medium', async () => {
    mockGetThinkingLevel.mockResolvedValue('medium');
    mockSendLocalStructuredRaw.mockResolvedValue(items(['white rice', 150]));

    await estimateNutritionFromPhoto(gguf, 'data:image/jpeg;base64,AAAA');

    expect(photoCalls()).toBe(1);
  });

  it('reads the photo and the labels twice at high, one after another, and takes medians', async () => {
    mockGetThinkingLevel.mockResolvedValue('high');
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce(items(['white rice', 150], ['mystery stew', 200]))
      .mockResolvedValueOnce(items(['White Rice', 170], ['mystery stew', 220]))
      .mockResolvedValueOnce(stewLabel(150))
      .mockResolvedValueOnce(stewLabel(170));

    const result = await estimateNutritionFromPhoto(gguf, 'data:image/jpeg;base64,AAAA');

    expect(photoCalls()).toBe(2);
    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(4);
    // The second reading is asked warmer, so it can differ from the first.
    expect(mockSendLocalStructuredRaw.mock.calls[0][3].temperature).toBeUndefined();
    expect(mockSendLocalStructuredRaw.mock.calls[1][3].temperature).toBeGreaterThan(0);
    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients.find((i) => i.name === 'mystery stew')).toMatchObject({ grams: 210 });
    expect(ingredients.find((i) => i.name === 'mystery stew')?.kcal).toBeCloseTo(336, 0);
  });

  it('drops a food only one of three readings names at tokenmaxxing', async () => {
    mockGetThinkingLevel.mockResolvedValue('tokenmaxxing');
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce(items(['white rice', 150], ['mystery stew', 200]))
      .mockResolvedValueOnce(items(['white rice', 150]))
      .mockResolvedValueOnce(items(['white rice', 160], ['cake', 80]));

    const result = await estimateNutritionFromPhoto(gguf, 'data:image/jpeg;base64,AAAA');

    expect(photoCalls()).toBe(3);
    expect(result?.meals[0].ingredients.map((i) => i.name)).toEqual(['white rice']);
  });
});

describe('estimateNutritionFromPhoto on the downloaded engine, with several photos', () => {
  const rice = {
    id: 'food-rice',
    name: 'White rice',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
  };
  const items = (...list: [string, number][]) =>
    JSON.stringify({ items: list.map(([name, grams]) => ({ name, grams })) });
  const PHOTOS = [
    'data:image/jpeg;base64,AAAA',
    'data:image/jpeg;base64,BBBB',
    'data:image/jpeg;base64,CCCC',
  ];

  beforeEach(() => {
    mockSearchFoods.mockImplementation(async (term: string) =>
      term === 'rice' || term === 'white' ? [rice] : []
    );
  });

  it('reads each photo on its own, with one image per request', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue(items(['white rice', 150]));

    await estimateNutritionFromPhoto(gguf, PHOTOS);

    expect(mockSendLocalStructuredRaw).toHaveBeenCalledTimes(3);
    expect(mockSendLocalStructuredRaw.mock.calls.map(([, , , options]) => options.image)).toEqual(
      PHOTOS
    );
  });

  it('merges foods across photos: the same food is one ingredient at the larger grams', async () => {
    mockSendLocalStructuredRaw
      .mockResolvedValueOnce(items(['white rice', 150], ['mystery stew', 200]))
      .mockResolvedValueOnce(items(['White Rice', 220]))
      .mockResolvedValueOnce(items(['mystery stew', 100]))
      .mockResolvedValue(
        JSON.stringify({
          foods: [{ name: 'mystery stew', kcal: 150, protein: 10, carbs: 10, fat: 7.5 }],
        })
      );

    const result = await estimateNutritionFromPhoto(gguf, PHOTOS);

    const ingredients = result?.meals[0].ingredients ?? [];
    expect(ingredients).toHaveLength(2);
    expect(ingredients.find((i) => /rice/i.test(i.name))).toMatchObject({ grams: 220 });
    expect(ingredients.find((i) => i.name === 'mystery stew')).toMatchObject({ grams: 200 });
  });

  it('reports identifying 1..3 of 3, and nothing for a single photo', async () => {
    mockSendLocalStructuredRaw.mockResolvedValue(items(['white rice', 150]));
    const onProgress = jest.fn();

    await estimateNutritionFromPhoto(gguf, PHOTOS, undefined, onProgress);

    const identifying = onProgress.mock.calls
      .map(([progress]) => progress)
      .filter((progress) => progress.step === 'identifying');
    expect(identifying).toEqual([
      { step: 'identifying', index: 1, count: 3 },
      { step: 'identifying', index: 2, count: 3 },
      { step: 'identifying', index: 3, count: 3 },
    ]);
    expect(onProgress).toHaveBeenCalledWith({ step: 'reading', photo: true, photoCount: 3 });

    onProgress.mockClear();
    await estimateNutritionFromPhoto(gguf, PHOTOS[0], undefined, onProgress);
    expect(onProgress.mock.calls.some(([progress]) => progress.step === 'identifying')).toBe(false);
  });

  it('survives one failing photo among several', async () => {
    mockSendLocalStructuredRaw
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(items(['white rice', 150]));

    const result = await estimateNutritionFromPhoto(gguf, PHOTOS);

    expect(result?.meals[0].ingredients.map((i) => i.name)).toEqual(['white rice']);
  });

  it('fails when every photo fails', async () => {
    mockSendLocalStructuredRaw.mockRejectedValue(new Error('boom'));

    await expect(estimateNutritionFromPhoto(gguf, PHOTOS)).rejects.toThrow('boom');
  });

  it('lets a cancel through even with several photos', async () => {
    mockSendLocalStructuredRaw.mockRejectedValue(new AiCancelledError());

    await expect(estimateNutritionFromPhoto(gguf, PHOTOS)).rejects.toBeInstanceOf(AiCancelledError);
  });
});
