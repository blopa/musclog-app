import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

import NutritionGoal from './NutritionGoal';

export type CheckinStatus = 'pending' | 'ahead' | 'onTrack' | 'behind';

export default class NutritionCheckin extends Model {
  static table = 'nutrition_checkins';

  static associations = {
    nutrition_goals: { type: 'belongs_to' as const, key: 'nutrition_goal_id' },
  };

  @field('nutrition_goal_id') declare nutritionGoalId: string;
  @field('checkin_date') declare checkinDate: number;
  @field('timezone') timezone?: string;
  @field('target_weight') declare targetWeight: number;
  @field('target_body_fat') targetBodyFat?: number | null;
  @field('target_bmi') targetBmi?: number | null;
  @field('target_ffmi') targetFfmi?: number | null;
  @field('status') status?: CheckinStatus;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @relation('nutrition_goals', 'nutrition_goal_id') declare nutritionGoal: NutritionGoal;
}
