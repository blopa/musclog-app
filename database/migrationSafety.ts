import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// WatermelonDB migration step types that only add new, empty schema structures.
// Applying them leaves every existing row byte-for-byte unchanged, so there is
// nothing a pre-migration snapshot could protect. Only `sql` steps (raw SQL:
// backfills, rewrites, drops) can touch existing data.
const ADDITIVE_MIGRATION_STEP_TYPES: ReadonlySet<string> = new Set(['create_table', 'add_columns']);

/**
 * True when applying the migrations in the range `(fromVersion, toVersion]` could
 * modify or delete existing rows — i.e. any pending migration has a step that is
 * not a purely-additive schema change. Raw `sql` steps and any unrecognised step
 * type are treated as potentially destructive (fail safe: back up when unsure).
 *
 * Gate the (expensive) pre-migration full-DB snapshot on this: when it is false
 * the backup is pointless work — a synchronous read + JSON serialisation of every
 * row would run on boot for a migration that cannot lose a single row (e.g. a lone
 * `createTable`). Skipping it keeps upgrade boots fast.
 */
export function pendingMigrationsCanTouchExistingData(
  migrations: SchemaMigrations,
  fromVersion: number,
  toVersion: number
): boolean {
  return migrations.sortedMigrations
    .filter((migration) => migration.toVersion > fromVersion && migration.toVersion <= toVersion)
    .some((migration) =>
      migration.steps.some((step) => !ADDITIVE_MIGRATION_STEP_TYPES.has(step.type))
    );
}
