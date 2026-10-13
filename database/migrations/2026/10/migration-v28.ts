import { addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 28: gym profiles and exercise restrictions.
//
// `gyms` holds a named set of equipment (the bar, the plates, the machines) that drives the plate
// calculator, the +/- load steps and which exercises may be suggested. `exercise_restrictions`
// records exercises the user does not want suggested — never, injury (which can expire) or dislike.
// `workout_log_exercises` learns which exercise a swapped block replaced and why, so the history
// can still say what the plan called for.
//
// Purely additive: every step is a new table or a new optional column, so no pre-migration
// snapshot is taken and nothing needs a backfill.
const migrationV28 = {
  toVersion: 28,
  steps: [
    createTable({
      name: 'gyms',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'bar_weight_kg', type: 'number' },
        { name: 'plates_json', type: 'string' },
        { name: 'weight_increment_kg', type: 'number' },
        { name: 'equipment_json', type: 'string' },
        { name: 'weight_unit', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'exercise_restrictions',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'expires_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    addColumns({
      table: 'workout_log_exercises',
      columns: [
        { name: 'replaced_exercise_id', type: 'string', isOptional: true },
        { name: 'substitution_reason', type: 'string', isOptional: true },
      ],
    }),
  ],
};

export default migrationV28;
