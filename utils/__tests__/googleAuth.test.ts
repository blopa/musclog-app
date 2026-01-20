import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGoogleClientId,
  refreshAccessToken,
  isGoogleSignedIn,
  getAccessToken,
  handleGoogleSignIn,
  deleteAllData,
  type GoogleAuthData,
} from '../googleAuth';
import { GoogleAuthService } from '../../database/services/GoogleAuthService';
import { isValidAccessToken } from '../gemini';
import { showSnackbar } from '../snackbarService';
import {
  GOOGLE_ACCESS_TOKEN,
  GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
  GOOGLE_CLIENT_ID_MOBILE,
  GOOGLE_CLIENT_ID_WEB,
} from '../../constants/auth';

// We'll access Platform directly from the mocked react-native module

// Create shared storage data that both mock and tests can access
const mockAsyncStorageData: Record<string, string> = {};

// Mock AsyncStorage with a proper implementation
// Create all functions directly in the factory to avoid hoisting issues
jest.mock('@react-native-async-storage/async-storage', () => {
  const storageData: Record<string, string> = {};
  
  // Create all mock functions
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

  // Return the default export with all methods
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
// Mock react-native Platform - create mutable Platform object
jest.mock('react-native', () => {
  // Create Platform object that can be modified
  const Platform = {
    OS: 'ios',
  };
  return {
    Platform,
  };
});
// Mock expo/fetch
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));
// Mock WatermelonDB before any database imports
jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, value: any) => ({ field, value })),
    eq: jest.fn((value: any) => value),
  },
  Database: jest.fn(),
}));
// Mock database instance
jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((callback: () => Promise<void>) => callback()),
  },
}));
// Mock GoogleAuthService after database mocks
jest.mock('../../database/services/GoogleAuthService', () => ({
  GoogleAuthService: {
    getRefreshToken: jest.fn(),
    saveRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    setOAuthGeminiEnabled: jest.fn(),
    setAISettingsEnabled: jest.fn(),
  },
}));
// Mock Sentry before gemini (which imports it)
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('../sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('../gemini');
jest.mock('../../lang/lang', () => {
  const mockT = jest.fn((key: string) => key);
  return {
    __esModule: true,
    default: {
      t: mockT,
    },
  };
});
jest.mock('../snackbarService', () => ({
  showSnackbar: jest.fn(),
}));

// Create mockAsyncStorage object for easier access in tests
// Access the mocked AsyncStorage to get the actual mock functions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockAsyncStorageModule = require('@react-native-async-storage/async-storage');
const mockAsyncStorage = mockAsyncStorageModule.default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fetch: mockFetch } = require('expo/fetch');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Platform: mockPlatform } = require('react-native');
const mockGoogleAuthService = GoogleAuthService as jest.Mocked<typeof GoogleAuthService>;
const mockIsValidAccessToken = isValidAccessToken as jest.MockedFunction<typeof isValidAccessToken>;
const mockShowSnackbar = showSnackbar as jest.MockedFunction<typeof showSnackbar>;

describe('utils/googleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to default implementations
    // Use the mocked AsyncStorage from the module
    if (mockAsyncStorage) {
      if (typeof mockAsyncStorage.getItem === 'function') {
        mockAsyncStorage.getItem.mockResolvedValue(null);
      }
      if (typeof mockAsyncStorage.setItem === 'function') {
        mockAsyncStorage.setItem.mockResolvedValue();
      }
      if (typeof mockAsyncStorage.multiRemove === 'function') {
        mockAsyncStorage.multiRemove.mockResolvedValue();
      }
    }
    // Reset Platform OS
    mockPlatform.OS = 'ios';
  });

  describe('getGoogleClientId', () => {
    it('should return mobile client ID for iOS', () => {
      mockPlatform.OS = 'ios';
      expect(getGoogleClientId()).toBe(GOOGLE_CLIENT_ID_MOBILE);
    });

    it('should return mobile client ID for Android', () => {
      mockPlatform.OS = 'android';
      expect(getGoogleClientId()).toBe(GOOGLE_CLIENT_ID_MOBILE);
    });

    it('should return web client ID for web platform', () => {
      mockPlatform.OS = 'web';
      expect(getGoogleClientId()).toBe(GOOGLE_CLIENT_ID_WEB);
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshToken = 'refresh_token_123';
    const mockAccessToken = 'access_token_123';
    const mockExpiresIn = 3600;

    it('should refresh token successfully', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            access_token: mockAccessToken,
            expires_in: mockExpiresIn,
            refresh_token: mockRefreshToken,
          }) as any,
      } as Response);

      const result = await refreshAccessToken();

      expect(result).toBe(mockAccessToken);
      expect(mockGoogleAuthService.getRefreshToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN,
        mockAccessToken
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
        expect.any(String)
      );
    });

    it('should delete all data and show error when no refresh token exists', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('true'); // hasCompletedOnboarding

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalled();
    });

    it('should not show error when onboarding is not completed', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue(null); // hasCompletedOnboarding is false

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });

    it('should handle invalid_grant error', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }) as any,
      } as Response);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalled();
    });

    it('should handle non-ok response', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'server_error' }) as any,
      } as Response);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('true');
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockShowSnackbar).toHaveBeenCalled();
    });

    it('should use correct client ID for refresh', async () => {
      mockPlatform.OS = 'web';
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            access_token: mockAccessToken,
            expires_in: mockExpiresIn,
          }) as any,
      } as Response);

      await refreshAccessToken();

      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1]?.body as string;
      expect(body).toContain(GOOGLE_CLIENT_ID_WEB);
    });

    it('should not show error twice on the same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('true') // hasCompletedOnboarding
        .mockResolvedValueOnce(today); // lastTimeGoogleAuthErrorWasShown

      await refreshAccessToken();

      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });
  });

  describe('isGoogleSignedIn', () => {
    it('should return false when no access token exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when no expiration time exists', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(null);

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when expiration time is invalid', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce('invalid_number');

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when token is expired', async () => {
      const expiredTime = new Date().getTime() - 100000; // 100 seconds ago
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(expiredTime.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when token expires within 60 seconds', async () => {
      const expiringSoon = new Date().getTime() + 30000; // 30 seconds from now
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(expiringSoon.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return true when token is valid', async () => {
      const validTime = new Date().getTime() + 3600000; // 1 hour from now
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(validTime.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('should return existing valid token', async () => {
      const validTime = new Date().getTime() + 3600000; // 1 hour from now
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(validTime.toString());

      const result = await getAccessToken();

      expect(result).toBe('access_token_123');
      expect(mockGoogleAuthService.getRefreshToken).not.toHaveBeenCalled();
    });

    it('should refresh token when expired', async () => {
      const expiredTime = new Date().getTime() - 100000;
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('old_access_token')
        .mockResolvedValueOnce(expiredTime.toString());
      mockGoogleAuthService.getRefreshToken.mockResolvedValue('refresh_token_123');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            access_token: 'new_access_token',
            expires_in: 3600,
          }) as any,
      } as Response);

      const result = await getAccessToken();

      expect(result).toBe('new_access_token');
      expect(mockGoogleAuthService.getRefreshToken).toHaveBeenCalled();
    });

    it('should refresh token when no token exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockGoogleAuthService.getRefreshToken.mockResolvedValue('refresh_token_123');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            access_token: 'new_access_token',
            expires_in: 3600,
          }) as any,
      } as Response);

      const result = await getAccessToken();

      expect(result).toBe('new_access_token');
    });

    it('should return undefined when refresh fails', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('true');

      const result = await getAccessToken();

      expect(result).toBeUndefined();
    });
  });

  describe('handleGoogleSignIn', () => {
    const mockAuthData: GoogleAuthData = {
      access_token: 'access_token_123',
      expires_in: 3600,
      refresh_token: 'refresh_token_123',
      scope: 'scope',
      token_type: 'Bearer',
    };

    it('should save tokens and validate access token successfully', async () => {
      mockIsValidAccessToken.mockResolvedValue(true);
      mockGoogleAuthService.saveRefreshToken.mockResolvedValue();
      mockGoogleAuthService.setOAuthGeminiEnabled.mockResolvedValue();
      mockGoogleAuthService.setAISettingsEnabled.mockResolvedValue();

      const result = await handleGoogleSignIn(mockAuthData);

      expect(result).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN,
        mockAuthData.access_token
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
        expect.any(String)
      );
      expect(mockGoogleAuthService.saveRefreshToken).toHaveBeenCalledWith(
        mockAuthData.refresh_token
      );
      expect(mockGoogleAuthService.setOAuthGeminiEnabled).toHaveBeenCalledWith(true);
      expect(mockGoogleAuthService.setAISettingsEnabled).toHaveBeenCalledWith(true);
      expect(mockIsValidAccessToken).toHaveBeenCalledWith(mockAuthData.access_token);
    });

    it('should handle sign-in without refresh token (web implicit flow)', async () => {
      const webAuthData: GoogleAuthData = {
        ...mockAuthData,
        refresh_token: '',
      };
      mockIsValidAccessToken.mockResolvedValue(true);
      mockGoogleAuthService.setOAuthGeminiEnabled.mockResolvedValue();
      mockGoogleAuthService.setAISettingsEnabled.mockResolvedValue();

      const result = await handleGoogleSignIn(webAuthData);

      expect(result).toBe(true);
      expect(mockGoogleAuthService.saveRefreshToken).not.toHaveBeenCalled();
      expect(mockGoogleAuthService.setOAuthGeminiEnabled).toHaveBeenCalledWith(true);
    });

    it('should return false when access token validation fails', async () => {
      mockIsValidAccessToken.mockResolvedValue(false);
      mockGoogleAuthService.saveRefreshToken.mockResolvedValue();
      mockGoogleAuthService.setOAuthGeminiEnabled.mockResolvedValue();
      mockGoogleAuthService.setAISettingsEnabled.mockResolvedValue();

      const result = await handleGoogleSignIn(mockAuthData);

      expect(result).toBe(false);
      expect(mockIsValidAccessToken).toHaveBeenCalledWith(mockAuthData.access_token);
    });

    it('should throw error when response is null', async () => {
      await expect(handleGoogleSignIn(null)).rejects.toThrow(
        'Google sign-in failed or cancelled.'
      );
    });

    it('should handle missing expires_in', async () => {
      const authDataWithoutExpires: GoogleAuthData = {
        ...mockAuthData,
        expires_in: undefined as any,
      };
      mockIsValidAccessToken.mockResolvedValue(true);
      mockGoogleAuthService.saveRefreshToken.mockResolvedValue();
      mockGoogleAuthService.setOAuthGeminiEnabled.mockResolvedValue();
      mockGoogleAuthService.setAISettingsEnabled.mockResolvedValue();

      const result = await handleGoogleSignIn(authDataWithoutExpires);

      expect(result).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
        expect.any(String)
      );
    });
  });

  describe('deleteAllData', () => {
    it('should clear all tokens and settings', async () => {
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockGoogleAuthService.setOAuthGeminiEnabled.mockResolvedValue();

      await deleteAllData();

      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      expect(mockGoogleAuthService.setOAuthGeminiEnabled).toHaveBeenCalledWith(false);
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        GOOGLE_ACCESS_TOKEN,
        GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
      ]);
    });
  });
});
