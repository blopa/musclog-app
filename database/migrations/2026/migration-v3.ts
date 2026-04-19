import { addColumns, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV3 = {
  toVersion: 3,
  steps: [
    unsafeExecuteSql('UPDATE workout_logs SET total_volume = NULL;'),
    // Add source column to food_portions and backfill existing rows.
    // unsafeExecuteSql is ignored by the LokiJS adapter (web) - the JS fallback
    // in app/_layout.tsx covers that platform.
    addColumns({
      table: 'food_portions',
      columns: [{ name: 'source', type: 'string', isOptional: true }],
    }),
    unsafeExecuteSql(
      "UPDATE food_portions SET source = 'user' WHERE source IS NULL OR source = '';"
    ),
    // The first 9 portions (oldest by created_at) are always the common app-seeded portions
    // from createCommonPortions() in prod.ts (10 entries but 50g is deduplicated -> 9 unique rows).
    unsafeExecuteSql(
      "UPDATE food_portions SET source = 'app' WHERE rowid IN (SELECT rowid FROM food_portions ORDER BY created_at ASC LIMIT 9);"
    ),
  ],
};

export default migrationV3;
