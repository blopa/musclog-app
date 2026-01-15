import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class WorkoutLogSet extends Model {
  static table = 'workout_log_sets';

  @field('workout_log_id') workoutLogId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('reps') reps!: number;
  @field('weight') weight!: number;
  @field('rest_time') restTime!: number;
  @field('difficulty_level') difficultyLevel!: number;
  @field('is_drop_set') isDropSet!: boolean;
  @field('set_order') setOrder!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;
}
