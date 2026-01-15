import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class WorkoutLog extends Model {
  static table = 'workout_logs';

  @field('template_id') templateId?: string;
  @field('workout_name') workoutName!: string;
  @field('started_at') startedAt!: number;
  @field('completed_at') completedAt?: number;
  @field('total_volume') totalVolume?: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
