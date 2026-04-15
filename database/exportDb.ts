import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import {
  ASYNC_STORAGE_EXCLUDED_KEYS,
  RESTORE_ORDER,
  SETTINGS_EXCLUDED_TYPES,
} from '@/constants/exportImport';
import { encrypt } from '@/utils/encryption';

import { decryptJson, decryptNumber, decryptOptionalString } from './encryptionHelpers';

const DATABASE_NAME = 'musclog';

/**
 * Returns the directory where WatermelonDB's JSI adapter stores its database file.
 *
 * WatermelonDB does NOT use expo-sqlite's default directory. Its native path logic is:
 *   Android (JSIInstaller.java): context.getDatabasePath(name+".db").getPath().replace("/databases","")
 *             → <appDataRoot>/musclog.db  (i.e. one level above expo-sqlite's files/SQLite/)
 *   iOS (DatabasePlatformIOS.mm): NSDocumentDirectory/name.db
 *             → <Documents>/musclog.db  (expo-sqlite would use <Documents>/SQLite/musclog)
 *
 * The database filename is always `${DATABASE_NAME}.db` (WatermelonDB appends ".db" itself).
 */
function wdbDir(): string {
  // documentDirectory:  Android → 'file:///data/user/0/<pkg>/files/'
  //                     iOS    → 'file:///var/mobile/.../Documents/'
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  // Android: WatermelonDB stores in the app-data root (parent of 'files/')
  // iOS:     WatermelonDB stores directly in Documents (same dir, no SQLite/ subdir)
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

/**
 * Dump the entire database to a JSON-serializable object using a raw SQLite connection.
 * This avoids going through the WatermelonDB singleton, making it safe to call before
 * or during WatermelonDB migrations (e.g. from preMigrationBackup).
 * Encrypted fields in user_metrics and nutrition_logs are exported decrypted so the backup
 * is device-independent. API key settings are excluded.
 */
export async function dumpDatabase(encryptionPhrase?: string): Promise<string> {
  const db = openDatabaseSync(`${DATABASE_NAME}.db`, { useNewConnection: true }, wdbDir());

  // Discover tables that actually exist — essential when called pre-migration,
  // where new tables added by the pending migration don't exist yet.
  const tableRows = (await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  )) as { name: string }[];
  const existingTables = new Set(tableRows.map((r) => r.name));

  const dbData: ExportDump = {
    _exportVersion: CURRENT_DATABASE_VERSION,
  };

  for (const tableName of RESTORE_ORDER) {
    if (!existingTables.has(tableName)) {
      continue;
    }

    // _status = 'deleted' are WatermelonDB soft-deleted rows; exclude them to match
    // what collection.query().fetch() returns.
    const rows = (await db.getAllAsync(
      `SELECT * FROM ${quoteIdentifier(tableName)} WHERE _status != 'deleted';`
    )) as Record<string, unknown>[];

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

    if (tableName === 'nutrition_logs') {
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
      dbData.nutrition_logs = decryptedRows;
      continue;
    }

    dbData[tableName] = rows;
  }

  // Dump AsyncStorage (exclude device-specific and session-only keys)
  const allKeys = await AsyncStorage.getAllKeys();
  const keysToBackup = allKeys.filter((k) => !ASYNC_STORAGE_EXCLUDED_KEYS.has(k));

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
}
