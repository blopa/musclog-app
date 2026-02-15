import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type UserMetricType =
  | 'weight'
  | 'body_fat'
  | 'muscle_mass'
  | 'lean_body_mass'
  | 'basal_metabolic_rate'
  | 'total_calories_burned'
  | 'active_calories_burned'
  | 'bmi'
  | 'height'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'arms'
  | 'thighs'
  | 'calves'
  | 'neck'
  | 'shoulders'
  | 'mood'
  | 'ffmi'
  | 'nutrition'
  | 'exercise'
  | 'other';

export default class UserMetric extends Model {
  static table = 'user_metrics';

  @field('type') type!: UserMetricType;
  @field('value') value!: number;
  @field('unit') unit?: string;
  @field('date') date!: number;
  @field('timezone') timezone!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
