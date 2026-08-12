import {
  inferLegacyWorkoutSetCompletionStatus,
  isWorkoutSetCompletionStatus,
} from '@/utils/workoutSetCompletion';

type ImportRow = Record<string, unknown>;

/** Normalizes pre-v26 workout-set lifecycle fields before restore validation. */
export function normalizeWorkoutSetCompletionForImport(parsed: Record<string, unknown>): void {
  const workoutRows = Array.isArray(parsed.workout_logs)
    ? (parsed.workout_logs as ImportRow[])
    : [];

  const exerciseRows = Array.isArray(parsed.workout_log_exercises)
    ? (parsed.workout_log_exercises as ImportRow[])
    : [];

  const setRows = Array.isArray(parsed.workout_log_sets)
    ? (parsed.workout_log_sets as ImportRow[])
    : [];

  const workoutById = new Map(workoutRows.map((workout) => [String(workout.id), workout]));
  const workoutIdByExerciseId = new Map(
    exerciseRows.map((exercise) => [String(exercise.id), String(exercise.workout_log_id)])
  );

  const workoutsNeedingVolumeBackfill = new Set<string>();

  for (const set of setRows) {
    const workoutId = workoutIdByExerciseId.get(String(set.log_exercise_id));
    const workout = workoutId ? workoutById.get(workoutId) : undefined;
    const hasExplicitStatus = isWorkoutSetCompletionStatus(set.completion_status);
    const completionStatus = hasExplicitStatus
      ? set.completion_status
      : inferLegacyWorkoutSetCompletionStatus({
          difficultyLevel:
            typeof set.difficulty_level === 'number' ? set.difficulty_level : undefined,
          isSkipped: set.is_skipped === true || set.is_skipped === 1,
          workoutCompleted: workout?.completed_at != null,
          workoutHasTemplate: workout?.template_id != null,
        });
    set.completion_status = completionStatus;

    if (set.difficulty_level === 0) {
      set.difficulty_level = null;
    }

    if (
      !hasExplicitStatus &&
      completionStatus === 'skipped' &&
      workoutId &&
      workout?.completed_at != null
    ) {
      workoutsNeedingVolumeBackfill.add(workoutId);
    }
  }

  for (const workout of workoutRows) {
    if (workoutsNeedingVolumeBackfill.has(String(workout.id))) {
      workout.total_volume = null;
    }
  }
}
