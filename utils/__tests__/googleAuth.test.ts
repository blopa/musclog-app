/* eslint-disable @typescript-eslint/no-require-imports */
import {
  GOOGLE_ACCESS_TOKEN,
  GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
  GOOGLE_CLIENT_ID_MOBILE,
  GOOGLE_CLIENT_ID_WEB,
} from '../../constants/auth';
import { GoogleAuthService } from '../../database/services';
import {
  deleteAllData,
  getAccessToken,
  getGoogleClientId,
  type GoogleAuthData,
  handleGoogleSignIn,
  isGoogleSignedIn,
  isValidAccessToken,
  refreshAccessToken,
} from '../googleAuth';

const mockAsyncStorageModule = require('@react-native-async-storage/async-storage');
const mockAsyncStorage = mockAsyncStorageModule.default;
const { fetch: mockFetch } = require('expo/fetch');
const { Platform: mockPlatform } = require('react-native');

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

jest.mock('react-native', () => {
  const Platform = {
    OS: 'ios',
  };
  return {
    Platform,
  };
});
jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, value: any) => ({ field, value })),
    eq: jest.fn((value: any) => value),
  },
  Database: jest.fn(),
}));

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((callback: () => Promise<void>) => callback()),
  },
}));

jest.mock('../../database/services/GoogleAuthService', () => ({
  GoogleAuthService: {
    getRefreshToken: jest.fn(),
    saveRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
    setOAuthGeminiEnabled: jest.fn(),
    setAISettingsEnabled: jest.fn(),
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('../sentry', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setSentryUser: jest.fn(),
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

let mockShowSnackbarFn: jest.MockedFunction<any>;
jest.mock('../snackbarService', () => {
  mockShowSnackbarFn = jest.fn();
  return {
    __esModule: true,
    showSnackbar: mockShowSnackbarFn,
  };
});

const mockGoogleAuthService = GoogleAuthService as jest.Mocked<typeof GoogleAuthService>;
const mockIsValidAccessToken = isValidAccessToken as jest.MockedFunction<typeof isValidAccessToken>;

describe('utils/googleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    mockPlatform.OS = 'ios';

    if (mockShowSnackbarFn) {
      mockShowSnackbarFn.mockClear();
    }
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
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(GOOGLE_ACCESS_TOKEN, mockAccessToken);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
        expect.any(String)
      );
    });

    it('should delete all data and show error when no refresh token exists', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValueOnce('true').mockResolvedValueOnce(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).toHaveBeenCalled();
    });

    it('should not show error when onboarding is not completed', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(null);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).not.toHaveBeenCalled();
    });

    it('should handle invalid_grant error', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValueOnce('true').mockResolvedValueOnce(null);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }) as any,
      } as Response);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).toHaveBeenCalled();
    });

    it('should handle non-ok response', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValueOnce('true').mockResolvedValueOnce(null);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'server_error' }) as any,
      } as Response);

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockGoogleAuthService.getRefreshToken.mockResolvedValue(mockRefreshToken);
      mockGoogleAuthService.clearRefreshToken.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValueOnce('true').mockResolvedValueOnce(null);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await refreshAccessToken();

      expect(result).toBeUndefined();
      expect(mockGoogleAuthService.clearRefreshToken).toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).toHaveBeenCalled();
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
      mockAsyncStorage.getItem.mockResolvedValueOnce('true').mockResolvedValueOnce(today);

      await refreshAccessToken();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockShowSnackbarFn).not.toHaveBeenCalled();
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
      const expiredTime = new Date().getTime() - 100000;
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(expiredTime.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return false when token expires within 60 seconds', async () => {
      const expiringSoon = new Date().getTime() + 30000;
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(expiringSoon.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(false);
    });

    it('should return true when token is valid', async () => {
      const validTime = new Date().getTime() + 3600000;
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(validTime.toString());

      const result = await isGoogleSignedIn();

      expect(result).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('should return existing valid token', async () => {
      const validTime = new Date().getTime() + 3600000;
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
      await expect(handleGoogleSignIn(null)).rejects.toThrow('Google sign-in failed or cancelled.');
    });

    it('should handle empty access token', async () => {
      const authDataWithEmptyToken: GoogleAuthData = {
        ...mockAuthData,
        access_token: '',
      };
      mockIsValidAccessToken.mockResolvedValue(false);
      mockGoogleAuthService.saveRefreshToken.mockResolvedValue();

      const result = await handleGoogleSignIn(authDataWithEmptyToken);

      expect(result).toBe(false);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(GOOGLE_ACCESS_TOKEN, '');
      expect(mockGoogleAuthService.setOAuthGeminiEnabled).not.toHaveBeenCalled();
      expect(mockGoogleAuthService.setAISettingsEnabled).not.toHaveBeenCalled();
      expect(mockIsValidAccessToken).toHaveBeenCalledWith('');
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
