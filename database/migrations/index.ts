import {
  addColumns,
  schemaMigrations,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Version 1: Initial schema
    // No migration needed as this is the initial version

    // Version 2: Add source column to exercises and backfill existing rows.
    // unsafeExecuteSql is ignored by the LokiJS adapter (web) — the JS fallback
    // in app/_layout.tsx covers that platform.
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'exercises',
          columns: [{ name: 'source', type: 'string', isOptional: true }],
        }),
        // Default all existing exercises to 'user' first, then promote the
        // first 105 (oldest by created_at) to 'app' — those are the exercises
        // seeded from the bundled JSON during production seeding.
        unsafeExecuteSql(
          "UPDATE exercises SET source = 'user' WHERE source IS NULL OR source = '';"
        ),
        unsafeExecuteSql(
          "UPDATE exercises SET source = 'app' WHERE rowid IN (SELECT rowid FROM exercises ORDER BY created_at ASC LIMIT 105);"
        ),
      ],
    },

    // Version 3: Reset totalVolume for all existing workout logs.
    // The volume formula changed from simple reps×weight to average-1RM across
    // seven published formulas (accounting for RIR and bodyweight exercises).
    // Old values are ~7.5× smaller than new ones, so keeping them would produce
    // false trends in the volume chart. Resetting to NULL is safer: the trend
    // chart already filters out null-volume workouts, so old sessions simply
    // drop out of the chart rather than distorting it.
    {
      toVersion: 3,
      steps: [
        unsafeExecuteSql('UPDATE workout_logs SET total_volume = NULL;'),
        // Add source column to food_portions and backfill existing rows.
        // unsafeExecuteSql is ignored by the LokiJS adapter (web) — the JS fallback
        // in app/_layout.tsx covers that platform.
        addColumns({
          table: 'food_portions',
          columns: [{ name: 'source', type: 'string', isOptional: true }],
        }),
        unsafeExecuteSql(
          "UPDATE food_portions SET source = 'user' WHERE source IS NULL OR source = '';"
        ),
        // The first 9 portions (oldest by created_at) are always the common app-seeded portions
        // from createCommonPortions() in prod.ts (10 entries but 50g is deduplicated → 9 unique rows).
        unsafeExecuteSql(
          "UPDATE food_portions SET source = 'app' WHERE rowid IN (SELECT rowid FROM food_portions ORDER BY created_at ASC LIMIT 9);"
        ),
      ],
    },

    // Version 4: Replace volume_calculation_type with workout_insights_type (per-template insights mode).
    // Also drop deprecated `food_portions.is_default` (unused; catalog vs user rows use `source`).
    {
      toVersion: 4,
      steps: [
        unsafeExecuteSql('ALTER TABLE food_portions DROP COLUMN is_default;'),
        unsafeExecuteSql('ALTER TABLE workout_templates DROP COLUMN volume_calculation_type;'),
        addColumns({
          table: 'workout_templates',
          columns: [{ name: 'workout_insights_type', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
