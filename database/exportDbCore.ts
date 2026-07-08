import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import { RESTORE_ORDER, SETTINGS_EXCLUDED_TYPES } from '@/constants/exportImport';
import { getExportPlatform } from '@/constants/platform';
import { encrypt } from '@/utils/encryption';

import { type AsyncStorageDump, captureAsyncStorageDump } from './asyncStorageBackup';
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
// connection to musclog.db while the app is running (see docs/DATABASE_DURABILITY.md).
export type RawQueryRunner = (
  sql: string,
  args?: (string | number | boolean | null)[]
) => Promise<Record<string, unknown>[]>;

export type CapturedTableRows = Record<string, Record<string, unknown>[]>;

export type DumpDatabaseOptions = {
  includeDeletedRecords?: boolean;
  exportVersion?: number;
  asyncStorageData?: AsyncStorageDump | null;
};

type DumpRowsOptions = {
  exportVersion?: number;
  asyncStorageData?: AsyncStorageDump | null;
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

async function addAsyncStorageDump(
  dbData: ExportDump,
  snapshot?: AsyncStorageDump | null
): Promise<void> {
  if (snapshot === null) {
    return;
  }

  const asyncStorageData = snapshot ?? (await captureAsyncStorageDump());
  if (Object.keys(asyncStorageData).length === 0) {
    return;
  }

  dbData._async_storage_ = asyncStorageData;
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

  await addAsyncStorageDump(dbData, options.asyncStorageData);

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
  });
}
