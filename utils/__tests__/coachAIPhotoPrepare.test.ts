import { type CoachAIConfig } from '../coachAI';
import { estimateNutritionFromPhoto } from '../coachMealEstimate';

import { prepareOwnKeyImage } from '@/utils/aiImage';
import { prepareHostedImage } from '@/utils/hostedImage';

jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async () => 'off'),
    getSendFoundationFoodsToLlm: jest.fn(async () => false),
  },
}));
jest.mock('@/utils/aiImage', () => ({
  prepareOwnKeyImage: jest.fn(async () => ({ base64: 'own-key-prepared', mimeType: 'image/jpeg' })),
}));
jest.mock('@/utils/hostedImage', () => ({
  prepareHostedImage: jest.fn(async () => ({ base64: 'iron-prepared', mimeType: 'image/jpeg' })),
}));
jest.mock('@/utils/prompts', () => {
  const actual = jest.requireActual('@/utils/prompts');
  return {
    ...actual,
    getActiveCustomPrompts: jest.fn(async () => []),
    getMealAnalysisPrompt: jest.fn(async () => 'SYSTEM'),
    getEstimateMacrosFunctions: jest.fn(() => ({ type: 'object', properties: {} })),
  };
});

const OPENAI: CoachAIConfig = {
  provider: 'openai',
  model: 'gpt-test',
  apiKey: 'user-key',
  baseUrl: 'https://api.example/v1',
};
const HOSTED: CoachAIConfig = {
  provider: 'hosted',
  model: 'hosted-model',
  apiKey: 'session-token',
  baseUrl: 'https://worker.example/v1',
};

function installFetch(): { bodies: string[] } {
  const bodies: string[] = [];

  global.fetch = jest.fn(async (_input: unknown, init?: RequestInit) => {
    bodies.push(String(init?.body ?? ''));

    return new Response(
      JSON.stringify({
        id: 'cmpl',
        object: 'chat.completion',
        created: 0,
        model: 'm',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{}' },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as unknown as typeof fetch;

  return { bodies };
}

describe('photo preparation per provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prepares the photo at the chosen tier for a provider the person pays for directly', async () => {
    const { bodies } = installFetch();

    await estimateNutritionFromPhoto(OPENAI, 'AAAA');

    expect(prepareOwnKeyImage).toHaveBeenCalledWith('AAAA', expect.stringMatching(/^image\//), 1);
    expect(prepareHostedImage).not.toHaveBeenCalled();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain('data:image/jpeg;base64,own-key-prepared');
    expect(bodies[0]).not.toContain('AAAA');
  });

  it('keeps Musclog Iron on its own step, which also holds the photo to the Worker limits', async () => {
    const { bodies } = installFetch();

    await estimateNutritionFromPhoto(HOSTED, 'AAAA');

    expect(prepareHostedImage).toHaveBeenCalledTimes(1);
    expect(prepareOwnKeyImage).not.toHaveBeenCalled();
    expect(bodies[0]).toContain('data:image/jpeg;base64,iron-prepared');
  });
});
