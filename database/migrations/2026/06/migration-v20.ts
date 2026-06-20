import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

// Version 20: Add timezone column to nutrition_logs and workout_logs.
// Stores the device's UTC offset (e.g. "-05:00") captured when the entry is logged,
// so history can later be shown at the offset it was recorded in.
// Optional at the SQL step: existing nutrition_logs rows are repaired at boot by
// TimezoneMigrationService.repairNullTimezoneNutritionLogs() using a best-effort offset.
//
// The pre-existing user_metrics.timezone column already holds legacy IANA zone names
// (e.g. "America/New_York"). Converting those to the same "±HH:MM" offset format is
// DST-aware (resolved at each row's date), which SQLite can't express, so it runs as an
// idempotent boot-time backfill — UserMetricService.backfillTimezoneOffsets(), wired in
// components/AppBoot.tsx — instead of a migration step here.
const migrationV20 = {
  toVersion: 20,
  steps: [
    addColumns({
      table: 'nutrition_logs',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'workout_logs',
      columns: [{ name: 'timezone', type: 'string', isOptional: true }],
    }),
  ],
};

export default migrationV20;
