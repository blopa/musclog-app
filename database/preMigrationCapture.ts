import type { SchemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';
import { RESTORE_ORDER } from '@/constants/exportImport';

import { wdbDir } from './dbPath';
import { type CapturedTableRows, LIST_USER_TABLES_SQL, selectAllRowsSql } from './exportDbCore';
import { pendingMigrationsCanTouchExistingData } from './migrationSafety';
import { persistCapturedPreMigrationBackup } from './preMigrationBackup';

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
 */

function readCapturedRowsSync(db: SQLiteDatabase): CapturedTableRows {
  const tableRows = db.getAllSync<{ name: string }>(LIST_USER_TABLES_SQL);
  const existingTables = new Set(tableRows.map((row) => row.name));
  const capturedRows: CapturedTableRows = {};

  for (const tableName of RESTORE_ORDER) {
    if (!existingTables.has(tableName)) {
      continue;
    }

    capturedRows[tableName] = db.getAllSync<Record<string, unknown>>(selectAllRowsSql(tableName));
  }

  return capturedRows;
}

/**
 * Reads PRAGMA user_version and, when a schema migration that can touch existing
 * rows is pending, captures a full snapshot of the existing rows synchronously
 * (it must finish before the adapter opens the file and the migration starts
 * mutating it) and hands them to the async persist machinery in
 * preMigrationBackup.ts. Purely-additive migrations (createTable / addColumns)
 * skip the snapshot — see pendingMigrationsCanTouchExistingData — because they
 * cannot lose data and a full-DB capture there just makes upgrade boots crawl.
 * Returns the current on-disk version for migration diagnostics, or null if it
 * can't be read.
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
      const capturedRows = readCapturedRowsSync(db);
      persistCapturedPreMigrationBackup(capturedRows, fromVersion, toVersion);
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
