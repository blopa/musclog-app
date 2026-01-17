import { database } from '../index';
import User, { UserProfileUpdate } from '../models/User';
import { Q } from '@nozbe/watermelondb';

export class UserService {
  /**
   * Get the current user (single user per device)
   */
  static async getCurrentUser(): Promise<User | null> {
    const users = await database
      .get<User>('users')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

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
    gender: 'male' | 'female' | 'other';
    fitnessGoal: string;
    activityLevel: number;
    liftingExperience: 'beginner' | 'intermediate' | 'advanced';
    eatingPhase: 'cut' | 'maintain' | 'bulk';
    email?: string;
    photoUri?: string;
  }): Promise<User> {
    const existingUser = await this.getCurrentUser();

    if (existingUser) {
      throw new Error('User already exists. Use updateUserProfile instead.');
    }

    const now = Date.now();

    return await database.write(async () => {
      return await database.get<User>('users').create((u) => {
        u.fullName = initialData.fullName;
        u.email = initialData.email;
        u.dateOfBirth = initialData.dateOfBirth;
        u.gender = initialData.gender;
        u.fitnessGoal = initialData.fitnessGoal;
        u.activityLevel = initialData.activityLevel;
        u.liftingExperience = initialData.liftingExperience;
        u.photoUri = initialData.photoUri;
        u.eatingPhase = initialData.eatingPhase;
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
}
