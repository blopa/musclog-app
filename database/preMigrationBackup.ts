import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';

import { type CapturedTableRows, dumpRowsToJson } from './exportDbCore';

const PRE_MIGRATION_BACKUPS_KEY = 'pre_migration_backups_v1';
const PRE_MIGRATION_BACKUPS_MAX_FILES = 3;

export type BackupFileMeta = {
  uri: string;
  createdAt: string;
  fromVersion: number | null;
  toVersion: number | null;
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
        typeof (item as Record<string, unknown>).createdAt === 'string'
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

export async function deleteBackup(uri: string): Promise<void> {
  const backups = await getStoredBackups();
  await safeDelete(uri);
  await writeStoredBackups(backups.filter((b) => b.uri !== uri));
}

async function pruneOldBackups(backups: BackupFileMeta[]): Promise<BackupFileMeta[]> {
  if (backups.length <= PRE_MIGRATION_BACKUPS_MAX_FILES) {
    return backups;
  }

  const keep = backups.slice(0, PRE_MIGRATION_BACKUPS_MAX_FILES);
  const remove = backups.slice(PRE_MIGRATION_BACKUPS_MAX_FILES);

  await Promise.all(remove.map((file) => safeDelete(file.uri)));
  return keep;
}

async function executeBackup(
  nameInfix: string,
  fromVersion: number | null = null,
  toVersion: number | null = null,
  jsonString?: string
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const backupJson = jsonString ?? (await createLiveBackupJson());
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-').slice(0, 19);
  const uri = `${cacheDirectory}${timestamp}-${nameInfix}.json`;

  await writeAsStringAsync(uri, backupJson);

  const existing = await getStoredBackups();
  const next = await pruneOldBackups([{ uri, createdAt, fromVersion, toVersion }, ...existing]);
  await writeStoredBackups(next);

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
    const uri = await executeBackup('pre-restore');
    console.log(`[PreRestoreBackup] Created: ${uri}`);
  } catch (error) {
    console.error('[PreRestoreBackup] Failed to create backup:', error);
    await reportBackupError(error, 'database.preRestoreBackup');
  }
}

let inFlightBackup: Promise<void> | null = null;
let completedBackupSignature: string | null = null;

// Called from preMigrationCapture.ts (the pre-adapter path) with the rows it
// captured synchronously; persists them asynchronously. Fire-and-forget at
// module-eval time, so the in-flight promise is tracked here and awaited via
// waitForPreMigrationBackup() before boot proceeds.
export function persistCapturedPreMigrationBackup(
  capturedRows: CapturedTableRows,
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

  async function performBackup() {
    const infix = `pre-migration-v${formatVersion(fromVersion)}-to-v${formatVersion(toVersion)}`;
    const jsonString = await dumpRowsToJson(capturedRows, undefined, {
      exportVersion: fromVersion,
    });

    const uri = await executeBackup(infix, fromVersion, toVersion, jsonString);
    completedBackupSignature = signature;
    console.log(`[PreMigrationBackup] Created: ${uri}`);
  }

  inFlightBackup = performBackup()
    .catch((error) => {
      console.error('[PreMigrationBackup] Failed to create backup:', error);
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
