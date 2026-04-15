import AsyncStorage from '@react-native-async-storage/async-storage';

import { ASYNC_STORAGE_EXCLUDED_KEYS, RESTORE_ORDER } from '@/constants/exportImport';
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
} from '@/constants/misc';
import { reloadApp } from '@/utils/app';
import { decrypt } from '@/utils/encryption';
import { captureException } from '@/utils/sentry';
import { parseWorkoutInsightsType } from '@/utils/workoutInsightsType';

import { database } from './database-instance';
import { encryptNutritionLogSnapshot, encryptUserMetricFields } from './encryptionHelpers';
import { validateExportDump, type ValidationResult } from './schemaToZod';
import { ExerciseService, FoodPortionService } from './services';

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

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

  const parsed = JSON.parse(jsonString);

  // Validate the export data against schema (generated from WatermelonDB schema)
  const validationResult: ValidationResult = validateExportDump(parsed);

  if (!validationResult.success) {
    const details = validationResult.details;
    const errorMessage = `Export validation failed with ${details.length} error(s):\n${details.slice(0, 10).join('\n')}${details.length > 10 ? '\n...and more' : ''}`;

    captureException(new Error(errorMessage), {
      data: {
        validationErrors: details.slice(0, 20),
        totalErrors: details.length,
      },
    });

    throw new Error(errorMessage);
  }

  const dbData: ExportDump = validationResult.data as ExportDump;

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

  // Phase 1: Prepare create operations and collect existing records to delete.
  // Reads and async encryption happen here so the write blocks stay synchronous-safe.
  const createOperations: any[] = [];
  const recordsToDelete: any[] = [];

  for (const tableName of RESTORE_ORDER) {
    const collection = database.get(tableName as any);

    // Collect all existing records for deletion (will delete in separate transaction)
    const existing = await collection.query().fetch();
    recordsToDelete.push(...existing);

    // Access table data using type assertion since tableName is dynamic
    const rows = (dbData as Record<string, unknown>)[tableName];
    if (!Array.isArray(rows)) {
      continue;
    }

    for (const row of rows) {
      const raw = { ...(row as Record<string, unknown>) };
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
        const unit = raw.unit != null ? String(raw.unit) : '';
        const date = Number(raw.date);
        const timezone = raw.timezone != null ? String(raw.timezone) : '';
        const encrypted = await encryptUserMetricFields({ value, unit, date });
        createOperations.push(
          collection.prepareCreate((rec: any) => {
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
          })
        );
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
        createOperations.push(
          collection.prepareCreate((rec: any) => {
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
          })
        );
        continue;
      }

      createOperations.push(
        collection.prepareCreate((rec: any) => {
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

            const camel = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
            (rec as any)[camel] = value;
          }
        })
      );
    }
  }

  // Phase 2: First delete all existing records to free up IDs
  if (recordsToDelete.length > 0) {
    await database.write(async () => {
      await database.batch(...recordsToDelete.map((r) => r.prepareDestroyPermanently()));
    });
  }

  // Phase 3: Then create all new records with the freed-up IDs
  if (createOperations.length > 0) {
    await database.write(async () => {
      await database.batch(...createOperations);
    });
  }

  // Backfill exercises.source for backups created before export version 2 (when
  // the source column didn't exist yet). Safe no-op if all rows already have a value.
  if (dbData._exportVersion < 2) {
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
  await reloadApp();
}
