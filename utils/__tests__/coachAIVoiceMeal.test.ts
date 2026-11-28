import { type CoachAIConfig, logLlmDebugEvent } from '../coachAI';
import { trackMealFromVoice } from '../coachMealEstimate';

const mockTrackMealThinking = jest.fn();

jest.mock('../coachMealSampling', () => ({
  ...jest.requireActual('../coachMealSampling'),
  trackMealThinking: (...args: unknown[]) => mockTrackMealThinking(...args),
}));

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
}));

jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));

const mockLogJsonEvent = jest.fn();
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: (...args: unknown[]) => mockLogJsonEvent(...args) },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    // The stored level is Off: a voice meal must still take the verified steps.
    get: jest.fn().mockResolvedValue('off'),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(true),
    getNutritionDisplay: jest.fn().mockResolvedValue('11101'),
  },
}));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: {
    normalizeAiMealIngredients: jest.fn(async (ingredients: unknown[]) => ingredients),
  },
}));

const INGREDIENT = {
  name: 'Oats',
  grams: 80,
  kcal: 300,
  protein: 10,
  carbs: 50,
  fat: 5,
};

const MEAL = {
  meals: [{ mealType: 'breakfast', mealName: 'Porridge', ingredients: [INGREDIENT] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTrackMealThinking.mockResolvedValue(MEAL);
});

describe('trackMealFromVoice', () => {
  it.each(['gateway', 'gemini', 'openai'] as const)(
    'takes the verified steps for provider %s even when the stored thinking level is off',
    async (provider) => {
      const config = { provider } as unknown as CoachAIConfig;

      const result = await trackMealFromVoice(config, 'oats with milk');

      expect(mockTrackMealThinking).toHaveBeenCalledTimes(1);
      const [, level, text] = mockTrackMealThinking.mock.calls[0];
      expect(['medium', 'high', 'tokenmaxxing']).toContain(level);
      expect(text).toBe('oats with milk');
      expect(result).toEqual(MEAL);
    }
  );

  it('passes the progress listener through to the verified steps', async () => {
    const onProgress = jest.fn();

    await trackMealFromVoice(
      { provider: 'gateway' } as unknown as CoachAIConfig,
      'toast',
      onProgress
    );

    expect(mockTrackMealThinking.mock.calls[0][4]).toBe(onProgress);
  });
});

describe('logLlmDebugEvent with redactDump', () => {
  const payload = { messages: [{ role: 'user', content: 'my private transcript' }] };

  it('records only that the call happened when the config asks for redaction', async () => {
    await logLlmDebugEvent({
      provider: 'gemini',
      direction: 'request',
      operation: 'estimateMeal',
      payload,
      config: { provider: 'gemini', redactDump: true } as unknown as CoachAIConfig,
    });

    expect(mockLogJsonEvent).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { redacted: true } })
    );
  });

  it('redacts when the call itself asks for it, without a redacting config', async () => {
    await logLlmDebugEvent({
      provider: 'gemini',
      direction: 'request',
      operation: 'estimateMeal',
      payload,
      redact: true,
    });

    expect(mockLogJsonEvent).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { redacted: true } })
    );
  });

  it('keeps the payload when no redaction is asked for', async () => {
    await logLlmDebugEvent({
      provider: 'gemini',
      direction: 'request',
      operation: 'estimateMeal',
      payload,
      config: { provider: 'gemini' } as unknown as CoachAIConfig,
    });

    expect(mockLogJsonEvent).toHaveBeenCalledWith(expect.objectContaining({ payload }));
  });

  it('never passes the raw payload when redacting, even with an API key present', async () => {
    await logLlmDebugEvent({
      provider: 'gemini',
      direction: 'request',
      operation: 'estimateMeal',
      payload,
      config: { provider: 'gemini', redactDump: true, apiKey: 'k-1' } as unknown as CoachAIConfig,
    });

    const logged = mockLogJsonEvent.mock.calls[0][0];
    expect(JSON.stringify(logged.payload)).not.toContain('private transcript');
    expect(logged.secrets).toEqual(['k-1']);
  });
});
