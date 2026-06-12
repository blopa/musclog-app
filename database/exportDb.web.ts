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

import { database } from './database-instance';
import { decryptJson, decryptNumber, decryptOptionalString } from './encryptionHelpers';

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

type DumpDatabaseOptions = {
  includeDeletedRecords?: boolean;
};

function getRawRow(record: { _raw?: unknown }): Record<string, unknown> {
  const raw = (record as { _raw?: Record<string, unknown> })._raw;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return { ...raw };
}

function stripLokiMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const raw = { ...row };
  delete raw.$loki;
  delete raw.meta;
  return raw;
}

function getRawRowsFromLoki(tableName: string): Record<string, unknown>[] | null {
  const adapter = database.adapter as any;
  const loki = adapter?.underlyingAdapter?._driver?.loki ?? adapter?._driver?.loki;
  const collection = loki?.getCollection?.(tableName);

  if (!collection?.data) {
    return null;
  }

  return collection.data.map((row: Record<string, unknown>) => stripLokiMetadata(row));
}

/**
 * Dump the entire database to a JSON-serializable object.
 * Encrypted fields in user_metrics, nutrition_logs, saved_for_later_groups and
 * saved_for_later_items are exported decrypted so the backup is device-independent.
 * API key settings are excluded.
 */
export async function dumpDatabase(
  encryptionPhrase?: string,
  options: DumpDatabaseOptions = {}
): Promise<string> {
  const includeDeletedRecords = options.includeDeletedRecords ?? true;
  const dbData: ExportDump = {
    _exportVersion: CURRENT_DATABASE_VERSION,
    _exportPlatform: getExportPlatform(),
  };

  for (const tableName of RESTORE_ORDER) {
    const collection = database.get(tableName as any);
    const records = await collection.query().fetch();
    // WatermelonDB's query API filters out internal tombstones (`_status = 'deleted'`).
    // When requested, read Loki directly so exports can preserve those rows.
    const rows = includeDeletedRecords
      ? (getRawRowsFromLoki(tableName) ?? records.map((r) => getRawRow(r)))
      : records.map((r) => getRawRow(r));

    if (tableName === 'settings') {
      dbData.settings = rows.filter((row) => !SETTINGS_EXCLUDED_TYPES.includes(String(row.type)));
      continue;
    }

    if (tableName === 'user_metrics') {
      const decryptedRows: Record<string, unknown>[] = [];
      for (const raw of rows) {
        const [value, unit] = await Promise.all([
          decryptNumber(raw.value as string | undefined),
          decryptOptionalString(raw.unit as string | undefined),
        ]);
        const row: Record<string, unknown> = {
          ...raw,
          value,
          unit: unit ?? '',
          _decrypted: true,
        };
        decryptedRows.push(row);
      }
      dbData.user_metrics = decryptedRows;
      continue;
    }

    if (tableName === 'nutrition_logs' || tableName === 'saved_for_later_items') {
      const decryptedRows: Record<string, unknown>[] = [];
      for (const raw of rows) {
        const [
          logged_food_name,
          logged_calories,
          logged_protein,
          logged_carbs,
          logged_fat,
          logged_fiber,
          micros,
        ] = await Promise.all([
          decryptOptionalString(raw.logged_food_name as string | undefined),
          decryptNumber(raw.logged_calories as string | undefined),
          decryptNumber(raw.logged_protein as string | undefined),
          decryptNumber(raw.logged_carbs as string | undefined),
          decryptNumber(raw.logged_fat as string | undefined),
          decryptNumber(raw.logged_fiber as string | undefined),
          decryptJson(raw.logged_micros_json as string | undefined),
        ]);
        const row: Record<string, unknown> = {
          ...raw,
          logged_food_name: logged_food_name ?? '',
          logged_calories,
          logged_protein,
          logged_carbs,
          logged_fat,
          logged_fiber,
          logged_micros_json: Object.keys(micros).length > 0 ? JSON.stringify(micros) : '',
          _decrypted: true,
        };
        decryptedRows.push(row);
      }
      dbData[tableName] = decryptedRows;
      continue;
    }

    if (tableName === 'saved_for_later_groups') {
      const decryptedRows: Record<string, unknown>[] = [];
      for (const raw of rows) {
        decryptedRows.push({
          ...raw,
          note: (await decryptOptionalString(raw.note as string | undefined)) || '',
          _decrypted: true,
        });
      }

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
}
