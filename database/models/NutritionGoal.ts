import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type EatingPhase = 'cut' | 'maintain' | 'bulk';

export default class NutritionGoal extends Model {
  static table = 'nutrition_goals';

  @field('total_calories') totalCalories!: number;
  @field('protein') protein!: number;
  @field('carbs') carbs!: number;
  @field('fats') fats!: number;
  @field('fiber') fiber!: number;
  @field('eating_phase') eatingPhase!: EatingPhase;
  @field('target_weight') targetWeight!: number;
  @field('target_body_fat') targetBodyFat!: number;
  @field('target_bmi') targetBmi!: number;
  @field('target_ffmi') targetFfmi!: number;
  @field('target_date') targetDate?: number | null;
  @field('effective_until') effectiveUntil?: number | null;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
