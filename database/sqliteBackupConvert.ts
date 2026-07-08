import { cacheDirectory, getInfoAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';

import { dumpDatabaseWithQueryRunner, LIST_USER_TABLES_SQL } from './exportDbCore';

/**
 * Lazy conversion of a raw `.db` pre-migration snapshot (see preMigrationCapture.ts)
 * into the portable JSON export format that restoreDatabase() and the import UI
 * consume. This is the deferred half of the "copy the file now, convert only if the
 * user ever restores" design: capture is a near-instant `VACUUM INTO`, and the
 * expensive row read + JSON serialisation happens here, at restore/download time.
 *
 * Opening the snapshot with expo-sqlite is safe because it is a DIFFERENT file
 * from the live `musclog.db` (durability rule #4 — the WAL-unlink hazard is
 * specific to a second library holding a connection to the *live* file). Never
 * point this at the live database. Web has no `.db` snapshots — see the .web stub.
 */

function splitFsPath(uri: string): { dir: string; name: string } {
  const fsPath = uri.replace(/^file:\/\//, '');
  const lastSlash = fsPath.lastIndexOf('/');
  return { dir: fsPath.slice(0, lastSlash), name: fsPath.slice(lastSlash + 1) };
}

/**
 * Reads a `.db` snapshot and returns the equivalent JSON export string.
 * `exportVersion` should be the snapshot's schema version (its `fromVersion`) so
 * restoreDatabase() applies the right cross-version normalisation.
 *
 * Guards against a missing or empty file so a deleted/corrupt snapshot can never
 * turn a restore into a data-wipe (an empty dump would reset the DB to nothing).
 */
export async function convertSqliteBackupToJson(
  uri: string,
  exportVersion?: number
): Promise<string> {
  const { dir, name } = splitFsPath(uri);

  if (name === `${DATABASE_NAME}.db`) {
    throw new Error('Refusing to open the live database as a backup snapshot');
  }

  const info = await getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`Backup snapshot not found: ${uri}`);
  }

  const db = openDatabaseSync(name, undefined, dir);
  try {
    const tables = db.getAllSync<{ name: string }>(LIST_USER_TABLES_SQL);
    if (tables.length === 0) {
      throw new Error('Backup snapshot has no tables — refusing to restore an empty snapshot');
    }

    return await dumpDatabaseWithQueryRunner(
      async (sql) => db.getAllSync(sql) as Record<string, unknown>[],
      undefined,
      { includeDeletedRecords: true, exportVersion }
    );
  } finally {
    try {
      db.closeSync();
    } catch {
      // best effort
    }
  }
}

/**
 * Converts a `.db` snapshot to JSON and writes it to a temporary `.json` file in
 * the cache directory, returning that file's URI. Used so a user who downloads a
 * pre-migration backup gets the portable JSON (re-importable on any device / on
 * web), not the internal SQLite file.
 */
export async function exportSqliteBackupAsJsonFile(
  uri: string,
  exportVersion?: number
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const json = await convertSqliteBackupToJson(uri, exportVersion);
  const baseName = (uri.split('/').pop() ?? 'backup').replace(/\.db$/, '');
  const jsonUri = `${cacheDirectory}${baseName}.json`;
  await writeAsStringAsync(jsonUri, json);
  return jsonUri;
}
