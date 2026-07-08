import {
  cacheDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';

import { type AsyncStorageDump } from './asyncStorageBackup';
import { dumpDatabaseWithQueryRunner, LIST_USER_TABLES_SQL } from './exportDbCore';
import type { BackupFileMeta } from './preMigrationBackup';

// The slice of a backup-index entry a conversion needs. Passing the meta (rather
// than shredding it into positional args) keeps call sites trivial and lets the
// conversion enforce its own invariants (a sqlite snapshot must know its schema
// version — see below).
export type SqliteBackupRef = Pick<BackupFileMeta, 'uri' | 'fromVersion' | 'asyncStorageUri'>;

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

async function readAsyncStorageSnapshot(uri?: string): Promise<AsyncStorageDump | undefined> {
  if (!uri) {
    return undefined;
  }

  const info = await getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`Backup AsyncStorage snapshot not found: ${uri}`);
  }

  const parsed = JSON.parse(await readAsStringAsync(uri));
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup AsyncStorage snapshot is invalid');
  }

  return parsed as AsyncStorageDump;
}

/**
 * Reads a `.db` snapshot and returns the equivalent JSON export string, stamped
 * with the snapshot's own schema version (`fromVersion`) so restoreDatabase()
 * applies the right cross-version normalisation. A missing version is an error —
 * defaulting to the current version would mislabel old-schema data as current.
 *
 * Guards against a missing or empty file so a deleted/corrupt snapshot can never
 * turn a restore into a data-wipe (an empty dump would reset the DB to nothing).
 */
export async function convertSqliteBackupToJson(backup: SqliteBackupRef): Promise<string> {
  const { uri, fromVersion, asyncStorageUri } = backup;

  if (fromVersion == null) {
    throw new Error('SQLite backup snapshot is missing its schema version (fromVersion)');
  }

  const { dir, name } = splitFsPath(uri);

  if (name === `${DATABASE_NAME}.db`) {
    throw new Error('Refusing to open the live database as a backup snapshot');
  }

  const info = await getInfoAsync(uri);
  if (!info.exists) {
    throw new Error(`Backup snapshot not found: ${uri}`);
  }

  const asyncStorageData = await readAsyncStorageSnapshot(asyncStorageUri);
  const db = openDatabaseSync(name, undefined, dir);
  try {
    const tables = db.getAllSync<{ name: string }>(LIST_USER_TABLES_SQL);
    if (tables.length === 0) {
      throw new Error('Backup snapshot has no tables — refusing to restore an empty snapshot');
    }

    return await dumpDatabaseWithQueryRunner(
      async (sql) => db.getAllSync(sql) as Record<string, unknown>[],
      undefined,
      { includeDeletedRecords: true, exportVersion: fromVersion, asyncStorageData }
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
export async function exportSqliteBackupAsJsonFile(backup: SqliteBackupRef): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const json = await convertSqliteBackupToJson(backup);
  const baseName = (backup.uri.split('/').pop() ?? 'backup').replace(/\.db$/, '');
  const jsonUri = `${cacheDirectory}${baseName}.json`;
  await writeAsStringAsync(jsonUri, json);
  return jsonUri;
}
