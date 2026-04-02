import {
  OPENAI_ACCESS_TOKEN,
  OPENAI_ACCESS_TOKEN_EXPIRATION_DATE,
  OPENAI_REFRESH_TOKEN,
  OPENAI_OAUTH_ENABLED,
} from '../../constants/misc';
import {
  deleteOpenAIData,
  getOAuthOpenAIEnabled,
  isOpenAISignedIn,
  refreshOpenAIAccessToken,
  handleOpenAISignIn,
} from '../openAIAuth';

const mockAsyncStorageModule = require('@react-native-async-storage/async-storage');
const mockAsyncStorage = mockAsyncStorageModule.default;
const { fetch: mockFetch } = require('expo/fetch');

jest.mock('@react-native-async-storage/async-storage', () => {
  const storageData: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(storageData[key] || null)),
      setItem: jest.fn((key: string, value: string) => {
        storageData[key] = value;
        return Promise.resolve();
      }),
      multiRemove: jest.fn((keys: string[]) => {
        keys.forEach((key) => delete storageData[key]);
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid'),
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(),
}));

describe('utils/openAIAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshOpenAIAccessToken', () => {
    it('should refresh token successfully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('refresh_token_123');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access_token_123',
          expires_in: 3600,
          refresh_token: 'new_refresh_token_123',
        }),
      } as any);

      const result = await refreshOpenAIAccessToken();

      expect(result).toBe('access_token_123');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(OPENAI_ACCESS_TOKEN, 'access_token_123');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(OPENAI_REFRESH_TOKEN, 'new_refresh_token_123');
    });
  });

  describe('isOpenAISignedIn', () => {
    it('should return false when no access token exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      const result = await isOpenAISignedIn();
      expect(result).toBe(false);
    });

    it('should return true when token is valid', async () => {
      const validTime = new Date().getTime() + 3600000;
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('access_token_123')
        .mockResolvedValueOnce(validTime.toString());

      const result = await isOpenAISignedIn();
      expect(result).toBe(true);
    });
  });

  describe('handleOpenAISignIn', () => {
    it('should save tokens successfully', async () => {
      const mockAuthData = {
        access_token: 'access_token_123',
        expires_in: 3600,
        refresh_token: 'refresh_token_123',
        scope: 'scope',
        token_type: 'Bearer',
      };

      const result = await handleOpenAISignIn(mockAuthData);

      expect(result.isValid).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(OPENAI_REFRESH_TOKEN, 'refresh_token_123');
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(OPENAI_OAUTH_ENABLED, 'true');
    });
  });

  describe('deleteOpenAIData', () => {
    it('should clear all tokens', async () => {
      await deleteOpenAIData();
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        OPENAI_ACCESS_TOKEN,
        OPENAI_ACCESS_TOKEN_EXPIRATION_DATE,
        OPENAI_REFRESH_TOKEN,
        OPENAI_OAUTH_ENABLED,
      ]);
    });
  });

  describe('getOAuthOpenAIEnabled', () => {
    it('should return true when enabled', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('true');
      const result = await getOAuthOpenAIEnabled();
      expect(result).toBe(true);
    });
  });
});
