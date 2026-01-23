import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import WorkoutLog from './WorkoutLog';
import Exercise from './Exercise';

export default class WorkoutLogSet extends Model {
  static table = 'workout_log_sets';

  static associations = {
    workout_logs: { type: 'belongs_to' as const, key: 'workout_log_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
  };

  @field('workout_log_id') workoutLogId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('reps') reps!: number;
  @field('weight') weight!: number;
  @field('partials') partials?: number;
  @field('rest_time_after') restTimeAfter!: number;
  @field('difficulty_level') difficultyLevel!: number;
  @field('is_drop_set') isDropSet!: boolean;
  @field('set_order') setOrder!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_logs', 'workout_log_id') workoutLog!: WorkoutLog;
  @relation('exercises', 'exercise_id') exercise!: Exercise;

  // Validation helpers (validation is enforced in WorkoutLog.updateSet())
  get isValidDifficultyLevel(): boolean {
    return this.difficultyLevel >= 1 && this.difficultyLevel <= 10;
  }

  get isValidReps(): boolean {
    return this.reps > 0;
  }

  get isValidWeight(): boolean {
    return this.weight > 0;
  }

  get volume(): number {
    return this.reps * this.weight;
  }
}
