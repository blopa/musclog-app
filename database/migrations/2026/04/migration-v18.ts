import { unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

import exercisesData from '@/data/exercisesData.json';

// NOTE: unsafeExecuteSql is silently ignored on the web (LokiJS) adapter.
// If this migration is needed on web, a JS-based fallback must be added separately.

const now = Date.now();

// Escape SQL string literals (single-quote safety for build-time JSON values).
const esc = (s: string) => s.replace(/'/g, "''");

// One UPDATE per JSON entry. After the ID-remapping steps above, each app exercise
// has id = CAST(exerciseIndex AS TEXT), so the WHERE clause is a direct match.
// Exercises with exerciseIndex beyond the current DB count are silent no-ops.
const dataUpdateSteps = exercisesData.map((ex) =>
  unsafeExecuteSql(
    `UPDATE exercises SET muscle_group = '${esc(ex.muscleGroup)}', equipment_type = '${esc(ex.equipmentType)}', mechanic_type = '${esc(ex.mechanicType)}', load_multiplier = ${ex.loadMultiplier}, order_index = ${ex.exerciseIndex - 1}, updated_at = ${now} WHERE id = '${ex.exerciseIndex}' AND source = 'app';`
  )
);

const migrationV18 = {
  toVersion: 18,
  steps: [
    // --- Phase 1: Reassign IDs to sequential integers ordered by created_at ---
    // Pre-compute the mapping from old UUID → new sequential ID ordered by created_at.
    // Using rowid as tiebreaker for exercises sharing the same created_at timestamp.
    // ROW_NUMBER() requires SQLite >= 3.25.0 (2018), available on all supported platforms.
    unsafeExecuteSql(
      "CREATE TEMP TABLE IF NOT EXISTS __exercise_seq_map AS SELECT id AS old_id, CAST(ROW_NUMBER() OVER (ORDER BY created_at ASC, rowid ASC) AS TEXT) AS new_id FROM exercises WHERE source = 'app';"
    ),
    // Update all tables referencing exercise_id BEFORE changing exercises.id.
    unsafeExecuteSql(
      'UPDATE exercise_goals SET exercise_id = (SELECT new_id FROM __exercise_seq_map WHERE old_id = exercise_goals.exercise_id) WHERE exercise_goals.exercise_id IN (SELECT old_id FROM __exercise_seq_map);'
    ),
    unsafeExecuteSql(
      'UPDATE exercise_muscles SET exercise_id = (SELECT new_id FROM __exercise_seq_map WHERE old_id = exercise_muscles.exercise_id) WHERE exercise_muscles.exercise_id IN (SELECT old_id FROM __exercise_seq_map);'
    ),
    unsafeExecuteSql(
      'UPDATE workout_template_exercises SET exercise_id = (SELECT new_id FROM __exercise_seq_map WHERE old_id = workout_template_exercises.exercise_id) WHERE workout_template_exercises.exercise_id IN (SELECT old_id FROM __exercise_seq_map);'
    ),
    unsafeExecuteSql(
      'UPDATE workout_log_exercises SET exercise_id = (SELECT new_id FROM __exercise_seq_map WHERE old_id = workout_log_exercises.exercise_id) WHERE workout_log_exercises.exercise_id IN (SELECT old_id FROM __exercise_seq_map);'
    ),
    // Now safe to update exercises.id since all references have been updated.
    unsafeExecuteSql(
      'UPDATE exercises SET id = (SELECT new_id FROM __exercise_seq_map WHERE old_id = exercises.id) WHERE exercises.id IN (SELECT old_id FROM __exercise_seq_map);'
    ),
    unsafeExecuteSql('DROP TABLE IF EXISTS __exercise_seq_map;'),

    // --- Phase 2: Sync field data from exercisesData.json ---
    // exerciseIndex in the JSON == the new sequential id assigned above.
    // Updates: muscle_group, equipment_type, mechanic_type, load_multiplier, order_index.
    ...dataUpdateSteps,
  ],
};

export default migrationV18;
