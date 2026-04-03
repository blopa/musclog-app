/**
 * Full-database export and import for backup/restore.
 * Single implementation for both web and native; platform-specific file I/O lives in utils/file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CURRENT_DATABASE_VERSION, ENCRYPTION_KEY } from '../constants/database';
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
  TEMP_NUTRITION_PLAN,
} from '../constants/misc';
import {
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
} from '../constants/settings';
import { decrypt, encrypt } from '../utils/encryption';
import { parseWorkoutInsightsType } from '../utils/workoutInsightsType';
import { database } from './database-instance';
import { encryptNutritionLogSnapshot, encryptUserMetricFields } from './encryptionHelpers';
import type NutritionLog from './models/NutritionLog';
import type UserMetric from './models/UserMetric';
import { FoodPortionService } from './services';

/** AsyncStorage keys that must not be included in the backup (device-specific or session-only). */
const ASYNC_STORAGE_EXCLUDED_KEYS = new Set([ENCRYPTION_KEY, TEMP_NUTRITION_PLAN]);

/** Table names in dependency order for restore (parents before children). */
const RESTORE_ORDER: string[] = [
  // Independent master tables
  'exercises',
  'users',
  'foods',
  'food_portions',
  'meals',
  'workout_templates',
  'settings',

  // Template-dependent tables
  'schedules',
  'workout_template_exercises',
  'workout_template_sets',

  // Food/Meal junction tables
  'food_food_portions',
  'meal_foods',

  // Goal and tracking tables
  'nutrition_goals',
  'nutrition_checkins',
  'menstrual_cycles',

  // Log tables (depend on templates and master data)
  'workout_logs',
  'workout_log_exercises',
  'workout_log_sets',
  'nutrition_logs',
  'user_metrics',
  'user_metrics_notes',

  // Chat messages (independent)
  'chat_messages',

  // AI custom prompts (independent)
  'ai_custom_prompts',
];

const SETTINGS_EXCLUDED_TYPES = [GOOGLE_GEMINI_API_KEY_SETTING_TYPE, OPENAI_API_KEY_SETTING_TYPE];

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

/**
 * Restore the database from a dump string (full replace).
 * Decrypts with optional phrase, then clears and repopulates tables in dependency order.
 * Re-encrypts user_metrics and nutrition_logs using the current device key.
 * Original record IDs from the backup are preserved exactly.
 */
export async function restoreDatabase(dump: string, decryptionPhrase?: string): Promise<void> {
  let jsonString = dump;
  if (decryptionPhrase && decryptionPhrase.trim()) {
    jsonString = await decrypt(jsonString, decryptionPhrase.trim());
  }

  const dbData = JSON.parse(jsonString) as ExportDump;
  if (typeof dbData._exportVersion !== 'number') {
    throw new Error('Invalid export file: missing _exportVersion');
  }

  // Only clear AsyncStorage if the imported data contains async storage data
  const asyncStorageData = dbData._async_storage_;
  if (asyncStorageData && typeof asyncStorageData === 'object') {
    // Preserve all device-specific/session keys before wiping AsyncStorage
    const excludedKeysList = [...ASYNC_STORAGE_EXCLUDED_KEYS];
    const preservedPairs = await AsyncStorage.multiGet(excludedKeysList);
    await AsyncStorage.clear();
    const toRestore = preservedPairs.filter(([, v]) => v != null) as [string, string][];
    if (toRestore.length > 0) {
      await AsyncStorage.multiSet(toRestore);
    }
  }

  const parseMicrosJson = (microsJson: string): any | undefined => {
    try {
      const parsed = JSON.parse(microsJson);
      return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  for (const tableName of RESTORE_ORDER) {
    const rows = dbData[tableName];
    if (!Array.isArray(rows)) {
      continue;
    }

    const collection = database.get(tableName as any);

    await database.write(async () => {
      const existing = await collection.query().fetch();
      await Promise.all(existing.map((r) => r.destroyPermanently()));

      for (const row of rows) {
        const raw = row as Record<string, unknown>;
        const oldId = raw.id as string | undefined;
        if (!oldId) {
          continue;
        }

        if (tableName === 'workout_templates') {
          const newVal = raw.workout_insights_type;
          const oldVal = raw.volume_calculation_type ?? raw.volumeCalculationType;

          if (newVal != null) {
            raw.workout_insights_type = parseWorkoutInsightsType(String(newVal));
          } else if (oldVal != null) {
            raw.workout_insights_type = parseWorkoutInsightsType(String(oldVal));
          }

          delete raw.volume_calculation_type;
          delete raw.volumeCalculationType;
        }

        if (tableName === 'user_metrics') {
          const value = Number(raw.value);
          const unit = raw.unit != null ? String(raw.unit) : undefined;
          const date = Number(raw.date);
          const timezone = raw.timezone != null ? String(raw.timezone) : '';
          const encrypted = await encryptUserMetricFields({ value, unit: unit ?? '', date });
          await collection.create((rec: any) => {
            rec._raw.id = oldId;
            rec.type = raw.type;
            rec.valueRaw = encrypted.value;
            rec.unitRaw = encrypted.unit;
            rec.date = date;
            rec.timezone = timezone;
            rec.createdAt = Number(raw.created_at);
            rec.updatedAt = Number(raw.updated_at);
            if (raw.deleted_at != null) {
              rec.deletedAt = Number(raw.deleted_at);
            }
          });
          continue;
        }

        if (tableName === 'nutrition_logs') {
          const foodId = raw.food_id as string;
          const portionId = raw.portion_id != null ? (raw.portion_id as string) : undefined;
          const snapshot = {
            loggedFoodName: raw.logged_food_name != null ? String(raw.logged_food_name) : undefined,
            loggedCalories: Number(raw.logged_calories ?? 0),
            loggedProtein: Number(raw.logged_protein ?? 0),
            loggedCarbs: Number(raw.logged_carbs ?? 0),
            loggedFat: Number(raw.logged_fat ?? 0),
            loggedFiber: Number(raw.logged_fiber ?? 0),
            loggedMicros:
              typeof raw.logged_micros_json === 'string' && raw.logged_micros_json
                ? parseMicrosJson(raw.logged_micros_json)
                : undefined,
          };
          const encrypted = await encryptNutritionLogSnapshot(snapshot);
          await collection.create((rec: any) => {
            rec._raw.id = oldId;
            rec.foodId = foodId;
            rec.type = raw.type;
            rec.amount = Number(raw.amount);
            rec.portionId = portionId;
            rec.loggedFoodNameRaw = encrypted.loggedFoodName;
            rec.loggedCaloriesRaw = encrypted.loggedCalories;
            rec.loggedProteinRaw = encrypted.loggedProtein;
            rec.loggedCarbsRaw = encrypted.loggedCarbs;
            rec.loggedFatRaw = encrypted.loggedFat;
            rec.loggedFiberRaw = encrypted.loggedFiber;
            rec.loggedMicrosRaw = encrypted.loggedMicrosJson;
            rec.date = Number(raw.date);
            rec.createdAt = Number(raw.created_at);
            rec.updatedAt = Number(raw.updated_at);
            if (raw.deleted_at != null) {
              rec.deletedAt = Number(raw.deleted_at);
            }
          });
          continue;
        }

        await collection.create((rec: any) => {
          rec._raw.id = oldId;

          if (tableName === 'nutrition_checkins' && dbData._exportVersion < 2) {
            rec.completed = false;
          }

          for (const key of Object.keys(raw)) {
            if (key === 'id' || key === '_decrypted') {
              continue;
            }
            const value = raw[key];
            if (value === undefined) {
              continue;
            }
            const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            (rec as any)[camel] = value;
          }
        });
      }
    });
  }

  // Backfill exercises.source for backups created before export version 2 (when
  // the source column didn't exist yet). Safe no-op if all rows already have a value.
  if (dbData._exportVersion < 2) {
    const { ExerciseService } = await import('./services/ExerciseService');
    await ExerciseService.backfillExerciseSources();
  }

  // Backfill food_portions.source for backups created before export version 3 (when
  // the source column didn't exist yet). Safe no-op if all rows already have a value.
  if (dbData._exportVersion < 3) {
    await FoodPortionService.backfillPortionSources();

    // Backups before export version 4 stored totalVolume using the old reps×weight
    // formula. Reset all values to NULL so the boot-time backfill in _layout.tsx
    // recalculates everything with the new average-1RM formula after the app reloads.
    const workoutLogs = await database.get('workout_logs').query().fetch();
    if (workoutLogs.length > 0) {
      const now = Date.now();
      await database.write(async () => {
        await database.batch(
          ...workoutLogs.map((log: any) =>
            log.prepareUpdate((l: any) => {
              l.totalVolume = null;
              l.updatedAt = now;
            })
          )
        );
      });
    }
  }

  // Restore AsyncStorage values from the backup (only if async storage data was included in import)
  if (asyncStorageData && typeof asyncStorageData === 'object') {
    const pairs: [string, string][] = Object.entries(
      asyncStorageData as Record<string, string | null>
    )
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, value as string]);
    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }
  } else {
    // If no async storage data was imported, set onboarding as completed
    await AsyncStorage.multiSet([
      [ONBOARDING_COMPLETED, 'true'],
      // TODO: we might not want to force it to be the current version
      [ONBOARDING_VERSION, CURRENT_ONBOARDING_VERSION],
    ]);
  }

  // Reload the app after importing is complete
  const { reloadApp } = await import('../utils/file');
  await reloadApp();
}
