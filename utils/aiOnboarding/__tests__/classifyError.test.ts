import OpenAI from 'openai';

import { classifyAiOnboardingError } from '@/utils/aiOnboarding/classifyError';
import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '@/utils/aiErrors';
import { AiCreditsError, GatewayRateLimitError } from '@/utils/coachAI';

jest.mock('@/utils/gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('@/utils/onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));

describe('classifyAiOnboardingError', () => {
  it.each([
    [new AiCancelledError(), 'cancelled'],
    [new AiInvalidKeyError('openai'), 'invalidKey'],
    [new AiTimeoutError(), 'timeout'],
    [new GatewayRateLimitError('daily'), 'gatewayLimit'],
    [new AiCreditsError('no credit'), 'credits'],
    [Object.assign(new Error('Too Many Requests'), { status: 429 }), 'credits'],
    [new Error('You exceeded your current quota'), 'credits'],
    [new OpenAI.APIConnectionError({ message: 'offline' }), 'offline'],
    [new Error('Network request failed'), 'offline'],
    [new Error('fetch failed: ECONNRESET'), 'offline'],
    [new Error('something else'), 'unknown'],
    ['a string', 'unknown'],
    [null, 'unknown'],
  ])('classifies %p as %s', (error, kind) => {
    expect(classifyAiOnboardingError(error)).toBe(kind);
  });
});
