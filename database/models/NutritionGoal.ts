import { Model, Query } from '@nozbe/watermelondb';
import { children, field } from '@nozbe/watermelondb/decorators';

import type NutritionCheckin from './NutritionCheckin';

export type EatingPhase = 'cut' | 'maintain' | 'bulk';

export default class NutritionGoal extends Model {
  static table = 'nutrition_goals';

  static associations = {
    nutrition_checkins: { type: 'has_many' as const, foreignKey: 'nutrition_goal_id' },
  };

  @field('total_calories') totalCalories!: number;
  @field('protein') protein!: number;
  @field('carbs') carbs!: number;
  @field('fats') fats!: number;
  @field('fiber') fiber!: number;
  @field('eating_phase') eatingPhase!: EatingPhase;
  @field('target_weight') targetWeight!: number;
  @field('target_body_fat') targetBodyFat?: number | null;
  @field('target_bmi') targetBmi?: number | null;
  @field('target_ffmi') targetFfmi?: number | null;
  @field('target_date') targetDate?: number | null;
  @field('effective_until') effectiveUntil?: number | null;
  @field('is_dynamic') isDynamic!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('nutrition_checkins') checkins!: Query<NutritionCheckin>;
}
