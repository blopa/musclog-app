import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

export type ExerciseGoalType =
  | '1rm'
  | 'consistency'
  | 'steps_per_day'
  | 'distance_per_session'
  | 'pace'
  | 'duration';

export default class ExerciseGoal extends Model {
  static table = 'exercise_goals';

  @field('exercise_id') exerciseId!: string | null;
  @field('exercise_name_snapshot') exerciseNameSnapshot!: string | null;
  @field('goal_type') goalType!: ExerciseGoalType;

  // 1RM fields
  @field('target_weight') targetWeight!: number | null;
  @field('baseline_1rm') baseline1rm!: number | null;

  // Consistency fields
  @field('target_sessions_per_week') targetSessionsPerWeek!: number | null;

  // Future cardio fields (TBA)
  @field('target_steps_per_day') targetStepsPerDay!: number | null;
  @field('target_distance_m') targetDistanceM!: number | null;
  @field('target_duration_s') targetDurationS!: number | null;
  @field('target_pace_ms_per_m') targetPaceMsPerM!: number | null;

  // Shared
  @field('target_date') targetDate!: string | null;
  @field('notes') notes!: string | null;
  @field('effective_until') effectiveUntil!: number | null;

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('deleted_at') deletedAt?: number;

  // Helper: Is this goal currently active?
  get isActive(): boolean {
    return this.effectiveUntil === null && !this.deletedAt;
  }
}
