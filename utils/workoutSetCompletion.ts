export type WorkoutSetCompletionState = {
  difficultyLevel?: number | null;
};

/** Used when a completed/imported set has no user-entered effort rating. */
export const DEFAULT_LOGGED_DIFFICULTY_LEVEL = 5;

/** Positive difficulty distinguishes performed/imported history from live template placeholders. */
export function isLoggedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return (set.difficultyLevel ?? 0) > 0;
}
