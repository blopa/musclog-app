import { type CoachAIConfig, prepareMealImages } from '../coachAI';
import { estimateNutritionFromPhoto } from '../coachMealEstimate';
import { configureBasicGenAI } from '../gemini';

import { prepareOwnKeyImage } from '@/utils/aiImage';
import { prepareHostedImage } from '@/utils/hostedImage';

const mockCreate = jest.fn();
const mockClaudeCreate = jest.fn();
const mockThinking: { level: 'off' | 'medium' | 'high' | 'tokenmaxxing' } = { level: 'off' };

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI() {
    return { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);
  return { __esModule: true, default: Mock };
});
jest.mock('../claude', () => {
  const actual = jest.requireActual('../claude');
  return {
    ...actual,
    buildClaudeClient: jest.fn(() => ({
      messages: { create: (...args: unknown[]) => mockClaudeCreate(...args) },
    })),
  };
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
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
  prepareOwnKeyImage: jest.fn(async (base64: string) => ({
    base64: `prep-${base64}`,
    mimeType: 'image/jpeg',
  })),
}));
jest.mock('@/utils/hostedImage', () => ({
  prepareHostedImage: jest.fn(async (base64: string) => ({
    base64: `iron-${base64}`,
    mimeType: 'image/jpeg',
  })),
}));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const claude: CoachAIConfig = {
  provider: 'claude',
  model: 'claude-opus-5-5',
  apiKey: 'k',
  language: 'en-US',
};
const gemini: CoachAIConfig = { provider: 'gemini', model: 'gem', apiKey: 'k', language: 'en-US' };
const hosted: CoachAIConfig = {
  provider: 'hosted',
  model: 'h',
  apiKey: 'session',
  baseUrl: 'https://worker.example/v1',
  language: 'en-US',
};

const PHOTOS = ['data:image/jpeg;base64,AAAA', 'BBBB', 'data:image/png;base64,CCCC'];
const completion = (value: unknown) => ({
  choices: [{ message: { content: JSON.stringify(value) } }],
});
const meal = {
  meals: [
    {
      mealType: 'lunch',
      mealName: 'Plate',
      ingredients: [{ name: 'Rice', grams: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }],
    },
  ],
};

type Part = { type: string; text?: string; image_url?: { url: string } };
const lastContent = (call: number): Part[] => {
  const content = mockCreate.mock.calls[call][0].messages.at(-1).content;

  // A text-only request (a follow-up estimate) carries a plain string.
  return Array.isArray(content) ? (content as Part[]) : [{ type: 'text', text: String(content) }];
};
const imageParts = (call: number) => lastContent(call).filter((part) => part.type === 'image_url');
const textOf = (call: number) => lastContent(call).find((part) => part.type === 'text')?.text ?? '';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllMocks();
  mockThinking.level = 'off';
  mockCreate.mockResolvedValue(completion(meal));
});

afterEach(() => jest.restoreAllMocks());

describe('estimateNutritionFromPhoto with several photos', () => {
  it('sends one image_url part per photo after the text part, in order', async () => {
    await estimateNutritionFromPhoto(openai, PHOTOS);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const content = lastContent(0);
    expect(content[0].type).toBe('text');
    expect(content.slice(1).map((part) => part.type)).toEqual([
      'image_url',
      'image_url',
      'image_url',
    ]);
    expect(content.slice(1).map((part) => part.image_url?.url)).toEqual([
      'data:image/jpeg;base64,prep-AAAA',
      'data:image/jpeg;base64,prep-BBBB',
      'data:image/jpeg;base64,prep-CCCC',
    ]);
  });

  it('says "these images" and carries the multi-photo note and the formatted context', async () => {
    await estimateNutritionFromPhoto(openai, PHOTOS, {
      description: 'dinner',
      tags: [],
      name: 'Sunday plate',
      origin: 'restaurant',
      addedFat: 'lots',
    });

    const text = textOf(0);
    expect(text).toContain('these images');
    expect(text).toContain('These 3 photos show ONE meal');
    expect(text).toContain('Meal name: Sunday plate');
    expect(text).toContain('Where it');
    expect(text).toContain('restaurant');
    expect(text).toContain('Added fat (oil, butter): a lot');
  });

  it('keeps the single-photo wording for one photo', async () => {
    await estimateNutritionFromPhoto(openai, PHOTOS[0]);

    expect(textOf(0)).toContain('this image');
    expect(textOf(0)).not.toContain('photos show ONE meal');
    expect(imageParts(0)).toHaveLength(1);
  });

  it('truncates more than five photos to five', async () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    await estimateNutritionFromPhoto(openai, many);

    expect(imageParts(0)).toHaveLength(5);
    expect(prepareOwnKeyImage).toHaveBeenCalledTimes(5);
    expect(textOf(0)).toContain('These 5 photos');
  });

  it('prepares each photo once, with the photo count', async () => {
    await estimateNutritionFromPhoto(openai, PHOTOS);

    expect(prepareOwnKeyImage).toHaveBeenCalledTimes(3);
    for (const call of (prepareOwnKeyImage as jest.Mock).mock.calls) {
      expect(call[2]).toBe(3);
    }
  });

  it('does not prepare again for the extra requests of a higher thinking level', async () => {
    mockThinking.level = 'medium';
    mockCreate.mockImplementation(async () => completion(meal));

    await estimateNutritionFromPhoto(openai, PHOTOS);

    expect(mockCreate.mock.calls.length).toBeGreaterThan(1);
    expect(prepareOwnKeyImage).toHaveBeenCalledTimes(3);
    const withImages = mockCreate.mock.calls
      .map((_, index) => index)
      .filter((index) => imageParts(index).length > 0);
    expect(withImages.length).toBeGreaterThan(0);
    for (const index of withImages) {
      expect(imageParts(index).map((part) => part.image_url?.url)).toEqual([
        'data:image/jpeg;base64,prep-AAAA',
        'data:image/jpeg;base64,prep-BBBB',
        'data:image/jpeg;base64,prep-CCCC',
      ]);
    }
  });

  it('sends three image blocks before the text to Claude', async () => {
    mockClaudeCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(meal) }],
      stop_reason: 'end_turn',
    });

    await estimateNutritionFromPhoto(claude, PHOTOS);

    const params = mockClaudeCreate.mock.calls[0][0];
    const content = params.messages[0].content as { type: string; source?: { data: string } }[];
    expect(content.map((block) => block.type)).toEqual(['image', 'image', 'image', 'text']);
    expect(content.slice(0, 3).map((block) => block.source?.data)).toEqual([
      'prep-AAAA',
      'prep-BBBB',
      'prep-CCCC',
    ]);
    expect((content[3] as { text?: string }).text).toContain('these images');
  });

  it('sends three inlineData parts to Gemini', async () => {
    const generateContent = jest.fn(async () => ({}));
    (configureBasicGenAI as jest.Mock).mockResolvedValue({ generateContent });

    await estimateNutritionFromPhoto(gemini, PHOTOS);

    expect(generateContent).toHaveBeenCalledTimes(1);
    const { contents } = (generateContent.mock.calls[0] as unknown[])[0] as {
      contents: { parts: { text?: string; inlineData?: { data: string } }[] }[];
    };
    const parts = contents[0].parts;
    expect(parts[0].text).toContain('these images');
    expect(parts.filter((part) => part.inlineData).map((part) => part.inlineData?.data)).toEqual([
      'prep-AAAA',
      'prep-BBBB',
      'prep-CCCC',
    ]);
  });

  it('prepares through the hosted step with the photo count', async () => {
    await estimateNutritionFromPhoto(hosted, PHOTOS);

    expect(prepareHostedImage).toHaveBeenCalledTimes(3);
    for (const call of (prepareHostedImage as jest.Mock).mock.calls) {
      expect(call[2]).toBe(3);
    }

    expect(prepareOwnKeyImage).not.toHaveBeenCalled();
    expect(imageParts(0).map((part) => part.image_url?.url)).toEqual([
      'data:image/jpeg;base64,iron-AAAA',
      'data:image/jpeg;base64,iron-BBBB',
      'data:image/jpeg;base64,iron-CCCC',
    ]);
  });

  it('returns null without a request when every photo is blank', async () => {
    expect(await estimateNutritionFromPhoto(openai, ['', '  '])).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('prepareMealImages', () => {
  it('prepares each image once and keeps the order', async () => {
    const result = await prepareMealImages(openai, [
      { base64: 'X', mimeType: 'image/jpeg' },
      { base64: 'Y', mimeType: 'image/png' },
    ]);

    expect(result.map((image) => image.base64)).toEqual(['prep-X', 'prep-Y']);
    expect(prepareOwnKeyImage).toHaveBeenCalledTimes(2);
  });
});
