import { Model, writer } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type Gender = 'male' | 'female' | 'other';
export type LiftingExperience = 'beginner' | 'intermediate' | 'advanced';
export type Units = 'imperial' | 'metric';
export type EatingPhase = 'cut' | 'maintain' | 'bulk';

export interface UserProfileUpdate {
  fullName?: string;
  email?: string | null;
  dateOfBirth?: number;
  gender?: Gender;
  fitnessGoal?: string;
  activityLevel?: number;
  liftingExperience?: LiftingExperience;
  photoUri?: string | null;
  units?: Units;
  weight?: number | null;
  height?: number | null;
  eatingPhase?: EatingPhase;
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
  @field('photo_uri') photoUri?: string;
  @field('units') units!: Units;
  @field('weight') weight?: number;
  @field('height') height?: number;
  @field('eating_phase') eatingPhase!: EatingPhase;
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
      if (data.photoUri !== undefined) user.photoUri = data.photoUri ?? undefined;
      if (data.units !== undefined) user.units = data.units;
      if (data.weight !== undefined) user.weight = data.weight ?? undefined;
      if (data.height !== undefined) user.height = data.height ?? undefined;
      if (data.eatingPhase !== undefined) user.eatingPhase = data.eatingPhase;
      user.updatedAt = Date.now();
    });
  }
}
