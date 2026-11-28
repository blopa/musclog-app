import AsyncStorage from '@react-native-async-storage/async-storage';

import { VOICE_BROWSER_NOTICE_ACCEPTED } from '@/constants/misc';
import {
  acceptBrowserVoice,
  browserVoiceBlocker,
  hasAcceptedBrowserVoice,
} from '@/utils/browserVoice';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
}

function makeNavigator(options: {
  query?: jest.Mock;
  getUserMedia?: jest.Mock;
  noPermissions?: boolean;
}) {
  const permissions = options.noPermissions ? undefined : { query: options.query ?? jest.fn() };
  return {
    permissions,
    mediaDevices: { getUserMedia: options.getUserMedia ?? jest.fn() },
  };
}

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('browserVoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  describe('acceptance', () => {
    it('stores the acceptance and reads it back as true', async () => {
      await acceptBrowserVoice();
      expect(storage.setItem).toHaveBeenCalledWith(VOICE_BROWSER_NOTICE_ACCEPTED, 'true');

      storage.getItem.mockResolvedValue('true');
      await expect(hasAcceptedBrowserVoice()).resolves.toBe(true);
    });

    it('reads anything but true as not accepted', async () => {
      storage.getItem.mockResolvedValue('false');
      await expect(hasAcceptedBrowserVoice()).resolves.toBe(false);
    });
  });

  describe('browserVoiceBlocker', () => {
    it('returns browserNotice without touching permissions or the microphone when not accepted', async () => {
      const query = jest.fn();
      const getUserMedia = jest.fn();
      setNavigator(makeNavigator({ query, getUserMedia }));

      await expect(browserVoiceBlocker()).resolves.toEqual({
        kind: 'failure',
        failure: 'browserNotice',
      });
      expect(query).not.toHaveBeenCalled();
      expect(getUserMedia).not.toHaveBeenCalled();
    });

    it('returns a permission failure when the microphone is denied', async () => {
      storage.getItem.mockResolvedValue('true');
      setNavigator(makeNavigator({ query: jest.fn().mockResolvedValue({ state: 'denied' }) }));

      await expect(browserVoiceBlocker()).resolves.toEqual({
        kind: 'failure',
        failure: 'permission',
      });
    });

    it('returns null when the microphone is granted', async () => {
      storage.getItem.mockResolvedValue('true');
      const getUserMedia = jest.fn();
      setNavigator(
        makeNavigator({
          query: jest.fn().mockResolvedValue({ state: 'granted' }),
          getUserMedia,
        })
      );

      await expect(browserVoiceBlocker()).resolves.toBeNull();
      expect(getUserMedia).not.toHaveBeenCalled();
    });

    it('returns null when the permission query throws', async () => {
      storage.getItem.mockResolvedValue('true');
      setNavigator(makeNavigator({ query: jest.fn().mockRejectedValue(new Error('unsupported')) }));

      await expect(browserVoiceBlocker()).resolves.toBeNull();
    });

    it('returns null when the browser has no permissions API', async () => {
      storage.getItem.mockResolvedValue('true');
      setNavigator(makeNavigator({ noPermissions: true }));

      await expect(browserVoiceBlocker()).resolves.toBeNull();
    });

    it('treats an undecided microphone as a tooShort hold after a successful prompt and stops every track', async () => {
      storage.getItem.mockResolvedValue('true');
      const stop = jest.fn();
      const getUserMedia = jest.fn().mockResolvedValue({
        getTracks: () => [{ stop }, { stop }],
      });
      setNavigator(
        makeNavigator({
          query: jest.fn().mockResolvedValue({ state: 'prompt' }),
          getUserMedia,
        })
      );

      await expect(browserVoiceBlocker()).resolves.toEqual({ kind: 'tooShort' });
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(stop).toHaveBeenCalledTimes(2);
    });

    it('returns a permission failure when the prompt is refused', async () => {
      storage.getItem.mockResolvedValue('true');
      setNavigator(
        makeNavigator({
          query: jest.fn().mockResolvedValue({ state: 'prompt' }),
          getUserMedia: jest.fn().mockRejectedValue(namedError('NotAllowedError')),
        })
      );

      await expect(browserVoiceBlocker()).resolves.toEqual({
        kind: 'failure',
        failure: 'permission',
      });
    });

    it('returns an unavailable failure when there is no microphone', async () => {
      storage.getItem.mockResolvedValue('true');
      setNavigator(
        makeNavigator({
          query: jest.fn().mockResolvedValue({ state: 'prompt' }),
          getUserMedia: jest.fn().mockRejectedValue(namedError('NotFoundError')),
        })
      );

      await expect(browserVoiceBlocker()).resolves.toEqual({
        kind: 'failure',
        failure: 'unavailable',
      });
    });
  });
});
