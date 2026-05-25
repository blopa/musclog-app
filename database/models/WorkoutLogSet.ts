import { Model } from '@nozbe/watermelondb';
import { field, json, relation, writer } from '@nozbe/watermelondb/decorators';

import WorkoutLogExercise from './WorkoutLogExercise';

export type RepPhaseData = {
  index: number;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  phase_a_duration_ms: number;
  phase_b_duration_ms: number;
  phase_a_speed_dps: number;
  phase_b_speed_dps: number;
  classifier_confidence: number;
};

export default class WorkoutLogSet extends Model {
  static table = 'workout_log_sets';

  static associations = {
    workout_log_exercises: { type: 'belongs_to' as const, key: 'log_exercise_id' },
  };

  @field('log_exercise_id') declare logExerciseId: string;
  @field('reps') declare reps: number;
  @field('weight') declare weight: number;
  @field('partials') partials?: number;
  @field('rest_time_after') declare restTimeAfter: number;
  @field('reps_in_reserve') declare repsInReserve: number;
  @field('is_skipped') isSkipped?: boolean;
  @field('difficulty_level') declare difficultyLevel: number;
  @field('set_type') declare setType: string;
  @field('set_order') declare setOrder: number;
  @json('rep_data_json', (val) => val ?? null) declare repDataJson: RepPhaseData[] | null;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @relation('workout_log_exercises', 'log_exercise_id') declare logExercise: WorkoutLogExercise;

  get isValidDifficultyLevel(): boolean {
    if (this.isSkipped && this.difficultyLevel === 0) {
      return true;
    }
    return this.difficultyLevel >= 1 && this.difficultyLevel <= 10;
  }

  get isValidReps(): boolean {
    return this.reps > 0;
  }

  get isValidWeight(): boolean {
    return this.weight > 0;
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
