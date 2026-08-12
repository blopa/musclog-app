export type WorkoutSetCompletionState = {
  difficultyLevel?: number | null;
  isSkipped?: boolean | null;
};

/** Used when a completed/imported set has no user-entered effort rating. */
export const DEFAULT_LOGGED_DIFFICULTY_LEVEL = 5;

/** Positive difficulty distinguishes performed/imported history from live template placeholders. */
export function isLoggedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return (set.difficultyLevel ?? 0) > 0 && !set.isSkipped;
}

export function markUnloggedWorkoutSetsSkipped<T extends WorkoutSetCompletionState>(
  sets: T[]
): T[] {
  return sets.map((set) =>
    isLoggedWorkoutSet(set) || set.isSkipped ? set : { ...set, isSkipped: true }
  );
}
