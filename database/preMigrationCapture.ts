import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import { cacheDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';
import { timestampSlug } from '@/utils/timestampSlug';

import { wdbDir } from './dbPath';
import { pendingMigrationsCanTouchExistingData } from './migrationSafety';
import { registerPreMigrationDbBackup } from './preMigrationBackup';

/**
 * Pre-adapter pre-migration capture (native only).
 *
 * This module is the ONLY place allowed to open musclog.db with expo-sqlite,
 * and it is imported solely by adapter.ts at module-eval time — before
 * WatermelonDB opens the file. That ordering is what makes the raw connection
 * safe: once WatermelonDB is live, closing a second SQLite library's connection
 * unlinks the WAL beneath it and loses subsequent commits on process kill (see
 * wmdbRaw.ts). Keeping this open/read/close out of preMigrationBackup.ts (which
 * holds runtime paths) makes that invariant structural — the runtime backup
 * module imports no expo-sqlite at all.
 *
 * The snapshot itself is a raw `VACUUM INTO` copy of musclog.db — one consistent
 * standalone file (the WAL is folded in, so a session that was killed with
 * uncheckpointed commits is still captured correctly) written synchronously
 * through this same connection before the adapter opens. That is near-instant
 * versus reading every row and serialising it to JSON, which is why upgrade boots
 * used to stall for minutes. The JSON conversion is deferred to restore time.
 */

// Escape a filesystem path for embedding as a single-quoted SQL string literal.
const sqlQuote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * Writes a consistent `.db` snapshot of the open database into the cache
 * directory via `VACUUM INTO`, then registers it in the backup index.
 * Synchronous copy so it finishes before the adapter opens.
 */
function captureDbSnapshotSync(db: SQLiteDatabase, fromVersion: number, toVersion: number): void {
  if (!cacheDirectory) {
    console.warn(
      '[PreMigrationBackup] Cache directory unavailable — skipping pre-migration snapshot'
    );
    return;
  }

  const backupUri = `${cacheDirectory}${timestampSlug()}-pre-migration-v${fromVersion}-to-v${toVersion}.db`;
  const backupPath = backupUri.replace(/^file:\/\//, '');
  db.execSync(`VACUUM INTO ${sqlQuote(backupPath)}`);
  registerPreMigrationDbBackup(backupUri, fromVersion, toVersion);
}

/**
 * Reads PRAGMA user_version and, when a schema migration that can touch existing
 * rows is pending, writes a consistent `.db` snapshot synchronously via
 * `VACUUM INTO` (it must finish before the adapter opens the file and the
 * migration starts mutating it) and registers it via preMigrationBackup.ts.
 * Purely-additive migrations (createTable / addColumns) skip the snapshot — see
 * pendingMigrationsCanTouchExistingData — because they cannot lose data and a
 * snapshot there just slows the boot. Returns the current on-disk version for
 * migration diagnostics, or null if it can't be read.
 */
export function preparePreMigrationBackupBeforeAdapter(
  toVersion: number,
  migrations: SchemaMigrations
): number | null {
  let db: SQLiteDatabase | null = null;
  try {
    db = openDatabaseSync(`${DATABASE_NAME}.db`, undefined, wdbDir());
    const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    const fromVersion = result?.user_version ?? null;

    if (
      fromVersion != null &&
      fromVersion > 0 &&
      fromVersion < toVersion &&
      pendingMigrationsCanTouchExistingData(migrations, fromVersion, toVersion)
    ) {
      captureDbSnapshotSync(db, fromVersion, toVersion);
    }

    return fromVersion;
  } catch (error) {
    console.warn('[PreMigrationBackup] Failed to inspect database before adapter init:', error);
    return null;
  } finally {
    try {
      db?.closeSync();
    } catch {
      // best effort
    }
  }
}
