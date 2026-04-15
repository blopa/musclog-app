import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAsync } from 'expo-file-system';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';

import { captureException } from '@/utils/sentry';

const PRE_MIGRATION_BACKUPS_KEY = 'pre_migration_backups_v1';
const PRE_MIGRATION_BACKUPS_MAX_FILES = 3;
const DATABASE_NAME = 'musclog';

type BackupFileMeta = {
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
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getVersions(event: unknown): { fromVersion: number | null; toVersion: number | null } {
  const payload = (event as MigrationEventShape | undefined) ?? {};
  const fromVersion = normalizeVersion(payload.fromVersion ?? payload.from);
  const toVersion = normalizeVersion(payload.toVersion ?? payload.to ?? payload.databaseVersion);
  return { fromVersion, toVersion };
}

function formatVersion(value: number | null): string {
  return value == null ? 'unknown' : String(value);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function getStoredBackups(): Promise<BackupFileMeta[]> {
  const raw = await AsyncStorage.getItem(PRE_MIGRATION_BACKUPS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is BackupFileMeta =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as BackupFileMeta).uri === 'string' &&
        typeof (item as BackupFileMeta).createdAt === 'string'
    );
  } catch {
    return [];
  }
}

async function writeStoredBackups(backups: BackupFileMeta[]): Promise<void> {
  await AsyncStorage.setItem(PRE_MIGRATION_BACKUPS_KEY, JSON.stringify(backups));
}

async function pruneOldBackups(backups: BackupFileMeta[]): Promise<BackupFileMeta[]> {
  if (backups.length <= PRE_MIGRATION_BACKUPS_MAX_FILES) {
    return backups;
  }

  const keep = backups.slice(0, PRE_MIGRATION_BACKUPS_MAX_FILES);
  const remove = backups.slice(PRE_MIGRATION_BACKUPS_MAX_FILES);

  await Promise.all(
    remove.map(async (file) => {
      try {
        await deleteAsync(file.uri, { idempotent: true });
      } catch {
        // best-effort cleanup
      }
    })
  );

  return keep;
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

  inFlightBackup = (async () => {
    try {
      if (!cacheDirectory) {
        throw new Error('Cache directory is not available');
      }

      const db = openDatabaseSync(DATABASE_NAME, {
        enableChangeListener: true,
        useNewConnection: true,
      });

      const userVersionRows = (await db.getAllAsync('PRAGMA user_version;')) as {
        user_version?: number;
      }[];
      const sqliteUserVersion = normalizeVersion(userVersionRows[0]?.user_version);

      const tableRows = (await db.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
      )) as { name: string }[];
      const tableNames = tableRows.map((row) => row.name);

      const tables: Record<string, unknown[]> = {};
      for (const tableName of tableNames) {
        const rows = await db.getAllAsync(`SELECT * FROM ${quoteIdentifier(tableName)};`);
        tables[tableName] = rows as unknown[];
      }

      const createdAt = new Date().toISOString();
      const timestamp = createdAt.replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${timestamp}-pre-migration-v${formatVersion(fromVersion)}-to-v${formatVersion(toVersion)}.json`;
      const uri = `${cacheDirectory}${fileName}`;

      const payload = {
        type: 'musclog_pre_migration_backup',
        createdAt,
        dbName: DATABASE_NAME,
        migration: {
          fromVersion,
          toVersion,
        },
        sqliteUserVersion,
        tableCount: tableNames.length,
        tables,
      };

      await writeAsStringAsync(uri, JSON.stringify(payload, null, 2));

      const existing = await getStoredBackups();
      const next = await pruneOldBackups([
        {
          uri,
          createdAt,
          fromVersion,
          toVersion,
        },
        ...existing,
      ]);
      await writeStoredBackups(next);

      completedBackupSignature = signature;
      console.log(`[PreMigrationBackup] Created: ${uri}`);
    } catch (error) {
      console.error('[PreMigrationBackup] Failed to create backup:', error);
      captureException(error, {
        data: {
          context: 'database.preMigrationBackup',
          signature,
        },
      });
    } finally {
      inFlightBackup = null;
    }
  })();

  return inFlightBackup;
}
