import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';

import { timestampSlug } from '@/utils/timestampSlug';

const PRE_MIGRATION_BACKUPS_KEY = 'pre_migration_backups_v1';
const PRE_MIGRATION_BACKUPS_MAX_FILES = 3;

export type BackupFileMeta = {
  uri: string;
  createdAt: string;
  fromVersion: number | null;
  toVersion: number | null;
  reason?: 'schema-migration' | 'pre-restore' | 'exercise-catalogue';
  // Storage format of the backup file. 'sqlite' is a raw `VACUUM INTO` copy of
  // musclog.db (native pre-migration snapshots — fast to create, converted to
  // JSON lazily at restore/download time). 'json' (or absent, for older entries
  // and all web backups) is the portable export dump restoreDatabase() reads.
  format?: 'json' | 'sqlite';
  // Sidecar JSON file containing the AsyncStorage snapshot captured at the same
  // time as a native sqlite snapshot. Keeps restored backups coherent without
  // embedding the sidecar payload in the AsyncStorage backup index itself.
  asyncStorageUri?: string;
};

const formatVersion = (value: number | null): string => (value == null ? 'unknown' : String(value));

async function reportBackupError(error: unknown, context: string): Promise<void> {
  try {
    const { handleError } = await import('../utils/handleError');
    await handleError(error, context);
  } catch {
    // The backup path runs during boot; console output is safer than creating a
    // hard dependency on the DB-backed Sentry consent path.
  }
}

export function getWebBackupContent(_hash: string): string | null {
  return null;
}

export async function getStoredBackups(): Promise<BackupFileMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(PRE_MIGRATION_BACKUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is BackupFileMeta =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).uri === 'string' &&
        typeof (item as Record<string, unknown>).createdAt === 'string' &&
        ((item as Record<string, unknown>).asyncStorageUri === undefined ||
          typeof (item as Record<string, unknown>).asyncStorageUri === 'string')
    );
  } catch {
    return [];
  }
}

const writeStoredBackups = (backups: BackupFileMeta[]) =>
  AsyncStorage.setItem(PRE_MIGRATION_BACKUPS_KEY, JSON.stringify(backups));

const safeDelete = async (uri: string) => {
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.error(`[PreMigrationBackup] Failed to delete file ${uri}:`, error);
  }
};

async function deleteBackupFiles(file: BackupFileMeta): Promise<void> {
  await safeDelete(file.uri);
  if (file.asyncStorageUri) {
    await safeDelete(file.asyncStorageUri);
  }
}

export async function deleteBackup(uri: string): Promise<void> {
  const backups = await getStoredBackups();
  const backup = backups.find((b) => b.uri === uri);
  await writeStoredBackups(backups.filter((b) => b.uri !== uri));
  // Commit the index first so a metadata failure never leaves a broken indexed entry.
  await (backup ? deleteBackupFiles(backup) : safeDelete(uri));
}

async function commitStoredBackups(backups: BackupFileMeta[]): Promise<BackupFileMeta[]> {
  const keep = backups.slice(0, PRE_MIGRATION_BACKUPS_MAX_FILES);
  const remove = backups.slice(PRE_MIGRATION_BACKUPS_MAX_FILES);

  // Metadata is the commit point. Once it succeeds, stale files are harmless orphans
  // if cleanup is interrupted; deleting files before it succeeds would break old entries.
  await writeStoredBackups(keep);
  await Promise.all(remove.map(deleteBackupFiles));
  return keep;
}

/** Write a portable payload and atomically replace the native backup index. */
export async function writePortableBackup(
  backup: BackupFileMeta,
  backupJson: string
): Promise<void> {
  const existing = await getStoredBackups();
  const wasAlreadyIndexed = existing.some((entry) => entry.uri === backup.uri);

  await writeAsStringAsync(backup.uri, backupJson);
  try {
    await commitStoredBackups([backup, ...existing.filter((entry) => entry.uri !== backup.uri)]);
  } catch (error) {
    if (!wasAlreadyIndexed) {
      await safeDelete(backup.uri);
    }

    throw error;
  }
}

async function executeBackup(
  nameInfix: string,
  reason: BackupFileMeta['reason'],
  fromVersion: number | null = null,
  toVersion: number | null = null,
  jsonString?: string
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const backupJson = jsonString ?? (await createLiveBackupJson());
  const createdAtDate = new Date();
  const createdAt = createdAtDate.toISOString();
  const uri = `${cacheDirectory}${timestampSlug(createdAtDate)}-${nameInfix}.json`;
  await writePortableBackup(
    { uri, createdAt, fromVersion, toVersion, format: 'json', reason },
    backupJson
  );

  return uri;
}

async function createLiveBackupJson(): Promise<string> {
  const { dumpDatabase } = await import('./exportDb');
  return dumpDatabase();
}

/**
 * No-op on native: pre-migration rows are captured in adapter.ts before the
 * WatermelonDB adapter opens SQLite. On web this function is replaced by the
 * real implementation in preMigrationBackup.web.ts.
 */
export async function runWebPreMigrationBackupIfNeeded(): Promise<void> {}

/**
 * Explicitly create a backup before restoring a database dump.
 * This ensures the user can undo a restore if they accidentally imported the wrong file.
 */
export async function createPreRestoreBackup(): Promise<void> {
  try {
    const uri = await executeBackup('pre-restore', 'pre-restore');
    console.log(`[PreRestoreBackup] Created: ${uri}`);
  } catch (error) {
    console.error('[PreRestoreBackup] Failed to create backup:', error);
    await reportBackupError(error, 'database.preRestoreBackup');
  }
}

/**
 * Create the required safety backup before the legacy exercise catalogue is retired.
 * Unlike the best-effort pre-restore backup, failure is propagated so the caller can
 * leave every legacy row untouched and retry the cutover on a later boot.
 */
export async function createPreExerciseCatalogueBackup(): Promise<string> {
  try {
    const uri = await executeBackup('pre-exercise-catalogue', 'exercise-catalogue');
    console.log(`[PreExerciseCatalogueBackup] Created: ${uri}`);
    return uri;
  } catch (error) {
    console.error('[PreExerciseCatalogueBackup] Failed to create backup:', error);
    await reportBackupError(error, 'database.preExerciseCatalogueBackup');
    throw error;
  }
}

// Dedup state for registerPreMigrationDbBackup. Single-call-per-boot by
// construction: the only caller is the pre-adapter capture in
// preMigrationCapture.ts, which runs once at module-eval time. Do NOT reuse
// this dedup from other paths — `inFlightBackup` is signature-agnostic, so a
// second concurrent call with a different version range would be handed the
// first call's promise.
let inFlightBackup: Promise<void> | null = null;
let completedBackupSignature: string | null = null;

function asyncStorageSidecarUriFor(dbSnapshotUri: string): string {
  return dbSnapshotUri.endsWith('.db')
    ? dbSnapshotUri.slice(0, -'.db'.length) + '.async-storage.json'
    : `${dbSnapshotUri}.async-storage.json`;
}

async function writeAsyncStorageSnapshotSidecar(dbSnapshotUri: string): Promise<string> {
  const { captureAsyncStorageDump } = await import('./asyncStorageBackup');
  const snapshot = await captureAsyncStorageDump();
  const uri = asyncStorageSidecarUriFor(dbSnapshotUri);
  await writeAsStringAsync(uri, JSON.stringify(snapshot));
  return uri;
}

// Called from preMigrationCapture.ts (the pre-adapter path) after it has already
// written a raw `.db` snapshot with `VACUUM INTO` (synchronous, so it completes
// before WatermelonDB opens and the migration mutates the file). The file itself
// is done; this attempts to capture an AsyncStorage sidecar from the same boot
// moment and records the available files in the backup index. Fire-and-forget at
// module-eval time — the in-flight promise is tracked here and awaited via
// waitForPreMigrationBackup() before boot proceeds. The expensive DB JSON
// conversion is deferred to restore / download time (see convertSqliteBackupToJson),
// so upgrade boots don't pay it.
export function registerPreMigrationDbBackup(
  uri: string,
  fromVersion: number,
  toVersion: number
): Promise<void> {
  const signature = `${formatVersion(fromVersion)}->${formatVersion(toVersion)}`;

  if (completedBackupSignature === signature) {
    return Promise.resolve();
  }

  if (inFlightBackup) {
    return inFlightBackup;
  }

  async function performRegister() {
    const createdAt = new Date().toISOString();
    let asyncStorageUri: string | undefined;
    try {
      asyncStorageUri = await writeAsyncStorageSnapshotSidecar(uri);
    } catch (error) {
      console.error('[PreMigrationBackup] Failed to write AsyncStorage sidecar:', error);
      await reportBackupError(error, 'database.preMigrationBackup.asyncStorageSidecar');
    }

    const meta: BackupFileMeta = {
      uri,
      createdAt,
      fromVersion,
      toVersion,
      reason: 'schema-migration',
      format: 'sqlite',
      asyncStorageUri,
    };

    const existing = await getStoredBackups();
    try {
      await commitStoredBackups([meta, ...existing.filter((backup) => backup.uri !== uri)]);
    } catch (error) {
      await deleteBackupFiles(meta);
      throw error;
    }

    completedBackupSignature = signature;
    console.log(`[PreMigrationBackup] Created (sqlite snapshot): ${uri}`);
  }

  inFlightBackup = performRegister()
    .catch((error) => {
      console.error('[PreMigrationBackup] Failed to register backup:', error);
      void reportBackupError(error, 'database.preMigrationBackup');
    })
    .finally(() => {
      inFlightBackup = null;
    });

  return inFlightBackup;
}

export function waitForPreMigrationBackup(): Promise<void> {
  return inFlightBackup ?? Promise.resolve();
}
