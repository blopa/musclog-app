import {
  GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
  GOOGLE_REFRESH_TOKEN_TYPE,
} from '../../../constants/misc';
import { database } from '../../database-instance';
import { GoogleAuthService } from '../GoogleAuthService';
import { createMockSetting } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
  },
}));

jest.mock('../../database-instance', () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn().mockReturnThis(),
  };

  const mockCollection = {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    prepareCreate: jest.fn().mockReturnValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };

  const mockWriter = {} as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
      batch: jest.fn().mockResolvedValue(undefined),
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
    },
  };
});

const mockDatabase = database as jest.Mocked<typeof database>;

describe('GoogleAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRefreshToken', () => {
    it('should return token when setting exists with value', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: 'refresh_token_123',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getRefreshToken();

      expect(result).toBe('refresh_token_123');
      expect(mockDatabase.get).toHaveBeenCalledWith('settings');
      expect(mockQuery.fetch).toHaveBeenCalled();
    });

    it('should return null when no settings found', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getRefreshToken();

      expect(result).toBeNull();
    });

    it('should return null when setting exists but value is empty', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: '',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getRefreshToken();

      expect(result).toBeNull();
    });

    it('should return null when setting exists but value is null', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getRefreshToken();

      expect(result).toBeNull();
    });
  });

  describe('saveRefreshToken', () => {
    it('should create new setting when none exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.saveRefreshToken('new_refresh_token');

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();
      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall).toBeInstanceOf(Function);

      // Verify the create callback sets correct values
      const mockSetting = {} as any;
      createCall(mockSetting);
      expect(mockSetting.type).toBe(GOOGLE_REFRESH_TOKEN_TYPE);
      expect(mockSetting.value).toBe('new_refresh_token');
      expect(mockSetting.createdAt).toBeDefined();
      expect(mockSetting.updatedAt).toBeDefined();
    });

    it('should update existing setting when found', async () => {
      const now = Date.now();
      const mockSetting = createMockSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: 'old_token',
        update: jest.fn((callback) => {
          callback({ value: 'new_refresh_token', updatedAt: now });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.saveRefreshToken('new_refresh_token');

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockSetting.update).toHaveBeenCalled();
    });

    it('should set correct timestamps', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const beforeTime = Date.now();
      await GoogleAuthService.saveRefreshToken('token');
      const afterTime = Date.now();

      const createCall = mockCreate.mock.calls[0][0];
      const mockSetting = {} as any;
      createCall(mockSetting);

      expect(mockSetting.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(mockSetting.createdAt).toBeLessThanOrEqual(afterTime);
      expect(mockSetting.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(mockSetting.updatedAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('clearRefreshToken', () => {
    it('should clear value when setting exists', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_REFRESH_TOKEN_TYPE,
        value: 'token_to_clear',
        update: jest.fn((callback) => {
          callback({ value: '', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.clearRefreshToken();

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockSetting.update).toHaveBeenCalled();
      const updateCall = mockSetting.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.value).toBe('');
    });

    it('should do nothing when no setting exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await GoogleAuthService.clearRefreshToken();

      expect(mockDatabase.write).not.toHaveBeenCalled();
    });
  });

  describe('getOAuthGeminiEnabled', () => {
    it('should return true when value is "true"', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
        value: 'true',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getOAuthGeminiEnabled();

      expect(result).toBe(true);
    });

    it('should return false when value is not "true"', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
        value: 'false',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getOAuthGeminiEnabled();

      expect(result).toBe(false);
    });

    it('should return false when no setting exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await GoogleAuthService.getOAuthGeminiEnabled();

      expect(result).toBe(false);
    });
  });

  describe('setOAuthGeminiEnabled', () => {
    it('should create new setting when none exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.setOAuthGeminiEnabled(true);

      expect(mockCreate).toHaveBeenCalled();
      const createCall = mockCreate.mock.calls[0][0];
      const mockSetting = {} as any;
      createCall(mockSetting);
      expect(mockSetting.type).toBe(GOOGLE_OAUTH_GEMINI_ENABLED_TYPE);
      expect(mockSetting.value).toBe('true');
    });

    it('should update existing setting when found', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
        value: 'false',
        update: jest.fn((callback) => {
          callback({ value: 'true', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.setOAuthGeminiEnabled(true);

      expect(mockSetting.update).toHaveBeenCalled();
    });

    it('should convert boolean to string correctly', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.setOAuthGeminiEnabled(false);

      const createCall = mockCreate.mock.calls[0][0];
      const mockSetting = {} as any;
      createCall(mockSetting);
      expect(mockSetting.value).toBe('false');
    });

    it('should update existing setting with false value', async () => {
      const mockSetting = createMockSetting({
        type: GOOGLE_OAUTH_GEMINI_ENABLED_TYPE,
        value: 'true',
        update: jest.fn((callback) => {
          callback({ value: 'false', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockSetting]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await GoogleAuthService.setOAuthGeminiEnabled(false);

      expect(mockSetting.update).toHaveBeenCalled();
      const updateCall = mockSetting.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.value).toBe('false');
    });
  });

  describe('setAISettingsEnabled', () => {
    it('should handle boolean conversion correctly', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const createCall = mockCreate.mock.calls[0][0];
      const mockSetting = {} as any;
      createCall(mockSetting);
      expect(mockSetting.value).toBe('false');
    });
  });
});
