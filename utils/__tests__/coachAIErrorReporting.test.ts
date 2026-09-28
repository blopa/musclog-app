import { trackMeal } from '../coachAI';
import { handleError } from '../handleError';

const mockSendOnDeviceStructured = jest.fn();

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: (...args: unknown[]) => mockSendOnDeviceStructured(...args),
}));

jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));

jest.mock('../handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getUseThinkingMode: jest.fn().mockResolvedValue(false),
    getSendFoundationFoodsToLlm: jest.fn().mockResolvedValue(false),
  },
}));

const mockHandleError = handleError as jest.Mock;

function statusError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

describe('coachAI error reporting', () => {
  beforeEach(() => {
    mockSendOnDeviceStructured.mockReset();
    mockHandleError.mockReset();
  });

  it('does not send a provider rate limit (429) to Sentry', async () => {
    mockSendOnDeviceStructured.mockRejectedValueOnce(statusError(429, '429 status code (no body)'));

    const result = await trackMeal({ provider: 'on-device' } as never, 'rice');

    expect(result).toBeNull();
    expect(mockHandleError).toHaveBeenCalled();
    for (const [, , options] of mockHandleError.mock.calls) {
      expect(options).toEqual({ sendToSentry: false });
    }
  });

  it('does not send an exhausted quota to Sentry', async () => {
    mockSendOnDeviceStructured.mockRejectedValueOnce(
      Object.assign(new Error('You exceeded your current quota'), {
        code: 'insufficient_quota',
      })
    );

    await trackMeal({ provider: 'on-device' } as never, 'rice');

    expect(mockHandleError).toHaveBeenCalled();
    for (const [, , options] of mockHandleError.mock.calls) {
      expect(options).toEqual({ sendToSentry: false });
    }
  });

  it('still sends a genuine failure to Sentry', async () => {
    mockSendOnDeviceStructured.mockRejectedValueOnce(statusError(500, 'internal error'));

    await trackMeal({ provider: 'on-device' } as never, 'rice');

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      'coachAI.generateStructured[trackMeal]',
      { sendToSentry: true }
    );
  });
});
