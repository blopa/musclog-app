/**
 * Per-template workout insights mode (Create Workout → Intelligence).
 * Distinct from global Settings "Workout Insights" (post-workout AI toggle).
 */
export type WorkoutInsightsType = 'none' | 'algorithm' | 'ai';

export const DEFAULT_WORKOUT_INSIGHTS_TYPE: WorkoutInsightsType = 'none';

/** Coerce stored strings to a valid option; unknown values become `none`. */
export function parseWorkoutInsightsType(stored: string | undefined | null): WorkoutInsightsType {
  const v = stored ?? '';
  if (v === 'none' || v === 'algorithm' || v === 'ai') {
    return v;
  }

  return 'none';
}
