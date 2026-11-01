/**
 * Keeps Health Connect / Apple Health in step with Musclog's own nutrition logs.
 *
 * Everything here is best effort and never throws: the health platform is a mirror, and a
 * failed mirror must not fail a log, an edit or a delete. Logs imported from another app
 * (their food is the Health Connect sentinel) are never rewritten or deleted through here;
 * that record belongs to the other app and the pull treats it as the authority.
 */

import { Platform } from 'react-native';

import { database } from '@/database/database-instance';
import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import { handleError } from '@/utils/handleError';

import { HC_SENTINEL_FOOD_SOURCE } from './healthConnectConstants';
import {
  deleteNutritionLogsFromHealthConnect,
  replaceNutritionLogInHealthConnect,
} from './healthConnectNutrition';

function hasHealthPlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

/** True for a log the pull created from another app's record. */
async function isImportedFromHealthPlatform(log: NutritionLog): Promise<boolean> {
  if (!log.externalId) {
    return false;
  }

  try {
    const food = await database.get<Food>('foods').find(log.foodId);
    return food.source === HC_SENTINEL_FOOD_SOURCE;
  } catch {
    return false;
  }
}

/**
 * Write `log` to the health platform as it is now: a new log is created there, an edited one
 * replaces its earlier record. The returned platform id is stored as `external_id` so the next
 * pull recognises the record as this log's.
 */
export async function exportLogToHealthPlatform(log: NutritionLog, label: string): Promise<void> {
  if (!hasHealthPlatform()) {
    return;
  }

  try {
    if (await isImportedFromHealthPlatform(log)) {
      return;
    }

    const [nutrients, snapshot] = await Promise.all([
      log.getNutrients(),
      log.getDecryptedSnapshot(),
    ]);

    const externalId = await replaceNutritionLogInHealthConnect({
      logId: log.id,
      externalId: log.externalId,
      date: log.date,
      mealType: log.type,
      foodName: snapshot.loggedFoodName ?? '',
      calories: nutrients.calories,
      protein: nutrients.protein,
      carbs: nutrients.carbs,
      fat: nutrients.fat,
      fiber: nutrients.fiber,
    });

    if (externalId && externalId !== log.externalId) {
      await database.write(async () => {
        await log.update((record) => {
          record.externalId = externalId;
        });
      });
    }
  } catch (err) {
    handleError(err, label);
  }
}

/** {@link exportLogToHealthPlatform} for several logs; a failure for one never stops the rest. */
export async function exportLogsToHealthPlatform(
  logs: readonly NutritionLog[],
  label: string
): Promise<void> {
  await Promise.all(logs.map((log) => exportLogToHealthPlatform(log, label)));
}

/** Remove the platform copies of deleted logs. Logs that were never exported are skipped. */
export async function removeLogsFromHealthPlatform(
  logs: readonly Pick<NutritionLog, 'externalId'>[],
  label: string
): Promise<void> {
  if (!hasHealthPlatform()) {
    return;
  }

  const externalIds = logs.flatMap((log) => (log.externalId ? [log.externalId] : []));
  if (externalIds.length === 0) {
    return;
  }

  try {
    await deleteNutritionLogsFromHealthConnect(externalIds);
  } catch (err) {
    handleError(err, label);
  }
}
