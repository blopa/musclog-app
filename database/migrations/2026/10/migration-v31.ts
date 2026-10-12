import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

// Version 31: progression rules as data.
//
// `workout_template_exercises.progression_json` is the rule the user attached to an exercise of a
// workout (double progression, linear, top set + back-offs, percentage of a training max); null
// keeps the automatic progression. `workout_log_exercises.progression_json` is the session's own
// copy, taken when the workout starts, plus what the rule must remember between sessions (the
// training max of a percentage rule) — a template is rewritten on every save, history is not.
//
// Purely additive: new optional columns, so no pre-migration snapshot is taken and nothing needs a
// backfill — every existing exercise simply has no rule.
const migrationV31 = {
  toVersion: 31,
  steps: [
    addColumns({
      table: 'workout_template_exercises',
      columns: [{ name: 'progression_json', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'workout_log_exercises',
      columns: [{ name: 'progression_json', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV31;
