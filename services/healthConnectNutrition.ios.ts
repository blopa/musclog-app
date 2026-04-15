/**
 * Nutrition sync from Apple Health — food correlations (HKCorrelationTypeIdentifierFood).
 */

import {
  AuthorizationStatus,
  authorizationStatusFor,
  queryCorrelationSamples,
  saveCorrelationSample,
} from '@kingstinct/react-native-healthkit';
import type {
  ObjectTypeIdentifier,
  QuantitySample,
  SampleForSaving,
} from '@kingstinct/react-native-healthkit/types';
import { Q } from '@nozbe/watermelondb';

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
import { handleError } from '@/utils/handleError';

import { RETRY_CONFIG } from './healthConnectErrors';

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

function mealTypeToHc(mealType: MealType): number {
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
  logId: string;
  date: number;
  mealType: MealType;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

function extractQuantity(objects: readonly unknown[], id: string): number {
  for (const o of objects) {
    if (!o || typeof o !== 'object') {
      continue;
    }
    const sample = o as QuantitySample;
    const qt = sample.quantityType;
    const ident = typeof qt === 'string' ? qt : (qt as { identifier?: string })?.identifier;
    if (ident === id) {
      return sample.quantity ?? 0;
    }
  }
  return 0;
}

export async function writeNutritionLogToHealthConnect(
  params: NutritionWriteParams
): Promise<string | undefined> {
  if (!(await isWriteSyncEnabled())) {
    return undefined;
  }

  if (
    authorizationStatusFor('HKCorrelationTypeIdentifierFood' as ObjectTypeIdentifier) !==
    AuthorizationStatus.sharingAuthorized
  ) {
    return undefined;
  }

  const start = new Date(params.date);
  const end = new Date(params.date + 60_000);

  const samples: SampleForSaving[] = [
    {
      quantityType: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      quantity: params.calories,
      unit: 'kcal',
      startDate: start,
      endDate: end,
    },
    {
      quantityType: 'HKQuantityTypeIdentifierDietaryProtein',
      quantity: params.protein,
      unit: 'g',
      startDate: start,
      endDate: end,
    },
    {
      quantityType: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
      quantity: params.carbs,
      unit: 'g',
      startDate: start,
      endDate: end,
    },
    {
      quantityType: 'HKQuantityTypeIdentifierDietaryFatTotal',
      quantity: params.fat,
      unit: 'g',
      startDate: start,
      endDate: end,
    },
    {
      quantityType: 'HKQuantityTypeIdentifierDietaryFiber',
      quantity: params.fiber,
      unit: 'g',
      startDate: start,
      endDate: end,
    },
  ];

  try {
    const correlation = await saveCorrelationSample(
      'HKCorrelationTypeIdentifierFood',
      samples,
      start,
      end,
      {
        HKFoodMeal: mealTypeToHc(params.mealType),
        HKFoodType: params.foodName,
        HKExternalUUID: params.logId,
      } as any
    );
    return correlation?.uuid;
  } catch (err) {
    handleError(err, 'healthConnectNutrition.ios.writeNutritionLogToHealthConnect');
    console.warn('[healthConnectNutrition.iOS] writeNutritionLogToHealthConnect failed:', err);
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

export async function syncNutritionFromHealthConnect(
  timeRange: { startTime: number; endTime: number },
  options: { retryAttempts?: number } = {}
): Promise<NutritionSyncCounts> {
  const { retryAttempts = RETRY_CONFIG.maxAttempts } = options;

  if (!(await isReadSyncEnabled())) {
    return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
  }

  if (
    authorizationStatusFor('HKCorrelationTypeIdentifierFood' as ObjectTypeIdentifier) !==
    AuthorizationStatus.sharingAuthorized
  ) {
    return { totalRead: 0, written: 0, updated: 0, deleted: 0, skipped: 0 };
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      return await syncNutritionOnce(timeRange);
    } catch (err) {
      lastError = err;
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

  const correlations = await queryCorrelationSamples('HKCorrelationTypeIdentifierFood', {
    limit: 0,
    ascending: false,
    filter: {
      date: {
        startDate: new Date(timeRange.startTime),
        endDate: new Date(timeRange.endTime),
      },
    },
  });

  counts.totalRead = correlations.length;

  type Entry = {
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

  const hcMap = new Map<string, Entry>();
  for (const corr of correlations) {
    const externalId = corr.uuid;
    const objects = corr.objects ?? [];
    const calories = extractQuantity(objects, 'HKQuantityTypeIdentifierDietaryEnergyConsumed');
    const protein = extractQuantity(objects, 'HKQuantityTypeIdentifierDietaryProtein');
    const carbs = extractQuantity(objects, 'HKQuantityTypeIdentifierDietaryCarbohydrates');
    const fat = extractQuantity(objects, 'HKQuantityTypeIdentifierDietaryFatTotal');
    const fiber = extractQuantity(objects, 'HKQuantityTypeIdentifierDietaryFiber');

    const mealRaw = (corr.metadata as { HKFoodMeal?: number })?.HKFoodMeal;
    const nameRaw = (corr.metadata as { HKFoodType?: string })?.HKFoodType;

    hcMap.set(externalId, {
      externalId,
      date: localDayStartMs(new Date(corr.startDate)),
      mealType: mapMealType(mealRaw),
      foodName: nameRaw ?? HC_SENTINEL_FOOD_NAME,
      calories,
      protein,
      carbs,
      fat,
      fiber,
    });
  }

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

  await database.write(async () => {
    const now = Date.now();
    const sentinelFood = await getOrCreateSentinelFood();

    for (const [externalId, entry] of hcMap.entries()) {
      const existing = localByExternalId.get(externalId);

      if (!existing) {
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
          log.amount = 100;
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
