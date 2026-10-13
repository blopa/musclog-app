import { Model } from '@nozbe/watermelondb';
import { field, writer } from '@nozbe/watermelondb/decorators';

export default class WeeklyReview extends Model {
  static table = 'weekly_reviews';
  @field('period_start') declare periodStart: number;
  @field('period_end') declare periodEnd: number;
  @field('timezone') declare timezone: string;
  @field('nutrition_goal_id') nutritionGoalId?: string;
  @field('training_reviewed_at') trainingReviewedAt?: number;
  @field('nutrition_reviewed_at') nutritionReviewedAt?: number;
  @field('nutrition_decision') nutritionDecision?: 'apply' | 'keep';
  @field('training_decision') trainingDecision?: 'progress' | 'repeat' | 'lighter';
  @field('training_json') trainingJson?: string;
  @field('recommendation_json') recommendationJson?: string;
  @field('accepted_json') acceptedJson?: string;
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
