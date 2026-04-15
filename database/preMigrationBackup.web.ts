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
import { isStaticExport } from '@/constants/platform';
import { handleError } from '@/utils/handleError';

import { dumpDatabase } from './exportDb';
import type { BackupFileMeta } from './preMigrationBackup';

export type { BackupFileMeta };

const WEB_BACKUPS_KEY = 'musclog_pre_migration_backups_v1';
const WEB_BACKUP_DATA_PREFIX = 'musclog_backup_data_';
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

function pruneOldBackups(backups: BackupFileMeta[]): BackupFileMeta[] {
  if (backups.length <= MAX_BACKUPS) {
    return backups;
  }

  const keep = backups.slice(0, MAX_BACKUPS);
  const remove = backups.slice(MAX_BACKUPS);

  for (const b of remove) {
    const hash = b.uri.replace('web-backup://', '');
    localStorage.removeItem(`${WEB_BACKUP_DATA_PREFIX}${hash}`);
  }

  return keep;
}

// ─── Public API (matches preMigrationBackup.ts) ────────────────────────────

export async function deleteBackup(uri: string): Promise<void> {
  const backups = await getStoredBackups();
  const next = backups.filter((b) => b.uri !== uri);
  const hash = uri.replace('web-backup://', '');
  localStorage.removeItem(`${WEB_BACKUP_DATA_PREFIX}${hash}`);
  saveBackupIndex(next);
}

/**
 * No-op on web: LokiJS adapter has no migrationEvents hooks.
 * Use runWebPreMigrationBackupIfNeeded() instead.
 */
export async function createPreMigrationBackup(_event?: unknown): Promise<void> {}

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

    // Store content — handle QuotaExceededError by clearing older backups first.
    try {
      localStorage.setItem(`${WEB_BACKUP_DATA_PREFIX}${hash}`, jsonString);
    } catch {
      console.warn('[WebBackup] localStorage quota exceeded, clearing old backups before retry');
      const existing = await getStoredBackups();
      for (const b of existing) {
        const h = b.uri.replace('web-backup://', '');
        localStorage.removeItem(`${WEB_BACKUP_DATA_PREFIX}${h}`);
      }
      localStorage.removeItem(WEB_BACKUPS_KEY);
      localStorage.setItem(`${WEB_BACKUP_DATA_PREFIX}${hash}`, jsonString);
    }

    // Update metadata index.
    const existing = await getStoredBackups();
    const next = pruneOldBackups([
      { uri: `web-backup://${hash}`, createdAt, fromVersion, toVersion },
      ...existing,
    ]);
    saveBackupIndex(next);

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
