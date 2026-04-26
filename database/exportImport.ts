/**
 * Full-database export and import for backup/restore.
 * Single implementation for both web and native; platform-specific file I/O lives in utils/file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENCRYPTION_KEY } from '../constants/database';
import {
  CURRENT_ONBOARDING_VERSION,
  GOOGLE_ACCESS_TOKEN,
  GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
  TEMP_GOOGLE_AUTH_CODE,
  TEMP_GOOGLE_USER_NAME,
  TEMP_NUTRITION_PLAN,
} from '../constants/misc';
import {
  GOOGLE_GEMINI_API_KEY_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
} from '../constants/settings';
import { decrypt, encrypt } from '../utils/encryption';
import { reloadApp } from '../utils/file';
import { database } from './database-instance';
import { encryptNutritionLogSnapshot, encryptUserMetricFields } from './encryptionHelpers';
import type NutritionLog from './models/NutritionLog';
import type UserMetric from './models/UserMetric';

/** AsyncStorage keys that must not be included in the backup (device-specific or session-only). */
const ASYNC_STORAGE_EXCLUDED_KEYS = new Set([
  ENCRYPTION_KEY,
  GOOGLE_ACCESS_TOKEN,
  GOOGLE_ACCESS_TOKEN_EXPIRATION_DATE,
  TEMP_GOOGLE_AUTH_CODE,
  TEMP_GOOGLE_USER_NAME,
  TEMP_NUTRITION_PLAN,
]);

const EXPORT_VERSION = 1;

/** Table names in dependency order for restore (parents before children). */
const RESTORE_ORDER: string[] = [
  // Independent master tables
  'exercises',
  'users',
  'foods',
  'food_portions',
  'supplements',
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
    _exportVersion: EXPORT_VERSION,
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

type IdMap = Record<string, string>;

/**
 * Restore the database from a dump string (full replace).
 * Decrypts with optional phrase, then clears and repopulates tables in dependency order.
 * Re-encrypts user_metrics and nutrition_logs using the current device key.
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

  const idMaps: Record<string, IdMap> = {};
  for (const tableName of RESTORE_ORDER) {
    idMaps[tableName] = {};
  }

  const mapId = (table: string, oldId: string | undefined): string | undefined => {
    if (!oldId) {
      return undefined;
    }
    return idMaps[table]?.[oldId];
  };

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

        if (tableName === 'user_metrics') {
          const value = Number(raw.value);
          const unit = raw.unit != null ? String(raw.unit) : undefined;
          const date = Number(raw.date);
          const timezone = raw.timezone != null ? String(raw.timezone) : '';
          const supplementId = raw.supplement_id != null ? (mapId('supplements', raw.supplement_id as string) ?? raw.supplement_id) : undefined;
          const encrypted = await encryptUserMetricFields({ value, unit: unit ?? '', date });
          const created = await collection.create((rec: any) => {
            rec.type = raw.type;
            rec.supplementId = supplementId;
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
          idMaps[tableName][oldId] = created.id;
          continue;
        }

        if (tableName === 'nutrition_logs') {
          const foodId = mapId('foods', raw.food_id as string) ?? (raw.food_id as string);
          const portionId =
            raw.portion_id != null
              ? (mapId('food_portions', raw.portion_id as string) ?? raw.portion_id)
              : undefined;
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
          const created = await collection.create((rec: any) => {
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
          idMaps[tableName][oldId] = created.id;
          continue;
        }

        const created = await collection.create((rec: any) => {
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
            if (
              key === 'template_id' &&
              (tableName === 'schedules' || tableName === 'workout_logs')
            ) {
              const mapped = mapId('workout_templates', value as string);
              if (mapped != null) {
                (rec as any).templateId = mapped;
              } else {
                (rec as any).templateId = value;
              }
            } else if (key === 'template_exercise_id') {
              const mapped = mapId('workout_template_exercises', value as string);
              if (mapped != null) {
                (rec as any).templateExerciseId = mapped;
              } else {
                (rec as any).templateExerciseId = value;
              }
            } else if (key === 'exercise_id') {
              const mapped = mapId('exercises', value as string);
              if (mapped != null) {
                (rec as any).exerciseId = mapped;
              } else {
                (rec as any).exerciseId = value;
              }
            } else if (key === 'workout_log_id') {
              const mapped = mapId('workout_logs', value as string);
              if (mapped != null) {
                (rec as any).workoutLogId = mapped;
              } else {
                (rec as any).workoutLogId = value;
              }
            } else if (key === 'food_id') {
              const mapped = mapId('foods', value as string);
              if (mapped != null) {
                (rec as any).foodId = mapped;
              } else {
                (rec as any).foodId = value;
              }
            } else if (key === 'food_portion_id') {
              const mapped = mapId('food_portions', value as string);
              if (mapped != null) {
                (rec as any).foodPortionId = mapped;
              } else {
                (rec as any).foodPortionId = value;
              }
            } else if (key === 'meal_id') {
              const mapped = mapId('meals', value as string);
              if (mapped != null) {
                (rec as any).mealId = mapped;
              } else {
                (rec as any).mealId = value;
              }
            } else if (key === 'nutrition_goal_id') {
              const mapped = mapId('nutrition_goals', value as string);
              if (mapped != null) {
                (rec as any).nutritionGoalId = mapped;
              } else {
                (rec as any).nutritionGoalId = value;
              }
            } else if (key === 'user_metric_id') {
              const mapped = mapId('user_metrics', value as string);
              if (mapped != null) {
                (rec as any).userMetricId = mapped;
              } else {
                (rec as any).userMetricId = value;
              }
            } else if (key === 'portion_id') {
              const mapped = mapId('food_portions', value as string);
              (rec as any).portionId = mapped ?? value;
            } else {
              (rec as any)[camel] = value;
            }
          }
        });
        idMaps[tableName][oldId] = created.id;
      }
    });
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
  await reloadApp();
}
