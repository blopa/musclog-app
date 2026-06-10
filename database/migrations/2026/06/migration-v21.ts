import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

// Version 21: Add timezone column to menstrual_cycles, nutrition_checkins,
// saved_for_later_groups, nutrition_goals, and exercise_goals.
// Stores the device UTC offset (e.g. "+02:00") captured when the row was created.
// Optional: existing rows stay null; the boot-time backfill
// TimezoneMigrationService.backfillMissingTimezones() fills them with the
// current device offset as a best-effort approximation.
const migrationV21 = {
  toVersion: 21,
  steps: [
    addColumns({
      table: 'menstrual_cycles',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'nutrition_checkins',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'saved_for_later_groups',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'nutrition_goals',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'exercise_goals',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV21;
