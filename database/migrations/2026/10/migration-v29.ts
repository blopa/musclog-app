import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

// Version 29: why a planned set was started at the numbers it was.
//
// When a workout is started from a template, the app can progress each exercise from how the last
// session went (more load, more reps, a deload, or a repeat of last time) instead of copying the
// template's possibly stale numbers. `adjustment_json` records that decision on the set itself, so
// the session can say what it did and offer to undo it. It is cleared the moment the user edits or
// performs the set.
//
// One optional column: purely additive, so no pre-migration snapshot and no backfill — every
// existing set simply has no adjustment.
const migrationV29 = {
  toVersion: 29,
  steps: [
    addColumns({
      table: 'workout_log_sets',
      columns: [{ name: 'adjustment_json', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV29;
