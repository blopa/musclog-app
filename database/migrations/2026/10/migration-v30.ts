import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 30: per-exercise preferences, session notes and quick cardio logs.
//
// `exercise_user_settings` holds what the user has said about an exercise itself — the unit its
// weights are shown in and a note that follows it into every session. `workout_logs` learns a
// session note, and the distance and activity of a quick walk/run log (a log with no sets).
//
// Purely additive: a new table and new optional columns, so no pre-migration snapshot is taken and
// nothing needs a backfill — every existing exercise and workout simply has none of these.
const migrationV30 = {
  toVersion: 30,
  steps: [
    createTable({
      name: 'exercise_user_settings',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'weight_unit', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'workout_logs',
      columns: [
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'distance_m', type: 'number', isOptional: true },
        { name: 'activity', type: 'string', isOptional: true },
      ],
    }),
  ],
};

export default migrationV30;
