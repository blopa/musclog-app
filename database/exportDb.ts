import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import {
  ASYNC_STORAGE_EXCLUDED_KEYS,
  ASYNC_STORAGE_EXCLUDED_PREFIXES,
  RESTORE_ORDER,
  SETTINGS_EXCLUDED_TYPES,
} from '@/constants/exportImport';
import { getExportPlatform } from '@/constants/platform';
import { encrypt } from '@/utils/encryption';
import { handleError } from '@/utils/handleError';

import { decryptJson, decryptNumber, decryptOptionalString } from './encryptionHelpers';
import { type RawQueryRunner, rawQueryViaWatermelon } from './wmdbRaw';

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

type DumpDatabaseOptions = {
  includeDeletedRecords?: boolean;
  /**
   * How table rows are read. Defaults to WatermelonDB's own connection, which
   * is the only safe option while the app is running (a second SQLite library
   * closing its connection unlinks the WAL — see wmdbRaw.ts). Only the
   * pre-migration backup passes an expo-sqlite runner, because WatermelonDB
   * cannot serve queries mid-migration; that caller owns the connection and
   * its close.
   */
  queryRunner?: RawQueryRunner;
};

/**
 * Dump the entire database to a JSON-serializable object using raw SQL against
 * whatever tables actually exist (schema-independent), executed through
 * WatermelonDB's own connection by default.
 * Encrypted fields in user_metrics, nutrition_logs, saved_for_later_groups and
 * saved_for_later_items are exported decrypted so the backup is device-independent.
 * API key settings are excluded.
 */
export async function dumpDatabase(
  encryptionPhrase?: string,
  options: DumpDatabaseOptions = {}
): Promise<string> {
  const includeDeletedRecords = options.includeDeletedRecords ?? true;
  const runQuery = options.queryRunner ?? rawQueryViaWatermelon;

  try {
    // Discover tables that actually exist — essential when called pre-migration,
    // where new tables added by the pending migration don't exist yet.
    const tableRows = (await runQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    )) as { name: string }[];
    const existingTables = new Set(tableRows.map((r) => r.name));

    const dbData: ExportDump = {
      _exportVersion: CURRENT_DATABASE_VERSION,
      _exportPlatform: getExportPlatform(),
    };

    for (const tableName of RESTORE_ORDER) {
      if (!existingTables.has(tableName)) {
        continue;
      }

      // Optionally include WatermelonDB-internal deleted rows (`_status = 'deleted'`)
      // so exports can be used to investigate data that disappeared from normal
      // queries. Restore skips those rows to avoid resurrecting deleted records.
      const deletedRecordsClause = includeDeletedRecords ? '' : " WHERE _status != 'deleted'";
      const rows = await runQuery(
        `SELECT * FROM ${quoteIdentifier(tableName)}${deletedRecordsClause};`
      );

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
          rows.map(async (row) => {
            const [
              logged_food_name,
              logged_calories,
              logged_protein,
              logged_carbs,
              logged_fat,
              logged_fiber,
              micros,
            ] = await Promise.all([
              decryptOptionalString(row.logged_food_name as string | undefined),
              decryptNumber(row.logged_calories as string | undefined),
              decryptNumber(row.logged_protein as string | undefined),
              decryptNumber(row.logged_carbs as string | undefined),
              decryptNumber(row.logged_fat as string | undefined),
              decryptNumber(row.logged_fiber as string | undefined),
              decryptJson(row.logged_micros_json as string | undefined),
            ]);
            return {
              ...row,
              logged_food_name: logged_food_name ?? '',
              logged_calories,
              logged_protein,
              logged_carbs,
              logged_fat,
              logged_fiber,
              logged_micros_json: Object.keys(micros).length > 0 ? JSON.stringify(micros) : '',
              _decrypted: true,
            };
          })
        );
        dbData[tableName] = decryptedRows;
        continue;
      }

      if (tableName === 'saved_for_later_groups') {
        const decryptedRows = await Promise.all(
          rows.map(async (row) => ({
            ...row,
            note: (await decryptOptionalString(row.note as string | undefined)) || '',
            _decrypted: true,
          }))
        );

        dbData.saved_for_later_groups = decryptedRows;
        continue;
      }

      dbData[tableName] = rows;
    }

    // Dump AsyncStorage (exclude device-specific and session-only keys)
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToBackup = allKeys.filter(
      (k) =>
        !ASYNC_STORAGE_EXCLUDED_KEYS.has(k) &&
        !ASYNC_STORAGE_EXCLUDED_PREFIXES.some((p) => k.startsWith(p))
    );

    if (keysToBackup.length > 0) {
      const pairs = await AsyncStorage.multiGet(keysToBackup);
      const asyncStorageData: Record<string, string | null> = {};
      for (const [key, value] of pairs) {
        asyncStorageData[key] = value;
      }

      dbData._async_storage_ = asyncStorageData;
    }

    let jsonString = JSON.stringify(dbData, null, 2);
    if (encryptionPhrase && encryptionPhrase.trim()) {
      jsonString = await encrypt(jsonString, encryptionPhrase.trim());
    }

    return jsonString;
  } catch (err) {
    await handleError(err, 'dumpDatabase');
    throw err;
  }
}
