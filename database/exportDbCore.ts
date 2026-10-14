import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import { RESTORE_ORDER, SETTINGS_EXCLUDED_TYPES } from '@/constants/exportImport';
import { getExportPlatform } from '@/constants/platform';
import { encrypt } from '@/utils/encryption';

import type { AsyncStorageDump } from './asyncStorageBackup';
import { decryptCycleText } from './cyclePayload';
import {
  decryptNumber,
  decryptNutritionLogSnapshotRow,
  decryptOptionalString,
  nutritionLogSnapshotToExportFields,
  readSavedForLaterGroupNote,
} from './encryptionHelpers';

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

// A function that runs raw SQL and returns rows. Inject the WatermelonDB-backed
// runner (rawQueryViaWatermelon) for any live path — never an expo-sqlite
// connection to musclog.db while the app is running (see FIXES.md).
export type RawQueryRunner = (
  sql: string,
  args?: (string | number | boolean | null)[]
) => Promise<Record<string, unknown>[]>;

export type CapturedTableRows = Record<string, Record<string, unknown>[]>;

export type DumpDatabaseOptions = {
  includeDeletedRecords?: boolean;
  /**
   * Keep cycle payloads as this device's ciphertext instead of decrypting them. Set for the
   * automatic on-device recovery points, which are restored on the same device: an unattended
   * JSON copy of a reproductive diary must not sit in the cache folder in plaintext. A user's own
   * export (and a recovery point they choose to download) is decrypted, so it opens anywhere.
   */
  keepCycleCiphertext?: boolean;
  exportVersion?: number;
  // AsyncStorage snapshot to embed as `_async_storage_` in the dump. Absent (or
  // empty) means the dump carries no AsyncStorage section. This module never
  // captures live AsyncStorage itself — callers that want the live state pass
  // `await captureAsyncStorageDump()` explicitly (see exportDb.ts), and snapshot
  // conversions pass their captured sidecar (see sqliteBackupConvert.ts).
  asyncStorageData?: AsyncStorageDump;
};

type DumpRowsOptions = {
  exportVersion?: number;
  keepCycleCiphertext?: boolean;
  asyncStorageData?: AsyncStorageDump;
};

/** SQL to list user tables (excludes SQLite-internal tables). */
export const LIST_USER_TABLES_SQL =
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * SELECT-all for a table. Optionally excludes WatermelonDB tombstones
 * (`_status = 'deleted'`) so restore can't resurrect deleted records.
 */
export function selectAllRowsSql(tableName: string, includeDeletedRecords = true): string {
  const deletedRecordsClause = includeDeletedRecords ? '' : " WHERE _status != 'deleted'";
  return `SELECT * FROM ${quoteIdentifier(tableName)}${deletedRecordsClause};`;
}

const CYCLE_PAYLOAD_TABLES = new Set(['cycle_periods', 'cycle_day_logs', 'cycle_contexts']);

function addAsyncStorageDump(dbData: ExportDump, snapshot?: AsyncStorageDump): void {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return;
  }

  dbData._async_storage_ = snapshot;
}

export async function dumpRowsToJson(
  tableRows: CapturedTableRows,
  encryptionPhrase?: string,
  options: DumpRowsOptions = {}
): Promise<string> {
  const dbData: ExportDump = {
    _exportVersion: options.exportVersion ?? CURRENT_DATABASE_VERSION,
    _exportPlatform: getExportPlatform(),
  };

  for (const tableName of RESTORE_ORDER) {
    const rows = tableRows[tableName];
    if (!rows) {
      continue;
    }

    if (tableName === 'settings') {
      dbData.settings = rows.filter((row) => !SETTINGS_EXCLUDED_TYPES.includes(String(row.type)));
      continue;
    }

    if (tableName === 'user_metrics') {
      const decryptedRows = await Promise.all(
        rows.map(async (row) => {
          const [value, unit] = await Promise.all([
            decryptNumber(row.value as string | undefined),
            decryptOptionalString(row.unit as string | undefined),
          ]);

          return { ...row, value, unit, _decrypted: true };
        })
      );
      dbData.user_metrics = decryptedRows;
      continue;
    }

    if (CYCLE_PAYLOAD_TABLES.has(tableName) || tableName === 'menstrual_cycles') {
      const column = tableName === 'menstrual_cycles' ? 'config' : 'payload';
      // A removed cycle record never leaves the device: restore does not need it, and an export
      // would otherwise carry the text the person deleted.
      const live = rows.filter((row) => row.deleted_at == null);
      if (options.keepCycleCiphertext) {
        dbData[tableName] = live;
        continue;
      }

      dbData[tableName] = await Promise.all(
        live.map(async (row) => {
          const text = await decryptCycleText(row[column] as string | undefined);

          // A value that will not decrypt is exported untouched rather than dropped or corrupted.
          return text == null ? row : { ...row, [column]: text, _decrypted: true };
        })
      );
      continue;
    }

    if (tableName === 'nutrition_logs' || tableName === 'saved_for_later_items') {
      const decryptedRows = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          ...nutritionLogSnapshotToExportFields(await decryptNutritionLogSnapshotRow(row)),
        }))
      );
      dbData[tableName] = decryptedRows;
      continue;
    }

    if (tableName === 'saved_for_later_groups') {
      const decryptedRows = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          note: await readSavedForLaterGroupNote(row),
          _decrypted: true,
        }))
      );

      dbData.saved_for_later_groups = decryptedRows;
      continue;
    }

    dbData[tableName] = rows;
  }

  addAsyncStorageDump(dbData, options.asyncStorageData);

  let jsonString = JSON.stringify(dbData, null, 2);
  if (encryptionPhrase && encryptionPhrase.trim()) {
    jsonString = await encrypt(jsonString, encryptionPhrase.trim());
  }

  return jsonString;
}

export async function dumpDatabaseWithQueryRunner(
  queryRunner: RawQueryRunner,
  encryptionPhrase?: string,
  options: DumpDatabaseOptions = {}
): Promise<string> {
  const includeDeletedRecords = options.includeDeletedRecords ?? true;
  const tableRows = (await queryRunner(LIST_USER_TABLES_SQL)) as { name: string }[];
  const existingTables = new Set(tableRows.map((row) => row.name));
  const capturedRows: CapturedTableRows = {};

  for (const tableName of RESTORE_ORDER) {
    if (!existingTables.has(tableName)) {
      continue;
    }

    capturedRows[tableName] = await queryRunner(selectAllRowsSql(tableName, includeDeletedRecords));
  }

  return dumpRowsToJson(capturedRows, encryptionPhrase, {
    exportVersion: options.exportVersion,
    asyncStorageData: options.asyncStorageData,
    keepCycleCiphertext: options.keepCycleCiphertext,
  });
}

/**
 * A recovery point made with `keepCycleCiphertext`, turned into an ordinary portable export: the
 * cycle payloads are decrypted with this device's key and flagged `_decrypted`, which is what
 * `restoreDatabase` re-encrypts on whichever device imports it. Used when the person downloads a
 * recovery point; rows that will not decrypt stay as they are.
 */
export async function decryptCyclePayloadsInDump(json: string): Promise<string> {
  const dump = JSON.parse(json) as Record<string, unknown>;
  for (const tableName of [...CYCLE_PAYLOAD_TABLES, 'menstrual_cycles']) {
    const rows = dump[tableName];
    if (!Array.isArray(rows)) {
      continue;
    }

    const column = tableName === 'menstrual_cycles' ? 'config' : 'payload';
    dump[tableName] = await Promise.all(
      rows.map(async (row: Record<string, unknown>) => {
        if (row._decrypted === true) {
          return row;
        }

        const text = await decryptCycleText(row[column] as string | undefined);
        return text == null ? row : { ...row, [column]: text, _decrypted: true };
      })
    );
  }

  return JSON.stringify(dump);
}
