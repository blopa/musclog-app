/* eslint-disable @typescript-eslint/no-require-imports */
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
} from '../../constants/misc';
import {
  getOnboardingStatus,
  getOnboardingVersion,
  isOnboardingCompleted,
  resetOnboarding,
  setOnboardingCompleted,
} from '../onboardingService';

const mockAsyncStorageModule = require('@react-native-async-storage/async-storage');
const mockAsyncStorage = mockAsyncStorageModule.default;

jest.mock('@react-native-async-storage/async-storage', () => {
  const storageData: Record<string, string> = {};

  const getItem = jest.fn((key: string) => Promise.resolve(storageData[key] || null));
  const setItem = jest.fn((key: string, value: string) => {
    storageData[key] = value;
    return Promise.resolve();
  });
  const removeItem = jest.fn((key: string) => {
    delete storageData[key];
    return Promise.resolve();
  });
  const multiGet = jest.fn((keys: string[]) =>
    Promise.resolve(keys.map((key) => [key, storageData[key] || null]))
  );
  const multiSet = jest.fn((pairs: [string, string][]) => {
    pairs.forEach(([key, value]) => {
      storageData[key] = value;
    });
    return Promise.resolve();
  });
  const multiRemove = jest.fn((keys: string[]) => {
    keys.forEach((key) => {
      delete storageData[key];
    });
    return Promise.resolve();
  });
  const clear = jest.fn(() => {
    Object.keys(storageData).forEach((key) => {
      delete storageData[key];
    });
    return Promise.resolve();
  });
  const getAllKeys = jest.fn(() => Promise.resolve(Object.keys(storageData)));

  const AsyncStorage = {
    getItem,
    setItem,
    removeItem,
    multiGet,
    multiSet,
    multiRemove,
    clear,
    getAllKeys,
  };

  return {
    __esModule: true,
    default: AsyncStorage,
  };
});

describe('utils/onboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (mockAsyncStorage) {
      if (typeof mockAsyncStorage.getItem === 'function') {
        mockAsyncStorage.getItem.mockResolvedValue(null);
      }
      if (typeof mockAsyncStorage.setItem === 'function') {
        mockAsyncStorage.setItem.mockResolvedValue();
      }
      if (typeof mockAsyncStorage.multiGet === 'function') {
        mockAsyncStorage.multiGet.mockResolvedValue([
          [ONBOARDING_COMPLETED, null],
          [ONBOARDING_VERSION, null],
        ]);
      }
      if (typeof mockAsyncStorage.multiSet === 'function') {
        mockAsyncStorage.multiSet.mockResolvedValue();
      }
      if (typeof mockAsyncStorage.multiRemove === 'function') {
        mockAsyncStorage.multiRemove.mockResolvedValue();
      }
    }
  });

  describe('getOnboardingStatus', () => {
    it('should return completed true and version when both are set', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [ONBOARDING_COMPLETED, 'true'],
        [ONBOARDING_VERSION, '1.0.0'],
      ]);

      const result = await getOnboardingStatus();

      expect(result).toEqual({
        completed: true,
        version: '1.0.0',
      });
      expect(mockAsyncStorage.multiGet).toHaveBeenCalledWith([
        ONBOARDING_COMPLETED,
        ONBOARDING_VERSION,
      ]);
    });

    it('should return completed false when not set', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [ONBOARDING_COMPLETED, null],
        [ONBOARDING_VERSION, '1.0.0'],
      ]);

      const result = await getOnboardingStatus();

      expect(result).toEqual({
        completed: false,
        version: '1.0.0',
      });
    });

    it('should return completed false when value is not "true"', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [ONBOARDING_COMPLETED, 'false'],
        [ONBOARDING_VERSION, '1.0.0'],
      ]);

      const result = await getOnboardingStatus();

      expect(result).toEqual({
        completed: false,
        version: '1.0.0',
      });
    });

    it('should return version null when not set', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [ONBOARDING_COMPLETED, 'true'],
        [ONBOARDING_VERSION, null],
      ]);

      const result = await getOnboardingStatus();

      expect(result).toEqual({
        completed: true,
        version: null,
      });
    });

    it('should return both false and null when nothing is set', async () => {
      mockAsyncStorage.multiGet.mockResolvedValue([
        [ONBOARDING_COMPLETED, null],
        [ONBOARDING_VERSION, null],
      ]);

      const result = await getOnboardingStatus();

      expect(result).toEqual({
        completed: false,
        version: null,
      });
    });
  });

  describe('isOnboardingCompleted', () => {
    it('should return true when value is "true"', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');

      const result = await isOnboardingCompleted();

      expect(result).toBe(true);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(ONBOARDING_COMPLETED);
    });

    it('should return false when value is null', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await isOnboardingCompleted();

      expect(result).toBe(false);
    });

    it('should return false when value is "false"', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('false');

      const result = await isOnboardingCompleted();

      expect(result).toBe(false);
    });

    it('should return false when value is empty string', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('');

      const result = await isOnboardingCompleted();

      expect(result).toBe(false);
    });

    it('should return false when value is any other string', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('yes');

      const result = await isOnboardingCompleted();

      expect(result).toBe(false);
    });
  });

  describe('getOnboardingVersion', () => {
    it('should return version when set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('1.0.0');

      const result = await getOnboardingVersion();

      expect(result).toBe('1.0.0');
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(ONBOARDING_VERSION);
    });

    it('should return null when not set', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getOnboardingVersion();

      expect(result).toBeNull();
    });

    it('should return empty string when set to empty string', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('');

      const result = await getOnboardingVersion();

      expect(result).toBe('');
    });
  });

  describe('setOnboardingCompleted', () => {
    it('should set onboarding as completed with default version', async () => {
      await setOnboardingCompleted();

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith([
        [ONBOARDING_COMPLETED, 'true'],
        [ONBOARDING_VERSION, CURRENT_ONBOARDING_VERSION],
      ]);
    });

    it('should set onboarding as completed with custom version', async () => {
      const customVersion = '2.0.0';
      await setOnboardingCompleted(customVersion);

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith([
        [ONBOARDING_COMPLETED, 'true'],
        [ONBOARDING_VERSION, customVersion],
      ]);
    });

    it('should set both values correctly', async () => {
      const version = '1.5.0';
      await setOnboardingCompleted(version);

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledTimes(1);
      const callArgs = mockAsyncStorage.multiSet.mock.calls[0][0];
      expect(callArgs).toHaveLength(2);
      expect(callArgs[0]).toEqual([ONBOARDING_COMPLETED, 'true']);
      expect(callArgs[1]).toEqual([ONBOARDING_VERSION, version]);
    });
  });

  describe('resetOnboarding', () => {
    it('should remove both onboarding keys', async () => {
      await resetOnboarding();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(
        expect.arrayContaining([ONBOARDING_COMPLETED, ONBOARDING_VERSION])
      );
    });

    it('should call multiRemove exactly once', async () => {
      await resetOnboarding();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
    });

    it('should remove the correct keys', async () => {
      await resetOnboarding();

      const callArgs = mockAsyncStorage.multiRemove.mock.calls[0][0];
      expect(callArgs).toContain(ONBOARDING_COMPLETED);
      expect(callArgs).toContain(ONBOARDING_VERSION);
      expect(callArgs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
