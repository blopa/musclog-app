import { Model, Query } from '@nozbe/watermelondb';
import { children, field, relation } from '@nozbe/watermelondb/decorators';

import NutritionGoal from './NutritionGoal';

export default class NutritionCheckin extends Model {
  static table = 'nutrition_checkins';

  static associations = {
    nutrition_goals: { type: 'belongs_to' as const, key: 'nutrition_goal_id' },
  };

  @field('nutrition_goal_id') nutritionGoalId!: string;
  @field('checkin_date') checkinDate!: number;
  @field('target_weight') targetWeight!: number;
  @field('target_body_fat') targetBodyFat!: number;
  @field('target_bmi') targetBmi!: number;
  @field('target_ffmi') targetFfmi!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('nutrition_goals', 'nutrition_goal_id') nutritionGoal!: NutritionGoal;
}
