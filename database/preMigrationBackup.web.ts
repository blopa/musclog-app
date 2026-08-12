/**
 * Web-specific pre-migration backup (platform override of preMigrationBackup.ts).
 *
 * On web the LokiJS adapter has no migrationEvents hooks, so we detect a version
 * bump by comparing a localStorage version marker against CURRENT_DATABASE_VERSION.
 * When a bump is found we dump the full database, store the content in localStorage
 * under a SHA-256 hash key, and keep a small metadata index so LocalBackupsModal can
 * list, export, restore, and delete entries.
 *
 * LokiJS schema migrations only create new empty collections — they never modify
 * existing rows — so a dump taken at any point during startup captures the correct
 * user data regardless of whether WatermelonDB has already applied the migration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import { WEB_BACKUP_DATA_PREFIX } from '@/constants/exportImport';
import { isStaticExport } from '@/constants/platform';
import { handleError } from '@/utils/handleError';

import { dumpDatabase } from './exportDb';
import type { BackupFileMeta } from './preMigrationBackup';

export type { BackupFileMeta };

const WEB_BACKUPS_KEY = 'musclog_pre_migration_backups_v1';
const WEB_LAST_VERSION_KEY = 'musclog_last_db_version';
const MAX_BACKUPS = 3;

// ─── Hash ──────────────────────────────────────────────────────────────────

async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ─── Content access ────────────────────────────────────────────────────────

/** Read raw backup JSON from localStorage by hash (used by file.web.ts). */
export function getWebBackupContent(hash: string): string | null {
  try {
    return localStorage.getItem(`${WEB_BACKUP_DATA_PREFIX}${hash}`);
  } catch {
    return null;
  }
}

// ─── Metadata index ────────────────────────────────────────────────────────

export async function getStoredBackups(): Promise<BackupFileMeta[]> {
  try {
    const raw = localStorage.getItem(WEB_BACKUPS_KEY);
    if (!raw) {
      return [];
    }

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

function saveBackupIndex(backups: BackupFileMeta[]): void {
  localStorage.setItem(WEB_BACKUPS_KEY, JSON.stringify(backups));
}

// ─── Pruning ───────────────────────────────────────────────────────────────

function backupContentKey(uri: string): string {
  return `${WEB_BACKUP_DATA_PREFIX}${uri.replace('web-backup://', '')}`;
}

function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

function commitBackupIndex(backups: BackupFileMeta[]): void {
  const keep = backups.slice(0, MAX_BACKUPS);
  const remove = backups.slice(MAX_BACKUPS);

  // Commit the index first. If that fails, every existing indexed recovery point
  // still has its content. Removed payloads become harmless orphans, never broken links.
  saveBackupIndex(keep);
  for (const backup of remove) {
    localStorage.removeItem(backupContentKey(backup.uri));
  }
}

function storeBackupContentWithRecovery(
  uri: string,
  content: string,
  existing: BackupFileMeta[]
): BackupFileMeta[] {
  let retained = existing.filter((backup) => backup.uri !== uri);
  const existingPayload = localStorage.getItem(backupContentKey(uri));

  // The URI is content-addressed. A present matching key already contains this dump,
  // so only its metadata needs to be refreshed.
  if (existingPayload !== null) {
    return retained;
  }

  try {
    localStorage.setItem(backupContentKey(uri), content);
    return retained;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }
  }

  // Keep the newest existing recovery point until the replacement payload exists.
  // Evict older entries one at a time so a failed retry never empties the backup set.
  const protectedUri = retained[0]?.uri;
  while (retained.length > 0) {
    let victimIndex = -1;
    for (let index = retained.length - 1; index >= 0; index--) {
      if (retained[index].uri !== protectedUri) {
        victimIndex = index;
        break;
      }
    }
    if (victimIndex === -1) {
      throw new Error('Web backup quota exceeded while preserving the latest recovery point');
    }

    const victim = retained[victimIndex];
    retained = retained.filter((_, index) => index !== victimIndex);
    saveBackupIndex(retained);
    localStorage.removeItem(backupContentKey(victim.uri));

    try {
      localStorage.setItem(backupContentKey(uri), content);
      return retained;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        throw error;
      }
    }
  }

  throw new Error('Web backup quota exceeded');
}

// ─── Public API (matches preMigrationBackup.ts) ────────────────────────────

export async function deleteBackup(uri: string): Promise<void> {
  const backups = await getStoredBackups();
  const next = backups.filter((b) => b.uri !== uri);
  localStorage.removeItem(backupContentKey(uri));
  saveBackupIndex(next);
}

export async function waitForPreMigrationBackup(): Promise<void> {}

function canCreateWebBackup(): boolean {
  return !isStaticExport && typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

async function executeLiveBackup(reason: BackupFileMeta['reason']): Promise<string> {
  const jsonString = await dumpDatabase();
  const hash = await computeHash(jsonString);
  const uri = `web-backup://${hash}`;
  const createdAt = new Date().toISOString();
  const existing = await getStoredBackups();
  const hadExistingPayload = localStorage.getItem(backupContentKey(uri)) !== null;
  const retained = storeBackupContentWithRecovery(uri, jsonString, existing);
  try {
    commitBackupIndex([
      { uri, createdAt, fromVersion: null, toVersion: null, reason },
      ...retained,
    ]);
  } catch (error) {
    if (!hadExistingPayload) {
      localStorage.removeItem(backupContentKey(uri));
    }
    throw error;
  }
  return hash;
}

/** Create a best-effort backup before restoring a database dump on Web. */
export async function createPreRestoreBackup(): Promise<void> {
  if (!canCreateWebBackup()) {
    return;
  }

  try {
    const hash = await executeLiveBackup('pre-restore');
    console.log(`[WebBackup] Created pre-restore backup (hash: ${hash})`);
  } catch (error) {
    console.error('[WebBackup] Failed to create pre-restore backup:', error);
    handleError(error, 'preMigrationBackup.web.preRestore');
  }
}

/** Create a required backup before retiring the legacy exercise catalogue on Web. */
export async function createPreExerciseCatalogueBackup(): Promise<string> {
  if (!canCreateWebBackup()) {
    throw new Error('Web backup storage is not available');
  }

  try {
    const hash = await executeLiveBackup('exercise-catalogue');
    console.log(`[WebBackup] Created pre-exercise-catalogue backup (hash: ${hash})`);
    return `web-backup://${hash}`;
  } catch (error) {
    console.error('[WebBackup] Failed to create pre-exercise-catalogue backup:', error);
    handleError(error, 'preMigrationBackup.web.preExerciseCatalogue');
    throw error;
  }
}

// ─── Web migration check ───────────────────────────────────────────────────

/**
 * Call once at app startup (before <Migrations> renders) to detect a schema
 * version bump and create a localStorage backup when needed.
 *
 * - Fresh install (no stored version): just records current version, no backup.
 * - Already up-to-date: no-op.
 * - Version bump detected: dumps the database, stores content + metadata.
 */
export async function runWebPreMigrationBackupIfNeeded(): Promise<void> {
  if (isStaticExport || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  let storedVersion: number | null = null;
  try {
    const raw = localStorage.getItem(WEB_LAST_VERSION_KEY);
    storedVersion = raw !== null ? Number(raw) : null;
  } catch {
    // localStorage not accessible (e.g. private browsing with strict settings)
    return;
  }

  // Fresh install — no existing data to back up, just record the version.
  if (storedVersion === null) {
    localStorage.setItem(WEB_LAST_VERSION_KEY, String(CURRENT_DATABASE_VERSION));
    return;
  }

  // Already at the current version — nothing to do.
  if (storedVersion >= CURRENT_DATABASE_VERSION) {
    return;
  }

  const fromVersion = storedVersion;
  const toVersion = CURRENT_DATABASE_VERSION;

  try {
    // dumpDatabase() uses WatermelonDB which internally queues operations
    // until its async setup (including migration) completes, so this is safe
    // to call even if WatermelonDB hasn't fully initialised yet.
    const jsonString = await dumpDatabase();
    const hash = await computeHash(jsonString);
    const createdAt = new Date().toISOString();

    const existing = await getStoredBackups();
    const uri = `web-backup://${hash}`;
    const hadExistingPayload = localStorage.getItem(backupContentKey(uri)) !== null;
    const retained = storeBackupContentWithRecovery(uri, jsonString, existing);
    try {
      commitBackupIndex([
        {
          uri,
          createdAt,
          fromVersion,
          toVersion,
          reason: 'schema-migration',
        },
        ...retained,
      ]);
    } catch (error) {
      if (!hadExistingPayload) {
        localStorage.removeItem(backupContentKey(uri));
      }
      throw error;
    }

    console.log(`[WebBackup] Created backup v${fromVersion}→v${toVersion} (hash: ${hash})`);
  } catch (error) {
    console.error('[WebBackup] Failed to create backup:', error);
    handleError(error, 'preMigrationBackup.web');
  } finally {
    // Always advance the stored version so the backup doesn't run again on
    // the next launch even if the dump above failed.
    try {
      localStorage.setItem(WEB_LAST_VERSION_KEY, String(CURRENT_DATABASE_VERSION));
    } catch {
      // best-effort
    }
  }
}

// ─── AsyncStorage helpers (used by exportDb.web.ts / importDb on web) ─────
// Re-exported so callers that import from preMigrationBackup get them on web.
export { AsyncStorage };
