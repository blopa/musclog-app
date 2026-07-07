import { createTable } from '@nozbe/watermelondb/Schema/migrations';

// Version 23: Add fasted_days table.
//
// Stores days the user explicitly marked as fasting (ate nothing). Keyed to the same
// day-key space as nutrition_logs (date + timezone, resolved with utcNormalizedDayKey),
// so historical macro/calorie averages can treat a flagged empty day as a real 0-kcal day
// while still skipping unflagged empty days (a forgotten log). Only consulted when the
// ENABLE_FASTED_DAY setting is enabled.
const migrationV23 = {
  toVersion: 23,
  steps: [
    createTable({
      name: 'fasted_days',
      columns: [
        { name: 'date', type: 'number' },
        { name: 'timezone', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
};

export default migrationV23;
