import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { ASYNC_STORAGE_EXCLUDED_KEYS, RESTORE_ORDER } from '@/constants/exportImport';
import {
  CURRENT_ONBOARDING_VERSION,
  ONBOARDING_COMPLETED,
  ONBOARDING_VERSION,
} from '@/constants/misc';
import { getExportPlatform, isSameExportPlatform } from '@/constants/platform';
import { UNITS_SETTING_TYPE } from '@/constants/settings';
import { reloadApp } from '@/utils/app';
import { decrypt } from '@/utils/encryption';
import { handleError } from '@/utils/handleError';
import { normalizeTimezoneToOffset } from '@/utils/timezone';
import { parseWorkoutInsightsType } from '@/utils/workoutInsightsType';

import { database } from './database-instance';
import { updateNutritionLogCountBaseline } from './dbDurability';
import {
  decryptNutritionLogSnapshotRow,
  encryptNutritionLogSnapshot,
  encryptOptionalString,
  encryptUserMetricFields,
  type NutritionLogSnapshotPlain,
  readPlainNutritionLogSnapshotRow,
  readSavedForLaterGroupNote,
} from './encryptionHelpers';
import { createPreRestoreBackup } from './preMigrationBackup';
import { validateExportDump, type ValidationResult } from './schemaToZod';
import { ExerciseService, FoodPortionService, MuscleService } from './services';

export type ExportDump = {
  _exportVersion: number;
  [tableName: string]: unknown;
};

type ImportRow = Record<string, unknown>;

const ZERO_NUTRITION_LOG_SNAPSHOT: NutritionLogSnapshotPlain = {
  loggedCalories: 0,
  loggedProtein: 0,
  loggedCarbs: 0,
  loggedFat: 0,
  loggedFiber: 0,
};

async function prepareSavedForLaterGroupCreate(
  collection: any,
  raw: ImportRow,
  oldId: string
): Promise<any> {
  let notePlain: string | undefined;
  try {
    notePlain = (await readSavedForLaterGroupNote(raw)) || undefined;
  } catch {
    notePlain = undefined;
  }

  const noteRaw = await encryptOptionalString(notePlain);
  return collection.prepareCreate((rec: any) => {
    rec._raw.id = oldId;
    rec.name = String(raw.name ?? '');
    rec.noteRaw = noteRaw || undefined;
    rec.originalMealType = String(raw.original_meal_type ?? 'other');
    rec.originalDate = Number(raw.original_date);
    rec.timezone = raw.timezone != null ? String(raw.timezone) : undefined;
    rec.createdAt = Number(raw.created_at);
    rec.updatedAt = Number(raw.updated_at);
    if (raw.deleted_at != null) {
      rec.deletedAt = Number(raw.deleted_at);
    }
  });
}

async function readSavedForLaterItemSnapshot(raw: ImportRow): Promise<NutritionLogSnapshotPlain> {
  if (raw._decrypted === true) {
    return readPlainNutritionLogSnapshotRow(raw);
  }

  try {
    return await decryptNutritionLogSnapshotRow(raw);
  } catch {
    return ZERO_NUTRITION_LOG_SNAPSHOT;
  }
}

async function prepareSavedForLaterItemCreate(
  collection: any,
  raw: ImportRow,
  oldId: string
): Promise<any> {
  const snapshot = await readSavedForLaterItemSnapshot(raw);
  const encrypted = await encryptNutritionLogSnapshot(snapshot);
  return collection.prepareCreate((rec: any) => {
    rec._raw.id = oldId;
    rec.groupId = String(raw.group_id ?? '');
    if (raw.food_id != null) {
      rec.foodId = String(raw.food_id);
    }
    rec.amount = Number(raw.amount);
    if (raw.portion_id != null) {
      rec.portionId = String(raw.portion_id);
    }
    rec.loggedFoodNameRaw = encrypted.loggedFoodName;
    rec.loggedCaloriesRaw = encrypted.loggedCalories;
    rec.loggedProteinRaw = encrypted.loggedProtein;
    rec.loggedCarbsRaw = encrypted.loggedCarbs;
    rec.loggedFatRaw = encrypted.loggedFat;
    rec.loggedFiberRaw = encrypted.loggedFiber;
    rec.loggedMicrosRaw = encrypted.loggedMicrosJson;
    if (raw.logged_meal_name != null) {
      rec.loggedMealName = String(raw.logged_meal_name);
    }
    if (raw.original_group_id != null) {
      rec.originalGroupId = String(raw.original_group_id);
    }
    rec.createdAt = Number(raw.created_at);
    rec.updatedAt = Number(raw.updated_at);
    if (raw.deleted_at != null) {
      rec.deletedAt = Number(raw.deleted_at);
    }
  });
}

/**
 * Restore the database from a dump string (full replace).
 * Decrypts with optional phrase, then clears and repopulates tables in dependency order.
 * Re-encrypts user_metrics, nutrition_logs, saved_for_later_groups and
 * saved_for_later_items using the current device key.
 * Original record IDs from the backup are preserved exactly.
 */
export async function restoreDatabase(dump: string, decryptionPhrase?: string): Promise<void> {
  let jsonString = dump;
  if (decryptionPhrase && decryptionPhrase.trim()) {
    jsonString = await decrypt(jsonString, decryptionPhrase.trim());
  }

  const parsed = JSON.parse(jsonString);

  // Pre-validate migration: exports before v16 store is_drop_set (boolean) instead of
  // set_type (string) on workout_log_sets and workout_template_sets.
  // Normalise in-place before Zod validation so old backups pass schema validation.
  if (typeof parsed._exportVersion === 'number' && parsed._exportVersion < 16) {
    for (const table of ['workout_log_sets', 'workout_template_sets'] as const) {
      const rows = parsed[table];
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row.set_type == null) {
            row.set_type = row.is_drop_set ? 'drop_set' : 'normal';
          }

          delete row.is_drop_set;
        }
      }
    }
  }

  // Validate the export data against schema (generated from WatermelonDB schema)
  const validationResult: ValidationResult = validateExportDump(parsed);

  if (!validationResult.success) {
    const details = validationResult.details;
    const errorMessage = `Export validation failed with ${details.length} error(s):\n${details.slice(0, 10).join('\n')}${details.length > 10 ? '\n...and more' : ''}`;

    handleError(new Error(errorMessage), 'importDb.validateExport');

    throw new Error(errorMessage);
  }

  const dbData: ExportDump = validationResult.data as ExportDump;
  const importBleDevices = isSameExportPlatform(dbData._exportPlatform, getExportPlatform());

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

  // Capture the current unit_system value before wiping the database.
  // Backups from Android users who never explicitly changed units won't include a
  // unit_system row (setUnits() is only called on explicit change). Without this
  // snapshot, the app falls back to getDefaultUnits() after import, which returns
  // 'imperial' for US-locale browsers even when the user was on metric.
  const preWipeUnitsRows = await database
    .get('settings')
    .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  const preWipeUnitsValue: string =
    preWipeUnitsRows.length > 0 ? (preWipeUnitsRows[0] as any).value : '0';

  // Phase 1: Prepare create operations.
  // Reads and async encryption happen here so the write blocks stay synchronous-safe.
  const createOperations: any[] = [];

  for (const tableName of RESTORE_ORDER) {
    if (tableName === 'ble_devices' && !importBleDevices) {
      continue;
    }

    const collection = database.get(tableName as any);

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

      // Exports include WatermelonDB's internal tombstones for diagnostics.
      // Restoring them would resurrect records the local database considers deleted.
      if (raw._status === 'deleted') {
        continue;
      }

      if (typeof raw.timezone === 'string' && raw.timezone) {
        // Older exports may store IANA names. Resolve once at the row's own instant
        // so every restore path consumes the same fixed "±HH:MM" offset value.
        const instantMs = Number(raw.started_at ?? raw.date ?? raw.created_at ?? Date.now());
        raw.timezone = normalizeTimezoneToOffset(raw.timezone, new Date(instantMs));
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
        const supplementId = raw.supplement_id != null ? String(raw.supplement_id) : undefined;
        const encrypted = await encryptUserMetricFields({ value, unit, date });
        createOperations.push(
          collection.prepareCreate((rec: any) => {
            rec._raw.id = oldId;
            rec.type = raw.type;
            if (raw.external_id != null) {
              rec.externalId = String(raw.external_id);
            }

            rec.supplementId = supplementId;
            rec.valueRaw = encrypted.value;
            rec.unitRaw = encrypted.unit;
            rec.date = date;
            rec.timezone = raw.timezone != null ? String(raw.timezone) : '';
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
        const snapshot = readPlainNutritionLogSnapshotRow(raw);
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
            rec.timezone = raw.timezone != null ? String(raw.timezone) : undefined;
            if (raw.group_id != null) {
              rec.groupId = String(raw.group_id);
            }

            if (raw.logged_meal_name != null) {
              rec.loggedMealName = String(raw.logged_meal_name);
            }

            if (raw.external_id != null) {
              rec.externalId = String(raw.external_id);
            }

            if (raw.snapshot_basis != null) {
              rec.snapshotBasis = String(raw.snapshot_basis);
            }

            if (raw.logged_nutriscore != null) {
              rec.loggedNutriscore = String(raw.logged_nutriscore);
            }

            if (raw.logged_ecoscore != null) {
              rec.loggedEcoscore = String(raw.logged_ecoscore);
            }

            if (raw.logged_nova_group != null) {
              rec.loggedNovaGroup = Number(raw.logged_nova_group);
            }

            rec.createdAt = Number(raw.created_at);
            rec.updatedAt = Number(raw.updated_at);
            if (raw.deleted_at != null) {
              rec.deletedAt = Number(raw.deleted_at);
            }
          })
        );
        continue;
      }

      if (tableName === 'saved_for_later_groups') {
        createOperations.push(await prepareSavedForLaterGroupCreate(collection, raw, oldId));
        continue;
      }

      if (tableName === 'saved_for_later_items') {
        createOperations.push(await prepareSavedForLaterItemCreate(collection, raw, oldId));
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

            let assignValue = value;
            if (key.endsWith('_json')) {
              // @json properties may be named without the "_json" suffix (e.g. micros_json → micros),
              // so the camelCase setter path silently misses. Write _raw directly instead.
              // _raw must hold a JSON *string* (WatermelonDB stringifies before _setRaw),
              // so stringify objects coming from web exports that already hold parsed values.
              if (typeof value === 'string' && value) {
                try {
                  JSON.parse(value); // validate — keep as string
                  assignValue = value;
                } catch {
                  assignValue = null;
                }
              } else if (value !== null && value !== undefined && typeof value === 'object') {
                assignValue = JSON.stringify(value);
              } else {
                assignValue = null;
              }

              rec._raw[key] = assignValue;
              continue;
            }

            const camel = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
            (rec as any)[camel] = assignValue;
          }
        })
      );
    }
  }

  // If the backup doesn't include an active unit_system row, inject one using the
  // pre-wipe value so the app doesn't silently switch units after import.
  const settingsRows = Array.isArray((dbData as any).settings) ? (dbData as any).settings : [];
  const backupHasUnitSystem = settingsRows.some(
    (row: any) => row.type === UNITS_SETTING_TYPE && row.deleted_at == null
  );
  if (!backupHasUnitSystem) {
    const now = Date.now();
    createOperations.push(
      database.get('settings').prepareCreate((rec: any) => {
        rec.type = UNITS_SETTING_TYPE;
        rec.value = preWipeUnitsValue;
        rec.createdAt = now;
        rec.updatedAt = now;
      })
    );
  }

  // Phase 1.5: Create a pre-restore backup of the current database.
  await createPreRestoreBackup();

  // Phase 2: Wipe the database completely before restoring.
  // unsafeResetDatabase() clears both the underlying adapter (LokiJS on web, SQLite on
  // native) and WatermelonDB's JS record caches in one step. This avoids two bugs that
  // arise from manual delete+create approaches:
  //   1. "sent over the bridge, but it's not cached" — observers fire between the delete
  //      and create transactions and leave the JS cache out of sync with the adapter.
  //   2. "Duplicate key" — LokiJS does not guarantee destroy-before-create ordering
  //      within a combined batch, so re-inserting the same IDs fails.
  // On web, unsafeResetDatabase() must be called inside a write block.
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });

  // Phase 3: Populate the fresh database with the backup data.
  if (createOperations.length > 0) {
    await database.write(async () => {
      await database.batch(createOperations);
    });
  }

  // Rebuild the muscle catalogue and app-exercise muscle links. Backups created
  // before muscles/exercise_muscles were added to RESTORE_ORDER don't contain them,
  // and the boot-time seeder is skipped after restore (SEEDING_COMPLETE_KEY is
  // restored as 'true'), so without this the tables would stay empty forever.
  // Both calls are idempotent, so running them on newer backups is a no-op.
  const muscleNameToId = await MuscleService.seedMuscles();
  await MuscleService.backfillExerciseMuscles(muscleNameToId);

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
          workoutLogs.map((log: any) =>
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

  // On web, force Loki to persist to IndexedDB before triggering a page reload.
  // LokiJS autosaves every 500ms; if the reload fires before the first autosave
  // the just-imported data disappears from IDB and the app boots with an empty DB.
  if (Platform.OS === 'web') {
    const loki = (database.adapter as any)._driver?.loki;
    if (loki) {
      await new Promise<void>((resolve) => {
        loki.saveDatabase(() => resolve());
      });
    }
  }

  // The restored AsyncStorage may contain a stale durability baseline from the
  // backup; re-anchor it to the restored row count so the next boot's loss
  // detector doesn't fire a false "nutrition logs lost" report.
  await updateNutritionLogCountBaseline();

  // Reload the app after importing is complete
  await reloadApp();
}
