import { classifyAiOnboardingError } from '@/utils/aiOnboarding/classifyError';
import {
  HostedAlreadyProcessedError,
  HostedBudgetError,
  HostedBusyError,
  HostedRemovedError,
  HostedSubscriptionError,
  HostedUnavailableError,
} from '@/utils/coachAI';

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

describe('classifyAiOnboardingError for Musclog Premium', () => {
  it.each([
    [new HostedBudgetError(), 'hostedBudget'],
    [new HostedSubscriptionError(), 'hostedSubscription'],
    [new HostedRemovedError(), 'hostedSubscription'],
    [new HostedUnavailableError('unavailable'), 'hostedUnavailable'],
    [new HostedUnavailableError('dailyFull'), 'hostedUnavailable'],
    [new HostedBusyError(), 'hostedBusy'],
    [new HostedAlreadyProcessedError(), 'hostedBusy'],
  ])('classifies %p as %s', (error, kind) => {
    expect(classifyAiOnboardingError(error)).toBe(kind);
  });

  it('checks the hosted budget before the generic credits error', () => {
    // A HostedBudgetError is an AiCreditsError too; it must not read as the plain credits case.
    expect(classifyAiOnboardingError(new HostedBudgetError())).not.toBe('credits');
  });
});
