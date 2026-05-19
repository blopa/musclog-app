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

// Rebuild exercise_muscles from the JSON's targetMuscles arrays.
// muscle_id is resolved by name via subquery — if the muscles catalogue hasn't been
// seeded yet (fresh install migration order), the SELECT returns nothing and the
// INSERT is a no-op. backfillExerciseMuscles() handles that case during app seeding.
const exerciseMuscleSteps = [
  // Wipe existing app exercise links; Phase 1 updated exercise_id references but we
  // do a full rebuild from the canonical JSON for a clean slate.
  unsafeExecuteSql(
    "DELETE FROM exercise_muscles WHERE exercise_id IN (SELECT id FROM exercises WHERE source = 'app');"
  ),
  ...exercisesData.flatMap((ex) =>
    (ex.targetMuscles ?? []).map((muscleName) =>
      unsafeExecuteSql(
        `INSERT INTO exercise_muscles (id, exercise_id, muscle_id, role, created_at, updated_at, _status, _changed) SELECT lower(hex(randomblob(16))), '${ex.exerciseIndex}', id, 'primary', ${now}, ${now}, 'created', '' FROM muscles WHERE name = '${esc(muscleName)}' AND deleted_at IS NULL;`
      )
    )
  ),
];

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

    // --- Phase 3: Rebuild exercise_muscles pivot from exercisesData.json targetMuscles ---
    ...exerciseMuscleSteps,

    // --- Phase 4: Update image URLs to musclog.app website ---
    // After Phase 1 all app exercises have sequential integer IDs, so the URL is deterministic.
    unsafeExecuteSql(
      "UPDATE exercises SET image_url = 'http://musclog.app/images/exercises/' || id || '.png' WHERE source = 'app';"
    ),
  ],
};

export default migrationV18;
