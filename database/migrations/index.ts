import {
  addColumns,
  createTable,
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
  ],
});
