export const WORKOUT_SET_COMPLETION_STATUSES = ['planned', 'performed', 'skipped'] as const;

export type WorkoutSetCompletionStatus = (typeof WORKOUT_SET_COMPLETION_STATUSES)[number];

export type WorkoutSetCompletionState = {
  completionStatus?: WorkoutSetCompletionStatus | null;
};

export function isPerformedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return set.completionStatus === 'performed';
}

/** `workout_log_sets.set_type` for a set done only to prepare for the working sets. */
export const WARMUP_SET_TYPE = 'warmup';

export type WorkoutSetTypeState = {
  setType?: string | null;
};

export function isWarmupSet(set: WorkoutSetTypeState): boolean {
  return set.setType === WARMUP_SET_TYPE;
}

/**
 * A set that counts toward working-set metrics — volume, personal records, estimated 1RM,
 * progression and goal progress: performed AND not a warm-up.
 *
 * Lifecycle (`completion_status`) and kind (`set_type`) are independent axes. A performed warm-up
 * is real work — calories and Health Connect keep it, and history still shows it — but it is
 * deliberately light, so letting it into a metric drags averages down, can make a warm-up single
 * look like a PR attempt, and (in the live session) would be mistaken for the "previous set" the
 * next working set is re-targeted from. Anything that asks "how hard did they train" uses this;
 * anything that asks "what did they do" uses `isPerformedWorkoutSet`.
 */
export function isWorkingSet(set: WorkoutSetCompletionState & WorkoutSetTypeState): boolean {
  return isPerformedWorkoutSet(set) && !isWarmupSet(set);
}

export function isSkippedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return set.completionStatus === 'skipped';
}

export function isResolvedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return set.completionStatus === 'performed' || set.completionStatus === 'skipped';
}

export function isPlannedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return set.completionStatus === 'planned';
}

export function isWorkoutSetCompletionStatus(value: unknown): value is WorkoutSetCompletionStatus {
  return WORKOUT_SET_COMPLETION_STATUSES.includes(value as WorkoutSetCompletionStatus);
}

export function isValidWorkoutSetDifficultyLevel(value: number | null | undefined): boolean {
  return value == null || (Number.isFinite(value) && value >= 1 && value <= 10);
}

export function assertValidWorkoutSetDifficultyLevel(value: number | null | undefined): void {
  if (!isValidWorkoutSetDifficultyLevel(value)) {
    throw new Error('Difficulty level must be between 1 and 10');
  }
}

type LegacyWorkoutSetCompletionInput = {
  difficultyLevel?: number | null;
  isSkipped?: boolean | null;
  workoutCompleted: boolean;
  workoutHasTemplate: boolean;
};

/** Converts pre-v26 rows at migration/import boundaries; runtime consumers never guess status. */
export function inferLegacyWorkoutSetCompletionStatus({
  difficultyLevel,
  isSkipped,
  workoutCompleted,
  workoutHasTemplate,
}: LegacyWorkoutSetCompletionInput): WorkoutSetCompletionStatus {
  if (isSkipped) {
    return 'skipped';
  }

  if ((difficultyLevel ?? 0) > 0) {
    return 'performed';
  }

  if (!workoutCompleted) {
    return 'planned';
  }

  return workoutHasTemplate ? 'skipped' : 'performed';
}
