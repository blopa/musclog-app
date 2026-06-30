import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type ExerciseGoalType =
  '1rm' | 'consistency' | 'steps_per_day' | 'distance_per_session' | 'pace' | 'duration';

export default class ExerciseGoal extends Model {
  static table = 'exercise_goals';

  @field('exercise_id') declare exerciseId: string | null;
  @field('exercise_name_snapshot') declare exerciseNameSnapshot: string | null;
  @field('goal_type') declare goalType: ExerciseGoalType;

  // 1RM fields
  @field('target_weight') declare targetWeight: number | null;
  @field('baseline_1rm') declare baseline1rm: number | null;

  // Consistency fields
  @field('target_sessions_per_week') declare targetSessionsPerWeek: number | null;

  // Future cardio fields (TBA)
  @field('target_steps_per_day') declare targetStepsPerDay: number | null;
  @field('target_distance_m') declare targetDistanceM: number | null;
  @field('target_duration_s') declare targetDurationS: number | null;
  @field('target_pace_ms_per_m') declare targetPaceMsPerM: number | null;

  // Shared
  @field('target_date') declare targetDate: string | null;
  @field('timezone') timezone?: string;
  @field('notes') declare notes: string | null;
  @field('effective_until') declare effectiveUntil: number | null;

  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  // Helper: Is this goal currently active?
  get isActive(): boolean {
    return this.effectiveUntil === null && !this.deletedAt;
  }
}
