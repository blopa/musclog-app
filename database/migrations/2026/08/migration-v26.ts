import { addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

// Version 26: separate set completion from effort rating.
//
// Native SQLite performs the relational backfill here. LokiJS ignores unsafe SQL, so the
// bounded, resumable WorkoutSetStatusMigration performs the same backfill on web after boot.
const migrationV26 = {
  toVersion: 26,
  steps: [
    addColumns({
      table: 'workout_log_sets',
      columns: [{ name: 'completion_status', type: 'string', isOptional: true, isIndexed: true }],
    }),
    unsafeExecuteSql(`
      UPDATE workout_log_sets
      SET completion_status = CASE
        WHEN is_skipped = 1 THEN 'skipped'
        WHEN difficulty_level > 0 THEN 'performed'
        WHEN EXISTS (
          SELECT 1
          FROM workout_log_exercises AS exercise
          JOIN workout_logs AS workout ON workout.id = exercise.workout_log_id
          WHERE exercise.id = workout_log_sets.log_exercise_id
            AND workout.completed_at IS NOT NULL
            AND workout.template_id IS NULL
        ) THEN 'performed'
        WHEN EXISTS (
          SELECT 1
          FROM workout_log_exercises AS exercise
          JOIN workout_logs AS workout ON workout.id = exercise.workout_log_id
          WHERE exercise.id = workout_log_sets.log_exercise_id
            AND workout.completed_at IS NOT NULL
            AND workout.template_id IS NOT NULL
        ) THEN 'skipped'
        ELSE 'planned'
      END
      WHERE completion_status IS NULL OR completion_status = '';
    `),
    unsafeExecuteSql(`
      UPDATE workout_logs
      SET total_volume = NULL
      WHERE completed_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM workout_log_exercises AS exercise
          JOIN workout_log_sets AS workout_set ON workout_set.log_exercise_id = exercise.id
          WHERE exercise.workout_log_id = workout_logs.id
            AND workout_set.completion_status = 'skipped'
            AND workout_set.deleted_at IS NULL
        );
    `),
    unsafeExecuteSql(
      'UPDATE workout_log_sets SET difficulty_level = NULL WHERE difficulty_level = 0;'
    ),
  ],
};

export default migrationV26;
