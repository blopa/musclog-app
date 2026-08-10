import { Model, Query } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

import type NutritionCheckin from './NutritionCheckin';

export type EatingPhase = 'cut' | 'maintain' | 'bulk';

export default class NutritionGoal extends Model {
  static table = 'nutrition_goals';

  static associations = {
    nutrition_checkins: { type: 'has_many' as const, foreignKey: 'nutrition_goal_id' },
  };

  @field('total_calories') declare totalCalories: number;
  @field('protein') declare protein: number;
  @field('carbs') declare carbs: number;
  @field('fats') declare fats: number;
  @field('fiber') declare fiber: number;
  @field('eating_phase') declare eatingPhase: EatingPhase;
  @field('target_weight') declare targetWeight: number;
  @field('target_body_fat') targetBodyFat?: number | null;
  @field('target_bmi') targetBmi?: number | null;
  @field('target_ffmi') targetFfmi?: number | null;
  @field('target_date') targetDate?: number | null;
  @field('timezone') timezone?: string;
  @field('effective_until') effectiveUntil?: number | null;
  @field('is_dynamic') declare isDynamic: boolean;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('nutrition_checkins') declare checkins: Query<NutritionCheckin>;

  // Only the goal itself — its check-ins are soft-deleted separately by
  // `NutritionCheckinService.deleteByGoalId`, which the delete paths already call.
  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
