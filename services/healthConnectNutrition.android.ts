/**
 * Reads Nutrition records from Health Connect and reconciles them with the
 * local nutrition_logs table using external_id.
 *
 * Design notes:
 *  - NutritionLog requires a food_id. We use one shared sentinel Food record
 *    (name='Health Connect Import', source='health_connect', all macros=0).
 *    The actual macro data lives in the encrypted snapshot fields of each log,
 *    which NutritionLog.getNutrients() already prefers over the Food record.
 *  - amount=100 (grams) so the scale factor is 1 and snapshot values are absolute.
 *  - Only logs with a non-null external_id participate in delete reconciliation.
 *    User-entered logs (external_id IS NULL) are never modified.
 *
 * Sync behaviour:
 *  - New HC record → create NutritionLog (+ sentinel Food if needed)
 *  - Existing HC record, data changed → update snapshot + updated_at
 *  - Local HC-sourced log not in HC response for the window → soft-delete
 */

import { Q } from '@nozbe/watermelondb';
import { RecordingMethod } from 'react-native-health-connect';

import {
  CONNECT_HEALTH_DATA_SETTING_TYPE,
  READ_HEALTH_DATA_SETTING_TYPE,
  WRITE_HEALTH_DATA_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database';
import { encryptNutritionLogSnapshot } from '@/database/encryptionHelpers';
import Food from '@/database/models/Food';
import FoodFoodPortion from '@/database/models/FoodFoodPortion';
import NutritionLog, { type MealType } from '@/database/models/NutritionLog';
import Setting from '@/database/models/Setting';
import { FoodPortionService } from '@/database/services';
import { localDayStartMs } from '@/utils/calendarDate';

import { healthConnectService } from './healthConnect';
import { RETRY_CONFIG } from './healthConnectErrors';
import { TimestampConverter } from './healthDataTransform';

async function isSettingEnabled(type: string): Promise<boolean> {
  const settings = await database
    .get<Setting>('settings')
    .query(Q.where('type', type), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return settings.length > 0 && settings[0].value === 'true';
}

async function isReadSyncEnabled(): Promise<boolean> {
  try {
    return (
      (await isSettingEnabled(CONNECT_HEALTH_DATA_SETTING_TYPE)) &&
      (await isSettingEnabled(READ_HEALTH_DATA_SETTING_TYPE))
    );
  } catch {
    return false;
  }
}

async function isWriteSyncEnabled(): Promise<boolean> {
  try {
    return (
      (await isSettingEnabled(CONNECT_HEALTH_DATA_SETTING_TYPE)) &&
      (await isSettingEnabled(WRITE_HEALTH_DATA_SETTING_TYPE))
    );
  } catch {
    return false;
  }
}

/** Maps app MealType string to Health Connect mealType integer. */
function mealTypeToHC(mealType: MealType): number {
  switch (mealType) {
    case 'breakfast':
      return 1;
    case 'lunch':
      return 2;
    case 'dinner':
      return 3;
    case 'snack':
      return 4;
    default:
      return 0;
  }
}

export interface NutritionWriteParams {
  logId: string; // WatermelonDB record ID – used as clientRecordId for deduplication
  date: number; // unix ms (midnight of the log date)
  mealType: MealType;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * Write a single nutrition log to Health Connect.
 * Returns the HC-assigned record ID (to store as externalId), or undefined on failure.
 * Never throws – all errors are caught and logged.
 */
export async function writeNutritionLogToHealthConnect(
  params: NutritionWriteParams
): Promise<string | undefined> {
  if (!(await isWriteSyncEnabled())) {
    return undefined;
  }

  const isAvailable = await healthConnectService.checkAvailability();
  if (!isAvailable) {
    return undefined;
  }

  const hasPermission = await healthConnectService.hasPermissionForRecordType('Nutrition', 'write');
  if (!hasPermission) {
    return undefined;
  }

  try {
    const startTime = TimestampConverter.unixToIso(params.date);
    const endTime = TimestampConverter.unixToIso(params.date + 1); // HC requires endTime > startTime

    const record = {
      recordType: 'Nutrition' as const,
      startTime,
      endTime,
      name: params.foodName,
      mealType: mealTypeToHC(params.mealType),
      energy: { value: params.calories, unit: 'kilocalories' as const },
      protein: { value: params.protein, unit: 'grams' as const },
      totalCarbohydrate: { value: params.carbs, unit: 'grams' as const },
      totalFat: { value: params.fat, unit: 'grams' as const },
      fiber: { value: params.fiber, unit: 'grams' as const },
      metadata: {
        clientRecordId: params.logId,
        dataOrigin: 'Musclog',
        recordingMethod: RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY,
      },
    };

    const ids = await healthConnectService.insertRecords([record]);
    return ids[0];
  } catch (err) {
    console.warn('[healthConnectNutrition] writeNutritionLogToHealthConnect failed:', err);
    return undefined;
  }
}

export interface NutritionSyncCounts {
  totalRead: number;
  written: number;
  updated: number;
  deleted: number;
  skipped: number;
}

const HC_SENTINEL_FOOD_SOURCE = 'health_connect';
const HC_SENTINEL_FOOD_NAME = 'Health Connect Import';

/** Maps Health Connect mealType integer to app MealType string. */
function mapMealType(hcMealType: number | undefined): MealType {
  switch (hcMealType) {
    case 1:
      return 'breakfast';
    case 2:
      return 'lunch';
    case 3:
      return 'dinner';
    case 4:
      return 'snack';
    default:
      return 'other';
  }
}

/**
 * Find-or-create the sentinel Food record used as food_id for all HC nutrition logs.
 * Must be called inside a database.write() transaction.
 */
async function getOrCreateSentinelFood(): Promise<Food> {
  const existing = await database
    .get<Food>('foods')
    .query(
      Q.where('source', HC_SENTINEL_FOOD_SOURCE),
      Q.where('name', HC_SENTINEL_FOOD_NAME),
      Q.where('deleted_at', Q.eq(null)),
      Q.take(1)
    )
    .fetch();

  if (existing.length > 0) {
    return existing[0];
  }

  const now = Date.now();

  const portion =
    (await FoodPortionService.get100gPortion()) ??
    (await FoodPortionService.getOrCreatePortion('100g', 100, 'scale', 'user'));

  const food = await database.get<Food>('foods').create((f) => {
    f.name = HC_SENTINEL_FOOD_NAME;
    f.calories = 0;
    f.protein = 0;
    f.carbs = 0;
    f.fat = 0;
    f.fiber = 0;
    f.isAiGenerated = false;
    f.isFavorite = false;
    f.source = HC_SENTINEL_FOOD_SOURCE;
    f.createdAt = now;
    f.updatedAt = now;
  });

  await database.get<FoodFoodPortion>('food_food_portions').create((ffp) => {
    ffp.foodId = food.id;
    ffp.foodPortionId = portion.id;
    ffp.isDefault = true;
    ffp.createdAt = now;
    ffp.updatedAt = now;
  });

  return food;
}

/**
 * Sync Nutrition records from Health Connect for the given time window.
 */
export async function syncNutritionFromHealthConnect(
  timeRange: { startTime: number; endTime: number },
  options: { retryAttempts?: number } = {}
): Promise<NutritionSyncCounts> {
  const { retryAttempts = RETRY_CONFIG.maxAttempts } = options;

  if (!(await isReadSyncEnabled())) {
    return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
  }

  const hasPermission = await healthConnectService.hasPermissionForRecordType('Nutrition', 'read');
  if (!hasPermission) {
    return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      return await syncNutritionOnce(timeRange);
    } catch (err) {
      lastError = err;
      console.warn(`[healthConnectNutrition] Attempt ${attempt}/${retryAttempts} failed:`, err);
      if (attempt < retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

async function syncNutritionOnce(timeRange: {
  startTime: number;
  endTime: number;
}): Promise<NutritionSyncCounts> {
  const counts: NutritionSyncCounts = {
    totalRead: 0,
    written: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
  };

  // 1. Read from Health Connect
  const hcResult = await healthConnectService.readRecords('Nutrition', {
    operator: 'between',
    startTime: TimestampConverter.unixToIso(timeRange.startTime),
    endTime: TimestampConverter.unixToIso(timeRange.endTime),
  });

  const hcRecords = hcResult.records ?? [];
  counts.totalRead = hcRecords.length;

  // 2. Build map of HC records keyed by externalId
  type HCNutritionEntry = {
    externalId: string;
    date: number;
    mealType: MealType;
    foodName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };

  const hcMap = new Map<string, HCNutritionEntry>();
  for (const rec of hcRecords) {
    const externalId: string | undefined = rec.metadata?.id;
    if (!externalId) {
      counts.skipped++;
      continue;
    }
    hcMap.set(externalId, {
      externalId,
      date: localDayStartMs(new Date(rec.startTime)),
      mealType: mapMealType(rec.mealType),
      foodName: rec.name ?? HC_SENTINEL_FOOD_NAME,
      calories: rec.energy?.inKilocalories ?? 0,
      protein: rec.protein?.inGrams ?? 0,
      carbs: rec.totalCarbohydrate?.inGrams ?? 0,
      fat: rec.totalFat?.inGrams ?? 0,
      fiber: rec.dietaryFiber?.inGrams ?? 0,
    });
  }

  // 3. Load local HC-sourced nutrition logs in the time window
  const localLogs = await database
    .get<NutritionLog>('nutrition_logs')
    .query(
      Q.where('external_id', Q.notEq(null)),
      Q.where('deleted_at', Q.eq(null)),
      Q.where('date', Q.gte(timeRange.startTime)),
      Q.where('date', Q.lte(timeRange.endTime))
    )
    .fetch();

  const localByExternalId = new Map<string, NutritionLog>();
  for (const log of localLogs) {
    if (log.externalId) {
      localByExternalId.set(log.externalId, log);
    }
  }

  // 4. Reconcile in a single write transaction
  await database.write(async () => {
    const now = Date.now();
    const sentinelFood = await getOrCreateSentinelFood();

    for (const [externalId, entry] of hcMap.entries()) {
      const existing = localByExternalId.get(externalId);

      if (!existing) {
        // CREATE new NutritionLog
        const encrypted = await encryptNutritionLogSnapshot({
          loggedFoodName: entry.foodName,
          loggedCalories: entry.calories,
          loggedProtein: entry.protein,
          loggedCarbs: entry.carbs,
          loggedFat: entry.fat,
          loggedFiber: entry.fiber,
        });

        await database.get<NutritionLog>('nutrition_logs').create((log) => {
          log.foodId = sentinelFood.id;
          log.externalId = externalId;
          log.date = entry.date;
          log.type = entry.mealType;
          log.amount = 100; // scale = 1 — snapshot holds absolute values
          log.loggedFoodNameRaw = encrypted.loggedFoodName;
          log.loggedCaloriesRaw = encrypted.loggedCalories;
          log.loggedProteinRaw = encrypted.loggedProtein;
          log.loggedCarbsRaw = encrypted.loggedCarbs;
          log.loggedFatRaw = encrypted.loggedFat;
          log.loggedFiberRaw = encrypted.loggedFiber;
          log.loggedMicrosRaw = encrypted.loggedMicrosJson;
          log.createdAt = now;
          log.updatedAt = now;
        });
        counts.written++;
      } else {
        // UPDATE if snapshot macros or metadata changed
        const snapshot = await existing.getDecryptedSnapshot();
        const changed =
          Math.abs((snapshot.loggedCalories ?? 0) - entry.calories) > 0.01 ||
          Math.abs((snapshot.loggedProtein ?? 0) - entry.protein) > 0.01 ||
          Math.abs((snapshot.loggedCarbs ?? 0) - entry.carbs) > 0.01 ||
          Math.abs((snapshot.loggedFat ?? 0) - entry.fat) > 0.01 ||
          Math.abs((snapshot.loggedFiber ?? 0) - entry.fiber) > 0.01 ||
          existing.type !== entry.mealType ||
          existing.date !== entry.date;

        if (changed) {
          const encrypted = await encryptNutritionLogSnapshot({
            loggedFoodName: entry.foodName,
            loggedCalories: entry.calories,
            loggedProtein: entry.protein,
            loggedCarbs: entry.carbs,
            loggedFat: entry.fat,
            loggedFiber: entry.fiber,
          });

          await existing.update((log) => {
            log.date = entry.date;
            log.type = entry.mealType;
            log.loggedFoodNameRaw = encrypted.loggedFoodName;
            log.loggedCaloriesRaw = encrypted.loggedCalories;
            log.loggedProteinRaw = encrypted.loggedProtein;
            log.loggedCarbsRaw = encrypted.loggedCarbs;
            log.loggedFatRaw = encrypted.loggedFat;
            log.loggedFiberRaw = encrypted.loggedFiber;
            log.loggedMicrosRaw = encrypted.loggedMicrosJson;
            log.updatedAt = now;
          });
          counts.updated++;
        }
      }
    }

    // SOFT-DELETE local HC-sourced logs not present in HC response
    for (const [localExternalId, localLog] of localByExternalId.entries()) {
      if (!hcMap.has(localExternalId)) {
        await localLog.update((log) => {
          log.deletedAt = now;
          log.updatedAt = now;
        });
        counts.deleted++;
      }
    }
  });

  return counts;
}
