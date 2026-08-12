export const WORKOUT_SET_COMPLETION_STATUSES = ['planned', 'performed', 'skipped'] as const;

export type WorkoutSetCompletionStatus = (typeof WORKOUT_SET_COMPLETION_STATUSES)[number];

export type WorkoutSetCompletionState = {
  completionStatus?: WorkoutSetCompletionStatus | null;
};

export function isPerformedWorkoutSet(set: WorkoutSetCompletionState): boolean {
  return set.completionStatus === 'performed';
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
