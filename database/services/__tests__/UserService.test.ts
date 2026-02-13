import { generateUUID } from '../../../utils/uuid';
import { database } from '../../index';
import { UserProfileUpdate } from '../../models/User';
import { UserService } from '../UserService';
import { createMockUser } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
  },
}));

jest.mock('../../index', () => {
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

jest.mock('../../../utils/uuid', () => ({
  generateUUID: jest.fn(() => 'generated-uuid-123'),
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockGenerateUUID = generateUUID as jest.MockedFunction<typeof generateUUID>;

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should return user when exists', async () => {
      const mockUser = createMockUser();

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.getCurrentUser();

      expect(result).toBe(mockUser);
      expect(mockDatabase.get).toHaveBeenCalledWith('users');
    });

    it('should return null when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should filter out deleted users', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUser = createMockUser({
        updateProfile: jest.fn().mockResolvedValue(undefined),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({ fullName: 'Updated Name' });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      const updateData: UserProfileUpdate = {
        fullName: 'Updated Name',
        email: 'updated@example.com',
      };

      const result = await UserService.updateUserProfile(updateData);

      expect(mockUser.updateProfile).toHaveBeenCalledWith(updateData);
      expect(result).toBe(updatedUser);
    });

    it('should throw error when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const updateData: UserProfileUpdate = {
        fullName: 'Updated Name',
      };

      await expect(UserService.updateUserProfile(updateData)).rejects.toThrow(
        'No user found. Please initialize user profile first.'
      );
    });

    it('should reload user after update', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        updateProfile: jest.fn().mockResolvedValue(undefined),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const reloadedUser = createMockUser({ id: 'user-123', fullName: 'Updated' });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(reloadedUser),
        } as any);

      await UserService.updateUserProfile({ fullName: 'Updated' });

      expect(mockDatabase.get).toHaveBeenCalledWith('users');
      expect(mockDatabase.get).toHaveBeenCalledWith('users');
    });
  });

  describe('initializeUser', () => {
    const initialData = {
      fullName: 'New User',
      dateOfBirth: Date.now() - 25 * 365 * 24 * 60 * 60 * 1000,
      gender: 'male' as const,
      fitnessGoal: 'hypertrophy' as const,
      activityLevel: 3,
      liftingExperience: 'beginner' as const,
      email: 'newuser@example.com',
      photoUri: 'photo://uri',
    };

    it('should create new user successfully', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const createdUser = createMockUser(initialData);
      const mockCreate = jest.fn().mockResolvedValue(createdUser);
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      const mockWriter = {} as any;
      mockDatabase.write.mockImplementation(async (callback) => {
        return await callback(mockWriter);
      });

      await UserService.initializeUser(initialData);

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockGenerateUUID).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();

      const createCall = mockCreate.mock.calls[0][0];
      const mockUser = {} as any;
      createCall(mockUser);

      expect(mockUser.fullName).toBe(initialData.fullName);
      expect(mockUser.email).toBe(initialData.email);
      expect(mockUser.dateOfBirth).toBe(initialData.dateOfBirth);
      expect(mockUser.gender).toBe(initialData.gender);
      expect(mockUser.fitnessGoal).toBe(initialData.fitnessGoal);
      expect(mockUser.activityLevel).toBe(initialData.activityLevel);
      expect(mockUser.liftingExperience).toBe(initialData.liftingExperience);
      expect(mockUser.photoUri).toBe(initialData.photoUri);
      expect(mockUser.syncId).toBe('generated-uuid-123');
      expect(mockUser.createdAt).toBeDefined();
      expect(mockUser.updatedAt).toBeDefined();
    });

    it('should generate UUID for syncId', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockUser());
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      const mockWriter = {} as any;
      mockDatabase.write.mockImplementation(async (callback) => {
        return await callback(mockWriter);
      });

      await UserService.initializeUser(initialData);

      expect(mockGenerateUUID).toHaveBeenCalled();
    });

    it('should throw error when user already exists', async () => {
      const mockUser = createMockUser();
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await expect(UserService.initializeUser(initialData)).rejects.toThrow(
        'User already exists. Use updateUserProfile instead.'
      );
    });
  });

  describe('hasUserProfile', () => {
    it('should return true when user exists', async () => {
      const mockUser = createMockUser();
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.hasUserProfile();

      expect(result).toBe(true);
    });

    it('should return false when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.hasUserProfile();

      expect(result).toBe(false);
    });
  });

  describe('ensureSyncId', () => {
    it('should return user unchanged when syncId exists', async () => {
      const mockUser = createMockUser({
        syncId: 'existing-sync-id',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.ensureSyncId();

      expect(result).toBe(mockUser);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('should generate and set syncId when missing', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        syncId: undefined,
        update: jest.fn((callback) => {
          callback({ syncId: 'generated-uuid-123', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({ id: 'user-123', syncId: 'generated-uuid-123' });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const result = await UserService.ensureSyncId();

      expect(mockGenerateUUID).toHaveBeenCalled();
      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockUser.update).toHaveBeenCalled();
      expect(result.syncId).toBe('generated-uuid-123');
    });

    it('should throw error when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await expect(UserService.ensureSyncId()).rejects.toThrow(
        'No user found. Please initialize user profile first.'
      );
    });

    it('should reload user after update', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        syncId: undefined,
        update: jest.fn((callback) => {
          callback({ syncId: 'generated-uuid-123', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const reloadedUser = createMockUser({ id: 'user-123', syncId: 'generated-uuid-123' });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(reloadedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const result = await UserService.ensureSyncId();

      expect(mockDatabase.get).toHaveBeenCalledWith('users');
      expect(result).toBe(reloadedUser);
    });
  });

  describe('getSyncId', () => {
    it('should return syncId when exists', async () => {
      const mockUser = createMockUser({
        syncId: 'existing-sync-id',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.getSyncId();

      expect(result).toBe('existing-sync-id');
    });

    it('should generate syncId via ensureSyncId when missing', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        syncId: undefined,
        update: jest.fn((callback) => {
          callback({ syncId: 'generated-uuid-123', updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({ id: 'user-123', syncId: 'generated-uuid-123' });

      // First call: getCurrentUser() in getSyncId()
      // Second call: getCurrentUser() in ensureSyncId()
      // Third call: find() to reload user after update
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const result = await UserService.getSyncId();

      expect(mockGenerateUUID).toHaveBeenCalled();
      expect(result).toBe('generated-uuid-123');
    });

    it('should return null when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.getSyncId();

      expect(result).toBeNull();
    });
  });

  describe('linkOAuthAccount', () => {
    it('should link account successfully', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        update: jest.fn((callback) => {
          callback({
            externalAccountId: 'oauth-123',
            externalAccountProvider: 'google',
            updatedAt: Date.now(),
          });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({
        id: 'user-123',
        externalAccountId: 'oauth-123',
        externalAccountProvider: 'google',
      });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const result = await UserService.linkOAuthAccount('google', 'oauth-123');

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockUser.update).toHaveBeenCalled();
      const updateCall = mockUser.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.externalAccountId).toBe('oauth-123');
      expect(mockUpdated.externalAccountProvider).toBe('google');
      expect(result).toBe(updatedUser);
    });

    it('should throw error when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await expect(UserService.linkOAuthAccount('google', 'oauth-123')).rejects.toThrow(
        'No user found. Please initialize user profile first.'
      );
    });

    it('should reload user after update', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        update: jest.fn((callback) => {
          callback({
            externalAccountId: 'oauth-123',
            externalAccountProvider: 'google',
            updatedAt: Date.now(),
          });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const reloadedUser = createMockUser({
        id: 'user-123',
        externalAccountId: 'oauth-123',
        externalAccountProvider: 'google',
      });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(reloadedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await UserService.linkOAuthAccount('google', 'oauth-123');

      expect(mockDatabase.get).toHaveBeenCalledWith('users');
    });
  });

  describe('unlinkOAuthAccount', () => {
    it('should unlink account successfully', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        externalAccountId: 'oauth-123',
        externalAccountProvider: 'google',
        update: jest.fn((callback) => {
          callback({
            externalAccountId: undefined,
            externalAccountProvider: undefined,
            updatedAt: Date.now(),
          });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({
        id: 'user-123',
        externalAccountId: undefined,
        externalAccountProvider: undefined,
      });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      const result = await UserService.unlinkOAuthAccount();

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockUser.update).toHaveBeenCalled();
      const updateCall = mockUser.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.externalAccountId).toBeUndefined();
      expect(mockUpdated.externalAccountProvider).toBeUndefined();
      expect(result).toBe(updatedUser);
    });

    it('should return user unchanged when already unlinked', async () => {
      const mockUser = createMockUser({
        externalAccountId: undefined,
        externalAccountProvider: undefined,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.unlinkOAuthAccount();

      expect(result).toBe(mockUser);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('should throw error when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await expect(UserService.unlinkOAuthAccount()).rejects.toThrow(
        'No user found. Please initialize user profile first.'
      );
    });

    it('should clear externalAccountId and externalAccountProvider', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        externalAccountId: 'oauth-123',
        externalAccountProvider: 'google',
        update: jest.fn((callback) => {
          callback({
            externalAccountId: undefined,
            externalAccountProvider: undefined,
            updatedAt: Date.now(),
          });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      const updatedUser = createMockUser({
        id: 'user-123',
        externalAccountId: undefined,
        externalAccountProvider: undefined,
      });
      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(updatedUser),
        } as any);

      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        await callback(mockWriter);
        return Promise.resolve();
      });

      await UserService.unlinkOAuthAccount();

      const updateCall = mockUser.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.externalAccountId).toBeUndefined();
      expect(mockUpdated.externalAccountProvider).toBeUndefined();
    });
  });

  describe('hasLinkedAccount', () => {
    it('should return true when account is linked', async () => {
      const mockUser = createMockUser({
        externalAccountId: 'oauth-123',
        externalAccountProvider: 'google',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.hasLinkedAccount();

      expect(result).toBe(true);
    });

    it('should return false when no account linked', async () => {
      const mockUser = createMockUser({
        externalAccountId: undefined,
        externalAccountProvider: undefined,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockUser]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.hasLinkedAccount();

      expect(result).toBe(false);
    });

    it('should return false when no user exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await UserService.hasLinkedAccount();

      expect(result).toBe(false);
    });
  });
});
