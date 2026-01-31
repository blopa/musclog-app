import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

import { AvatarColor } from '../../types/AvatarColor';
import { AvatarIcon } from '../../types/AvatarIcon';

export type Gender = 'male' | 'female' | 'other';
export type LiftingExperience = 'beginner' | 'intermediate' | 'advanced';

export interface UserProfileUpdate {
  fullName?: string;
  email?: string | null;
  dateOfBirth?: number;
  gender?: Gender;
  fitnessGoal?: string;
  activityLevel?: number;
  liftingExperience?: LiftingExperience;
  avatarIcon?: AvatarIcon | null;
  avatarColor?: AvatarColor | null;
  externalAccountId?: string | null;
  externalAccountProvider?: string | null;
}

export default class User extends Model {
  static table = 'users';

  @field('full_name') fullName!: string;
  @field('email') email?: string;
  @field('date_of_birth') dateOfBirth!: number;
  @field('gender') gender!: Gender;
  @field('fitness_goal') fitnessGoal!: string;
  @field('activity_level') activityLevel!: number;
  @field('lifting_experience') liftingExperience!: LiftingExperience;
  @field('avatar_icon') avatarIcon?: AvatarIcon;
  @field('avatar_color') avatarColor?: AvatarColor;
  @field('sync_id') syncId!: string;
  @field('external_account_id') externalAccountId?: string;
  @field('external_account_provider') externalAccountProvider?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  /**
   * Calculate age from date of birth
   */
  getAge(): number {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Update user profile with validation
   */
  @writer
  async updateProfile(data: UserProfileUpdate): Promise<void> {
    await this.update((user) => {
      if (data.fullName !== undefined) user.fullName = data.fullName;
      if (data.email !== undefined) user.email = data.email ?? undefined;
      if (data.dateOfBirth !== undefined) user.dateOfBirth = data.dateOfBirth;
      if (data.gender !== undefined) user.gender = data.gender;
      if (data.fitnessGoal !== undefined) user.fitnessGoal = data.fitnessGoal;
      if (data.activityLevel !== undefined) {
        if (data.activityLevel < 1 || data.activityLevel > 5) {
          throw new Error('Activity level must be between 1 and 5');
        }
        user.activityLevel = data.activityLevel;
      }
      if (data.liftingExperience !== undefined) user.liftingExperience = data.liftingExperience;
      if (data.avatarIcon !== undefined) user.avatarIcon = data.avatarIcon ?? undefined;
      if (data.avatarColor !== undefined) user.avatarColor = data.avatarColor ?? undefined;
      if (data.externalAccountId !== undefined)
        user.externalAccountId = data.externalAccountId ?? undefined;
      if (data.externalAccountProvider !== undefined)
        user.externalAccountProvider = data.externalAccountProvider ?? undefined;
      user.updatedAt = Date.now();
    });
  }
}
