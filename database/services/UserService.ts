import { Q } from '@nozbe/watermelondb';

import { AvatarColor } from '../../types/AvatarColor';
import { AvatarIcon } from '../../types/AvatarIcon';
import { generateUUID } from '../../utils/uuid';
import { database } from '../index';
import User, { type FitnessGoal, type Gender, type LiftingExperience, UserProfileUpdate, type WeightGoal } from '../models/User';

export class UserService {
  /**
   * Get the current user (single user per device)
   */
  static async getCurrentUser(): Promise<User | null> {
    const users = await database
      .get<User>('users')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // TODO: use userId? maybe saved on AsyncStorage
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(data: UserProfileUpdate): Promise<User> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('No user found. Please initialize user profile first.');
    }

    await user.updateProfile(data);

    // Reload to get updated values

    return await database.get<User>('users').find(user.id);
  }

  /**
   * Initialize user profile if none exists
   */
  static async initializeUser(initialData: {
    fullName: string;
    dateOfBirth: number;
    gender: Gender;
    fitnessGoal: FitnessGoal;
    weightGoal?: WeightGoal;
    activityLevel: number;
    liftingExperience: LiftingExperience;
    email?: string;
    avatarIcon?: AvatarIcon;
    avatarColor?: AvatarColor;
  }): Promise<User> {
    const existingUser = await this.getCurrentUser();

    if (existingUser) {
      throw new Error('User already exists. Use updateUserProfile instead.');
    }

    const now = Date.now();
    const syncId = generateUUID(); // Generate UUID for cloud sync

    return await database.write(async () => {
      return await database.get<User>('users').create((u) => {
        u.fullName = initialData.fullName;
        u.email = initialData.email ?? '';
        u.dateOfBirth = initialData.dateOfBirth;
        u.gender = initialData.gender;
        u.fitnessGoal = initialData.fitnessGoal;
        u.weightGoal = initialData.weightGoal ?? 'maintain';
        u.activityLevel = initialData.activityLevel;
        u.liftingExperience = initialData.liftingExperience;
        u.avatarIcon = initialData.avatarIcon ?? 'person';
        u.avatarColor = initialData.avatarColor ?? 'blue';
        u.syncId = syncId;
        u.createdAt = now;
        u.updatedAt = now;
      });
    });
  }

  /**
   * Check if user profile exists
   */
  static async hasUserProfile(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  /**
   * Ensure user has a sync_id (for backward compatibility)
   * Generates sync_id if missing
   */
  static async ensureSyncId(): Promise<User> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('No user found. Please initialize user profile first.');
    }

    // If sync_id already exists, return user
    if (user.syncId) {
      return user;
    }

    // Generate and save sync_id
    const syncId = generateUUID();

    await database.write(async () => {
      await user.update((u) => {
        u.syncId = syncId;
        u.updatedAt = Date.now();
      });
    });

    // Reload to get updated values
    return await database.get<User>('users').find(user.id);
  }

  /**
   * Get user's sync_id for sync operations
   */
  static async getSyncId(): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (!user) {
      return null;
    }

    // Ensure sync_id exists (for backward compatibility)
    if (!user.syncId) {
      const updatedUser = await this.ensureSyncId();
      return updatedUser.syncId;
    }

    return user.syncId;
  }

  /**
   * Link OAuth account to existing user
   */
  static async linkOAuthAccount(
    provider: 'google' | 'apple' | string,
    accountId: string
  ): Promise<User> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('No user found. Please initialize user profile first.');
    }

    await database.write(async () => {
      await user.update((u) => {
        u.externalAccountId = accountId;
        u.externalAccountProvider = provider;
        u.updatedAt = Date.now();
      });
    });

    // Reload to get updated values
    return await database.get<User>('users').find(user.id);
  }

  /**
   * Unlink OAuth account from user
   */
  static async unlinkOAuthAccount(): Promise<User> {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('No user found. Please initialize user profile first.');
    }

    if (!user.externalAccountId) {
      return user; // Already unlinked
    }

    await database.write(async () => {
      await user.update((u) => {
        u.externalAccountId = '';
        u.externalAccountProvider = '';
        u.updatedAt = Date.now();
      });
    });

    // Reload to get updated values
    return await database.get<User>('users').find(user.id);
  }

  /**
   * Check if user has OAuth account linked
   */
  static async hasLinkedAccount(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null && user.externalAccountId !== undefined;
  }
}
