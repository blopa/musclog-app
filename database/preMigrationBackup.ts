import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';
import { handleError } from '@/utils/handleError';

import { wdbDir } from './dbPath';
import { dumpDatabase } from './exportDb';
import type { RawQueryRunner } from './wmdbRaw';

const PRE_MIGRATION_BACKUPS_KEY = 'pre_migration_backups_v1';
const PRE_MIGRATION_BACKUPS_MAX_FILES = 3;

export type BackupFileMeta = {
  uri: string;
  createdAt: string;
  fromVersion: number | null;
  toVersion: number | null;
};

type MigrationEventShape = {
  from?: number;
  to?: number;
  fromVersion?: number;
  toVersion?: number;
  databaseVersion?: number;
};

function normalizeVersion(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getVersions(event?: unknown) {
  const payload = (event as MigrationEventShape) || {};
  return {
    fromVersion: normalizeVersion(payload.fromVersion ?? payload.from),
    toVersion: normalizeVersion(payload.toVersion ?? payload.to ?? payload.databaseVersion),
  };
}

const formatVersion = (value: number | null): string => (value == null ? 'unknown' : String(value));

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
  queryRunner?: RawQueryRunner
): Promise<string> {
  if (!cacheDirectory) {
    throw new Error('Cache directory is not available');
  }

  const jsonString = await dumpDatabase(undefined, { queryRunner });
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-').slice(0, 19);
  const uri = `${cacheDirectory}${timestamp}-${nameInfix}.json`;

  await writeAsStringAsync(uri, jsonString);

  const existing = await getStoredBackups();
  const next = await pruneOldBackups([{ uri, createdAt, fromVersion, toVersion }, ...existing]);
  await writeStoredBackups(next);

  return uri;
}

/**
 * No-op on native: the backup is triggered via migrationEvents.onStart in
 * adapter.ts, not through this entry point. On web this function is replaced
 * by the real implementation in preMigrationBackup.web.ts.
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
    handleError(error, 'database.preRestoreBackup');
  }
}

let inFlightBackup: Promise<void> | null = null;
let completedBackupSignature: string | null = null;

export function createPreMigrationBackup(event?: unknown): Promise<void> {
  const { fromVersion, toVersion } = getVersions(event);
  const signature = `${formatVersion(fromVersion)}->${formatVersion(toVersion)}`;

  if (completedBackupSignature === signature) {
    return Promise.resolve();
  }

  if (inFlightBackup) {
    return inFlightBackup;
  }

  async function performBackup() {
    const infix = `pre-migration-v${formatVersion(fromVersion)}-to-v${formatVersion(toVersion)}`;

    // Pre-migration backups read via a raw expo-sqlite connection: they run
    // while WatermelonDB is mid-migration and cannot serve queries. This is
    // the only mid-session raw connection left in the app — its close can
    // unlink the live WAL (see wmdbRaw.ts), which is accepted because
    // migrations are rare and the boot rescue checkpoint in dbDurability.ts
    // persists any affected frames right after the DB becomes ready. Every
    // other dump goes through WatermelonDB's own connection.
    const db = openDatabaseSync(`${DATABASE_NAME}.db`, { useNewConnection: true }, wdbDir());
    const runQuery: RawQueryRunner = (sql, args = []) =>
      db.getAllAsync(sql, args) as Promise<Record<string, unknown>[]>;

    try {
      const uri = await executeBackup(infix, fromVersion, toVersion, runQuery);
      completedBackupSignature = signature;
      console.log(`[PreMigrationBackup] Created: ${uri}`);
    } finally {
      try {
        db.closeSync();
      } catch {
        // best effort
      }
    }
  }

  inFlightBackup = performBackup()
    .catch((error) => {
      console.error('[PreMigrationBackup] Failed to create backup:', error);
      handleError(error, 'database.preMigrationBackup');
    })
    .finally(() => {
      inFlightBackup = null;
    });

  return inFlightBackup;
}
