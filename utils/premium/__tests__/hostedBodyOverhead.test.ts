import commonFoods from '@/data/common_foundation_foods.json';
import usdaFoods from '@/data/usda_foundation_foods.json';
import { FoodService } from '@/database/services/FoodService';
import { type CoachAIConfig } from '@/utils/coachAI';
import { extractRecipe } from '@/utils/coachMealSteps';
import { MAX_MEAL_IMAGES } from '@/utils/mealImages';
import { formatMealObservation, type MealObservation } from '@/utils/mealObservation';
import { formatMealPhotoContext } from '@/utils/mealPhotoContext';
import {
  HOSTED_BODY_OVERHEAD_BYTES,
  HOSTED_CUSTOM_PROMPT_ALLOWANCE_BYTES,
} from '@/utils/premium/hostedImagePlan';
import { getMultiPhotoMealNote } from '@/utils/prompts';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI() {
    return { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);

  return { __esModule: true, default: Mock };
});
jest.mock('@/utils/onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('@/utils/gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { getActivePrompts: jest.fn(async () => []) },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => 'off'),
    getSendFoundationFoodsToLlm: jest.fn(async () => true),
    getNutritionDisplay: jest.fn(async () => '11101'),
  },
}));
jest.mock('@/database/services/FoodService', () => ({
  FoodService: { getFoundationFoodsSorted: jest.fn() },
}));

const hosted: CoachAIConfig = {
  provider: 'hosted',
  model: 'h',
  apiKey: 'session',
  baseUrl: 'https://worker.example/v1',
  language: 'en-US',
};

// A long first look: the most items the parser keeps, each at its length caps.
const text = (n: number) => 'x'.repeat(n);
const LONG_OBSERVATION: MealObservation = {
  mealCount: 3,
  scene: text(300),
  setting: text(120),
  container: text(120),
  containerSize: text(120),
  items: Array.from({ length: 20 }, () => ({
    name: text(120),
    portion: text(120),
    preparation: text(120),
    confidence: 'medium' as const,
  })),
  scaleCues: Array.from({ length: 10 }, () => text(120)),
  addedFats: Array.from({ length: 10 }, () => text(120)),
  extras: Array.from({ length: 10 }, () => text(120)),
  uncertain: Array.from({ length: 10 }, () => text(120)),
};

describe('hosted request body overhead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The same foods the seeder stores, as the prompt builder reads them (id + name).
    const rows = [...(usdaFoods as any[]), ...(commonFoods as any[])];
    (FoodService.getFoundationFoodsSorted as jest.Mock).mockResolvedValue(
      rows.map((row) => ({ id: String(row.external_id), name: row.name }))
    );
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '{"meals":[]}' } }] });
  });

  it('fits the largest non-photo part of a five-photo request inside the overhead', async () => {
    const context = formatMealPhotoContext({
      name: text(80),
      description: text(400),
      tags: Array.from({ length: 10 }, () => text(30)),
      origin: 'restaurant',
      addedFat: 'lots',
    });
    const userMessage = `${getMultiPhotoMealNote(MAX_MEAL_IMAGES)}\n${context}`;
    const images = Array.from({ length: MAX_MEAL_IMAGES }, () => ({
      base64: '',
      mimeType: 'image/jpeg',
    }));

    await extractRecipe(hosted, userMessage, images, LONG_OBSERVATION);

    expect(formatMealObservation(LONG_OBSERVATION).length).toBeGreaterThan(1000);
    const body = mockCreate.mock.calls[0][0];
    const measured = new TextEncoder().encode(JSON.stringify(body)).length;

    // eslint-disable-next-line no-console
    console.info(`[hostedBodyOverhead] measured non-photo bytes: ${measured}`);
    expect(measured + HOSTED_CUSTOM_PROMPT_ALLOWANCE_BYTES).toBeLessThanOrEqual(
      HOSTED_BODY_OVERHEAD_BYTES
    );
  });
});
