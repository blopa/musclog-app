import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import {
  ASYNC_STORAGE_EXCLUDED_KEYS,
  RESTORE_ORDER,
  SETTINGS_EXCLUDED_TYPES,
} from '@/constants/exportImport';
import { encrypt } from '@/utils/encryption';

import { database } from './database-instance';
import type NutritionLog from './models/NutritionLog';
import type UserMetric from './models/UserMetric';

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

function getRawRow(record: { _raw?: unknown }): Record<string, unknown> {
  const raw = (record as { _raw?: Record<string, unknown> })._raw;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return { ...raw };
}

/**
 * Dump the entire database to a JSON-serializable object.
 * Encrypted fields in user_metrics and nutrition_logs are exported decrypted so the backup is device-independent.
 * API key settings are excluded.
 */
export async function dumpDatabase(encryptionPhrase?: string): Promise<string> {
  const dbData: ExportDump = {
    _exportVersion: CURRENT_DATABASE_VERSION,
  };

  for (const tableName of RESTORE_ORDER) {
    const collection = database.get(tableName as any);
    const records = await collection.query().fetch();

    if (tableName === 'settings') {
      const rows = records as { _raw?: Record<string, unknown>; type?: string }[];
      dbData.settings = rows
        .filter((r) => {
          const raw = r._raw ?? r;
          const type = (raw as Record<string, unknown>).type;
          return !SETTINGS_EXCLUDED_TYPES.includes(String(type));
        })
        .map((r) => getRawRow(r));
      continue;
    }

    if (tableName === 'user_metrics') {
      const rows: Record<string, unknown>[] = [];
      for (const record of records as UserMetric[]) {
        const raw = getRawRow(record);
        const decrypted = await record.getDecrypted();
        const row: Record<string, unknown> = {
          ...raw,
          value: decrypted.value,
          unit: decrypted.unit ?? '',
          _decrypted: true,
        };
        delete (row as Record<string, unknown>).valueRaw;
        delete (row as Record<string, unknown>).unitRaw;
        rows.push(row);
      }
      dbData.user_metrics = rows;
      continue;
    }

    if (tableName === 'nutrition_logs') {
      const rows: Record<string, unknown>[] = [];
      for (const record of records as NutritionLog[]) {
        const raw = getRawRow(record);
        const snapshot = await record.getDecryptedSnapshot();
        const row: Record<string, unknown> = {
          ...raw,
          logged_food_name: snapshot.loggedFoodName ?? '',
          logged_calories: snapshot.loggedCalories,
          logged_protein: snapshot.loggedProtein,
          logged_carbs: snapshot.loggedCarbs,
          logged_fat: snapshot.loggedFat,
          logged_fiber: snapshot.loggedFiber,
          logged_micros_json: snapshot.loggedMicros ? JSON.stringify(snapshot.loggedMicros) : '',
          _decrypted: true,
        };
        delete (row as Record<string, unknown>).loggedFoodNameRaw;
        delete (row as Record<string, unknown>).loggedCaloriesRaw;
        delete (row as Record<string, unknown>).loggedProteinRaw;
        delete (row as Record<string, unknown>).loggedCarbsRaw;
        delete (row as Record<string, unknown>).loggedFatRaw;
        delete (row as Record<string, unknown>).loggedFiberRaw;
        delete (row as Record<string, unknown>).loggedMicrosRaw;
        rows.push(row);
      }
      dbData.nutrition_logs = rows;
      continue;
    }

    dbData[tableName] = records.map((r) => getRawRow(r));
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
