import {
  inferLegacyWorkoutSetCompletionStatus,
  isWorkoutSetCompletionStatus,
} from '@/utils/workoutSetCompletion';

type ImportRow = Record<string, unknown>;
const WORKOUT_SET_COMPLETION_EXPORT_VERSION = 26;

function isImportRow(value: unknown): value is ImportRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function importRows(parsed: ImportRow, table: string): ImportRow[] {
  const rows = parsed[table];
  return Array.isArray(rows) ? rows.filter(isImportRow) : [];
}

/** Normalizes pre-v26 workout-set lifecycle fields before restore validation. */
export function normalizeWorkoutSetCompletionForImport(parsed: unknown): void {
  if (
    !isImportRow(parsed) ||
    typeof parsed._exportVersion !== 'number' ||
    parsed._exportVersion >= WORKOUT_SET_COMPLETION_EXPORT_VERSION
  ) {
    return;
  }

  const workoutRows = importRows(parsed, 'workout_logs');
  const exerciseRows = importRows(parsed, 'workout_log_exercises');
  const setRows = importRows(parsed, 'workout_log_sets');

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
