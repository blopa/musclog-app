import { act, renderHook } from '@testing-library/react';

import { SettingsService } from '@/database/services/SettingsService';
import { useAiConsentGate } from '@/hooks/useAiConsentGate';
import { isCloudAiBlockedForAge } from '@/services/aiAccess';
import { recordAiConsent } from '@/services/aiConsentRecord';
import { AI_CONSENT_VERSION } from '@/utils/aiConsent';
import { handleError } from '@/utils/handleError';

const mockShowSnackbar = jest.fn();
jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn() },
}));
jest.mock('@/services/aiAccess', () => ({ isCloudAiBlockedForAge: jest.fn() }));
jest.mock('@/services/aiConsentRecord', () => ({ recordAiConsent: jest.fn(async () => {}) }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const mockGet = SettingsService.get as jest.Mock;
const mockBlocked = isCloudAiBlockedForAge as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({});
  mockBlocked.mockResolvedValue(false);
});

describe('useAiConsentGate', () => {
  it('asks before turning a provider on, then records the answer and does it', async () => {
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('openai', run));

    expect(result.current.provider).toBe('openai');
    expect(run).not.toHaveBeenCalled();

    await act(() => result.current.confirm());

    expect(run).toHaveBeenCalled();
    expect(recordAiConsent).toHaveBeenCalledWith('openai');
  });

  it('does nothing when the person says no', async () => {
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('local', run));
    act(() => result.current.cancel());

    expect(result.current.provider).toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(recordAiConsent).not.toHaveBeenCalled();
  });

  it('does not ask twice for the same wording', async () => {
    mockGet.mockResolvedValue({ gemini: { version: AI_CONSENT_VERSION, at: 1 } });
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('gemini', run));

    expect(run).toHaveBeenCalled();
    expect(result.current.provider).toBeNull();
  });

  it('refuses the free tier to someone under 18', async () => {
    mockBlocked.mockResolvedValue(true);
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('gateway', run));

    expect(result.current.provider).toBeNull();
    expect(run).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith('error', 'common.ageGate.cloudAi');
  });
});

describe('useAiConsentGate confirm order', () => {
  it('runs the action only after the consent is recorded', async () => {
    let finishRecording: () => void = () => {};
    (recordAiConsent as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishRecording = resolve))
    );
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('openai', run));
    await act(async () => {
      void result.current.confirm();
    });

    expect(result.current.provider).toBeNull();
    expect(run).not.toHaveBeenCalled();

    await act(async () => finishRecording());

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run the action when the consent could not be recorded', async () => {
    (recordAiConsent as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    const run = jest.fn();
    const { result } = renderHook(() => useAiConsentGate());

    await act(() => result.current.request('openai', run));
    await act(() => result.current.confirm());

    expect(run).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'useAiConsentGate.record');
  });
});
