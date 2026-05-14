import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import NutritionGoal from './NutritionGoal';

export type CheckinStatus = 'pending' | 'ahead' | 'onTrack' | 'behind';

export default class NutritionCheckin extends Model {
  static table = 'nutrition_checkins';

  static associations = {
    nutrition_goals: { type: 'belongs_to' as const, key: 'nutrition_goal_id' },
  };

  @field('nutrition_goal_id') nutritionGoalId!: string;
  @field('checkin_date') checkinDate!: number;
  @field('target_weight') targetWeight!: number;
  @field('target_body_fat') targetBodyFat?: number | null;
  @field('target_bmi') targetBmi?: number | null;
  @field('target_ffmi') targetFfmi?: number | null;
  @field('status') status?: CheckinStatus;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('nutrition_goals', 'nutrition_goal_id') nutritionGoal!: NutritionGoal;
}
