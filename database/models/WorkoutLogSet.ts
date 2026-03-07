import { Model } from '@nozbe/watermelondb';
import { field, relation, writer } from '@nozbe/watermelondb/decorators';

import WorkoutLogExercise from './WorkoutLogExercise';

export default class WorkoutLogSet extends Model {
  static table = 'workout_log_sets';

  static associations = {
    workout_log_exercises: { type: 'belongs_to' as const, key: 'log_exercise_id' },
  };

  @field('log_exercise_id') logExerciseId!: string;
  @field('reps') reps!: number;
  @field('weight') weight!: number;
  @field('partials') partials?: number;
  @field('rest_time_after') restTimeAfter!: number;
  @field('reps_in_reserve') repsInReserve!: number;
  @field('is_skipped') isSkipped?: boolean;
  @field('difficulty_level') difficultyLevel!: number;
  @field('is_drop_set') isDropSet!: boolean;
  @field('set_order') setOrder!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_log_exercises', 'log_exercise_id') logExercise!: WorkoutLogExercise;

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

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
