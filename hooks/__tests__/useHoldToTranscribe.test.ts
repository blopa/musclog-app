/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { Platform } from 'react-native';

import { type HoldToTranscribe, useHoldToTranscribe } from '@/hooks/useHoldToTranscribe';
import { acceptBrowserVoice, browserVoiceBlocker } from '@/utils/browserVoice';
import { handleError } from '@/utils/handleError';
import { MIN_VOICE_HOLD_MS, VOICE_FINISH_TIMEOUT_MS } from '@/utils/voiceInput';

const mockShowSnackbar = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 34 } }));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/utils/browserVoice', () => ({
  acceptBrowserVoice: jest.fn(),
  browserVoiceBlocker: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'pt-BR', language: 'pt-BR' },
  }),
}));

jest.mock('expo-speech-recognition', () => {
  const listeners: Record<string, { fn: (payload?: unknown) => void; removed: boolean }[]> = {};
  const addListener = jest.fn((name: string, fn: (payload?: unknown) => void) => {
    const entry = { fn, removed: false };
    (listeners[name] ??= []).push(entry);
    return {
      remove: () => {
        entry.removed = true;
      },
    };
  });
  const speech = {
    addListener,
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    isRecognitionAvailable: jest.fn(),
    supportsOnDeviceRecognition: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    androidTriggerOfflineModelDownload: jest.fn(),
  };
  return {
    ExpoSpeechRecognitionModule: speech,
    __emit: (name: string, payload?: unknown) => {
      (listeners[name] ?? []).filter((l) => !l.removed).forEach((l) => l.fn(payload));
    },
    __activeListenerCount: () =>
      Object.values(listeners).reduce((n, list) => n + list.filter((l) => !l.removed).length, 0),
    __resetListeners: () => {
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const speechMock = require('expo-speech-recognition') as {
  ExpoSpeechRecognitionModule: Record<string, jest.Mock>;
  __emit: (name: string, payload?: unknown) => void;
  __activeListenerCount: () => number;
  __resetListeners: () => void;
};
const speech = speechMock.ExpoSpeechRecognitionModule;
const emit = speechMock.__emit;
const handleErrorMock = handleError as jest.Mock;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

describe('useHoldToTranscribe', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    speechMock.__resetListeners();
    setOS('android');
    speech.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    speech.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    speech.isRecognitionAvailable.mockReturnValue(true);
    speech.supportsOnDeviceRecognition.mockReturnValue(true);
  });
  afterEach(() => jest.useRealTimers());

  const pressAndStart = async (hook = renderHook(() => useHoldToTranscribe())) => {
    act(() => hook.result.current.onPressIn());
    await flush();
    return hook;
  };

  it('turns a hold into text', async () => {
    const hook = await pressAndStart();
    const { result } = hook;
    expect(speech.start).toHaveBeenCalledTimes(1);
    expect(speech.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'pt-BR',
        continuous: true,
        interimResults: true,
        requiresOnDeviceRecognition: true,
      })
    );
    expect(result.current.phase).toBe('preparing');

    act(() => emit('start'));
    expect(result.current.phase).toBe('listening');

    act(() => emit('result', { isFinal: false, results: [{ transcript: 'bom' }] }));
    expect(result.current.liveText).toBe('bom');
    act(() => emit('result', { isFinal: true, results: [{ transcript: 'bom dia' }] }));
    expect(result.current.liveText).toBe('bom dia');

    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 100);
      result.current.onPressOut();
    });
    expect(speech.stop).toHaveBeenCalled();
    expect(result.current.phase).toBe('finishing');

    act(() => emit('end'));
    expect(result.current.phase).toBe('idle');
    expect(result.current.liveText).toBe('');
    expect(result.current.outcome).toEqual({ kind: 'text', text: 'bom dia' });
    expect(speechMock.__activeListenerCount()).toBe(0);

    act(() => result.current.dismissOutcome());
    expect(result.current.outcome).toBeNull();
  });

  it('asks for permission once and tells the person to hold again', async () => {
    speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await pressAndStart();
    expect(speech.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.holdHint');
    expect(speech.start).not.toHaveBeenCalled();
    expect(result.current.outcome).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('reports a refused permission', async () => {
    speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    speech.requestPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = await pressAndStart();
    expect(result.current.outcome).toEqual({ kind: 'failure', failure: 'permission' });
  });

  it('does not ask again when the system will not show the dialog', async () => {
    speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = await pressAndStart();
    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.outcome).toEqual({ kind: 'failure', failure: 'permission' });
  });

  it('needs the on-device recognizer on Android but does not ask iOS', async () => {
    speech.supportsOnDeviceRecognition.mockReturnValue(false);
    const android = await pressAndStart();
    expect(speech.start).not.toHaveBeenCalled();
    expect(android.result.current.outcome).toEqual({ kind: 'failure', failure: 'unavailable' });
    android.unmount();

    setOS('ios');
    const ios = await pressAndStart();
    expect(speech.start).toHaveBeenCalledTimes(1);
    expect(ios.result.current.phase).toBe('preparing');
  });

  it('reports unavailable recognition on both platforms', async () => {
    speech.isRecognitionAvailable.mockReturnValue(false);
    for (const os of ['android', 'ios']) {
      setOS(os);
      const hook = await pressAndStart();
      expect(hook.result.current.outcome).toEqual({ kind: 'failure', failure: 'unavailable' });
      hook.unmount();
    }

    expect(speech.start).not.toHaveBeenCalled();
  });

  it('stops only once the recognizer reported start when let go early', async () => {
    const { result } = await pressAndStart();
    expect(speech.start).toHaveBeenCalledTimes(1);

    act(() => result.current.onPressOut());
    expect(speech.stop).not.toHaveBeenCalled();

    act(() => emit('start'));
    expect(speech.stop).toHaveBeenCalledTimes(1);
  });

  it('never starts when let go while the permission check is pending', async () => {
    let resolvePermission: (value: { granted: boolean; canAskAgain: boolean }) => void = () => {};

    speech.getPermissionsAsync.mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve;
      })
    );
    const { result } = renderHook(() => useHoldToTranscribe());
    act(() => result.current.onPressIn());
    act(() => result.current.onPressOut());

    resolvePermission({ granted: true, canAskAgain: true });
    await flush();

    expect(speech.start).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.holdHint');
    expect(result.current.phase).toBe('idle');
  });

  it('names a missing language, and nothing heard after a long hold', async () => {
    const first = await pressAndStart();
    act(() => emit('start'));
    act(() => emit('error', { error: 'language-not-supported' }));
    act(() => {
      first.result.current.onPressOut();
      emit('end');
    });
    expect(first.result.current.outcome).toEqual({ kind: 'failure', failure: 'languageMissing' });
    first.unmount();
    speechMock.__resetListeners();

    const second = await pressAndStart();
    act(() => emit('start'));
    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 500);
      second.result.current.onPressOut();
    });
    act(() => emit('error', { error: 'aborted' }));
    act(() => emit('end'));
    expect(second.result.current.outcome).toEqual({ kind: 'failure', failure: 'nothingHeard' });
  });

  it('turns a quick tap that reached start into a hint', async () => {
    const { result } = await pressAndStart();
    act(() => emit('start'));
    act(() => result.current.onPressOut());
    act(() => emit('end'));
    expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.holdHint');
    expect(result.current.outcome).toBeNull();
    expect(result.current.phase).toBe('idle');
  });

  it('keeps the text heard before an error', async () => {
    const { result } = await pressAndStart();
    act(() => emit('start'));
    act(() => emit('result', { isFinal: true, results: [{ transcript: 'oi' }] }));
    act(() => emit('error', { error: 'interrupted' }));
    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 100);
      result.current.onPressOut();
    });
    act(() => emit('end'));
    expect(result.current.outcome).toEqual({ kind: 'text', text: 'oi' });
    expect(handleErrorMock).not.toHaveBeenCalled();
  });

  it('reports an unexpected failure by its code only', async () => {
    const { result } = await pressAndStart();
    act(() => emit('start'));
    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 500);
      result.current.onPressOut();
    });
    act(() => emit('error', { error: 'client' }));
    act(() => emit('end'));

    expect(result.current.outcome).toEqual({ kind: 'failure', failure: 'failed' });
    expect(handleErrorMock).toHaveBeenCalledTimes(1);
    const [error, context] = handleErrorMock.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('speech-recognition-client');
    expect(context).toBe('voiceInput.recognition');
  });

  it('closes the hold when the recognizer never ends', async () => {
    const { result } = await pressAndStart();
    act(() => emit('start'));
    act(() => emit('result', { isFinal: true, results: [{ transcript: 'ola' }] }));
    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 100);
      result.current.onPressOut();
    });
    act(() => {
      jest.advanceTimersByTime(VOICE_FINISH_TIMEOUT_MS);
    });

    expect(result.current.outcome).toEqual({ kind: 'text', text: 'ola' });
    expect(speech.abort).toHaveBeenCalled();
    expect(speechMock.__activeListenerCount()).toBe(0);
    expect(result.current.phase).toBe('idle');
  });

  it('ignores a result that arrives after the finish timeout', async () => {
    const { result } = await pressAndStart();
    act(() => emit('start'));
    act(() => emit('result', { isFinal: true, results: [{ transcript: 'ola' }] }));
    act(() => {
      jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 100);
      result.current.onPressOut();
    });
    act(() => {
      jest.advanceTimersByTime(VOICE_FINISH_TIMEOUT_MS);
    });
    act(() => emit('result', { isFinal: true, results: [{ transcript: 'tarde demais' }] }));
    act(() => emit('end'));

    expect(result.current.outcome).toEqual({ kind: 'text', text: 'ola' });
    expect(result.current.liveText).toBe('');
  });

  it('aborts on unmount and ignores later events', async () => {
    const { result, unmount } = await pressAndStart();
    act(() => emit('start'));
    unmount();

    expect(speech.abort).toHaveBeenCalled();
    expect(speechMock.__activeListenerCount()).toBe(0);
    expect(() =>
      emit('result', { isFinal: true, results: [{ transcript: 'late' }] })
    ).not.toThrow();
    expect(result.current.liveText).toBe('');
  });

  it('keeps sessions to the instance that was pressed', async () => {
    const a = renderHook(() => useHoldToTranscribe());
    const b = renderHook(() => useHoldToTranscribe());
    act(() => a.result.current.onPressIn());
    await flush();

    expect(speech.addListener).toHaveBeenCalled();
    const callsAfterA = speech.addListener.mock.calls.length;
    act(() => emit('start'));
    act(() => emit('result', { isFinal: false, results: [{ transcript: 'x' }] }));
    expect(a.result.current.liveText).toBe('x');
    expect(b.result.current.phase).toBe('idle');
    expect(b.result.current.liveText).toBe('');
    expect(speech.addListener.mock.calls.length).toBe(callsAfterA);

    act(() => a.result.current.onPressIn());
    await flush();
    expect(speech.start).toHaveBeenCalledTimes(1);
  });

  describe('onText', () => {
    /** Holds, speaks 'bom dia', lets go and ends the recognizer session. */
    const speakAndRelease = async (result: { current: HoldToTranscribe }) => {
      act(() => result.current.onPressIn());
      await flush();
      act(() => emit('start'));
      act(() => emit('result', { isFinal: true, results: [{ transcript: 'bom dia' }] }));
      act(() => {
        jest.advanceTimersByTime(MIN_VOICE_HOLD_MS + 100);
        result.current.onPressOut();
      });
      act(() => emit('end'));
    };

    it('takes the transcript when the caller returns true, with no outcome shown', async () => {
      const onText = jest.fn(() => true);
      const { result } = renderHook(() => useHoldToTranscribe({ onText }));
      await speakAndRelease(result);

      expect(onText).toHaveBeenCalledWith('bom dia');
      expect(result.current.outcome).toBeNull();
      expect(result.current.phase).toBe('idle');
    });

    it('shows the transcript when the caller returns false', async () => {
      const onText = jest.fn(() => false);
      const { result } = renderHook(() => useHoldToTranscribe({ onText }));
      await speakAndRelease(result);

      expect(onText).toHaveBeenCalledWith('bom dia');
      expect(result.current.outcome).toEqual({ kind: 'text', text: 'bom dia' });
    });

    it('never calls onText for a failure', async () => {
      speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
      const onText = jest.fn(() => true);
      const { result } = renderHook(() => useHoldToTranscribe({ onText }));
      act(() => result.current.onPressIn());
      await flush();

      expect(onText).not.toHaveBeenCalled();
      expect(result.current.outcome).toEqual({ kind: 'failure', failure: 'permission' });
    });
  });

  describe('downloadLanguage', () => {
    it('says when the model arrived or is scheduled', async () => {
      const { result } = renderHook(() => useHoldToTranscribe());
      speech.androidTriggerOfflineModelDownload.mockResolvedValueOnce({
        status: 'download_success',
      });
      await act(async () => result.current.downloadLanguage());
      expect(speech.androidTriggerOfflineModelDownload).toHaveBeenCalledWith({ locale: 'pt-BR' });
      expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.downloadDone');

      mockShowSnackbar.mockClear();
      speech.androidTriggerOfflineModelDownload.mockResolvedValueOnce({
        status: 'download_scheduled',
      });
      await act(async () => result.current.downloadLanguage());
      expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.downloadScheduled');

      mockShowSnackbar.mockClear();
      speech.androidTriggerOfflineModelDownload.mockResolvedValueOnce({ status: 'opened_dialog' });
      await act(async () => result.current.downloadLanguage());
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('reports a failed download and clears an open outcome', async () => {
      speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
      const { result } = await pressAndStart();
      expect(result.current.outcome).not.toBeNull();

      const failure = new Error('boom');
      speech.androidTriggerOfflineModelDownload.mockRejectedValueOnce(failure);
      await act(async () => result.current.downloadLanguage());

      expect(result.current.outcome).toBeNull();
      expect(handleErrorMock).toHaveBeenCalledWith(failure, 'voiceInput.downloadLanguage', {
        snackbarMessage: 'voiceInput.downloadFailed',
      });
    });
  });
});

describe('useHoldToTranscribe on the web', () => {
  const browserBlocker = browserVoiceBlocker as jest.Mock;
  const accept = acceptBrowserVoice as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    speechMock.__resetListeners();
    setOS('web');
    speech.isRecognitionAvailable.mockReturnValue(true);
    speech.supportsOnDeviceRecognition.mockReturnValue(true);
  });
  afterEach(() => {
    setOS('android');
    jest.useRealTimers();
  });

  it('ends the hold with the blocker outcome and never starts recognition', async () => {
    browserBlocker.mockResolvedValue({ kind: 'failure', failure: 'browserNotice' });
    const { result } = renderHook(() => useHoldToTranscribe());

    act(() => result.current.onPressIn());
    await flush();

    expect(result.current.outcome).toEqual({ kind: 'failure', failure: 'browserNotice' });
    expect(result.current.phase).toBe('idle');
    expect(speech.start).not.toHaveBeenCalled();
  });

  it('starts recognition without asking the native permission when the blocker is null', async () => {
    browserBlocker.mockResolvedValue(null);
    const { result } = renderHook(() => useHoldToTranscribe());

    act(() => result.current.onPressIn());
    await flush();

    expect(speech.start).toHaveBeenCalledTimes(1);
    expect(speech.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('accepts the browser notice, clears the outcome and shows the hold hint', async () => {
    browserBlocker.mockResolvedValue({ kind: 'failure', failure: 'browserNotice' });
    const { result } = renderHook(() => useHoldToTranscribe());
    act(() => result.current.onPressIn());
    await flush();
    expect(result.current.outcome).not.toBeNull();

    await act(async () => {
      await result.current.allowBrowserRecognition();
    });

    expect(accept).toHaveBeenCalledTimes(1);
    expect(result.current.outcome).toBeNull();
    expect(mockShowSnackbar).toHaveBeenCalledWith('success', 'voiceInput.holdHint');
  });

  it('does not start a session when let go while the blocker check is pending', async () => {
    let resolveBlocker: (value: null) => void = () => {};
    browserBlocker.mockReturnValue(
      new Promise((resolve) => {
        resolveBlocker = resolve;
      })
    );
    const { result } = renderHook(() => useHoldToTranscribe());

    act(() => result.current.onPressIn());
    act(() => result.current.onPressOut());

    resolveBlocker(null);
    await flush();

    expect(speech.start).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });
});
