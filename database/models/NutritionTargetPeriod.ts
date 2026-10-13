import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export default class NutritionTargetPeriod extends Model {
  static table = 'nutrition_target_periods';
  @field('nutrition_goal_id') declare nutritionGoalId: string;
  @field('effective_from') declare effectiveFrom: number;
  @field('effective_until') effectiveUntil?: number;
  @field('total_calories') declare totalCalories: number;
  @field('protein') declare protein: number;
  @field('carbs') declare carbs: number;
  @field('fats') declare fats: number;
  @field('fiber') declare fiber: number;
  @field('source_review_id') sourceReviewId?: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;
  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
