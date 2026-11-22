import { classifyAiOnboardingError } from '@/utils/aiOnboarding/classifyError';
import { HostedAiError } from '@/utils/hostedAiError';

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

describe('classifyAiOnboardingError for Musclog Iron', () => {
  it.each([
    [new HostedAiError('budget'), 'hostedBudget'],
    [new HostedAiError('subscription'), 'hostedSubscription'],
    [new HostedAiError('removed'), 'hostedSubscription'],
    [new HostedAiError('unavailable'), 'hostedUnavailable'],
    [new HostedAiError('dailyFull'), 'hostedUnavailable'],
    [new HostedAiError('busy'), 'hostedBusy'],
    [new HostedAiError('alreadyProcessed'), 'hostedBusy'],
  ])('classifies %p as %s', (error, kind) => {
    expect(classifyAiOnboardingError(error)).toBe(kind);
  });

  it('checks the hosted budget before the generic credits error', () => {
    // A HostedBudgetError is an AiCreditsError too; it must not read as the plain credits case.
    expect(classifyAiOnboardingError(new HostedAiError('budget'))).not.toBe('credits');
  });
});
