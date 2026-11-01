/**
 * Keeps Health Connect / Apple Health in step with Musclog's own nutrition logs.
 *
 * Everything here is best effort and never throws: the health platform is a mirror, and a
 * failed mirror must not fail a log, an edit or a delete. Logs imported from another app
 * (their food is the Health Connect sentinel) are never rewritten or deleted through here;
 * that record belongs to the other app, so editing one writes Musclog's own corrected record
 * beside the original (the platform won't let us change it) and remembers to ignore the original.
 */

import { Platform } from 'react-native';

import { database } from '@/database/database-instance';
import { decryptOptionalString } from '@/database/encryptionHelpers';
import type NutritionLog from '@/database/models/NutritionLog';
import { NutritionHealthRepository } from '@/database/repositories/NutritionHealthRepository';
import { handleError } from '@/utils/handleError';

import {
  deleteNutritionLogsFromHealthConnect,
  writeNutritionLogToHealthConnect,
} from './healthConnectNutrition';
import { importedOriginalRecordId, loadOwnershipContext } from './nutritionHealthOwnership';

function hasHealthPlatform(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

// Serialize replacements of one log so concurrent edits cannot leave duplicate iOS correlations.
const pendingExports = new Map<string, Promise<void>>();

/**
 * Write `log` to the health platform as it is now: a new log is created there, an edited one
 * replaces its earlier record. The returned platform id is stored as `external_id` so the next
 * pull recognises the record as this log's.
 */
export async function exportLogToHealthPlatform(log: NutritionLog, label: string): Promise<void> {
  if (!hasHealthPlatform()) {
    return;
  }

  const previous = pendingExports.get(log.id) ?? Promise.resolve();
  const current = previous.then(() => exportCurrentLog(log, label));
  pendingExports.set(log.id, current);
  try {
    await current;
  } finally {
    if (pendingExports.get(log.id) === current) {
      pendingExports.delete(log.id);
    }
  }
}

async function exportCurrentLog(log: NutritionLog, label: string): Promise<void> {
  if (log.deletedAt) {
    return;
  }

  try {
    const ownership = await loadOwnershipContext([], log.externalId ? [log.externalId] : [], [log]);
    const originalRecordId = importedOriginalRecordId(log, ownership);

    // Persist authority before touching the mirror. A failed write must not revert the edit.
    const [, nutrients, foodName] = await Promise.all([
      originalRecordId
        ? NutritionHealthRepository.recordTakeover(log.id, originalRecordId)
        : NutritionHealthRepository.recordOwned(log.id),
      log.getNutrients(),
      decryptOptionalString(log.loggedFoodNameRaw),
    ]);

    const result = await writeNutritionLogToHealthConnect({
      logId: log.id,
      externalId: originalRecordId ? undefined : log.externalId,
      date: log.date,
      mealType: log.type,
      foodName,
      calories: nutrients.calories,
      protein: nutrients.protein,
      carbs: nutrients.carbs,
      fat: nutrients.fat,
      fiber: nutrients.fiber,
    });

    if (result.status === 'written' && result.externalId !== log.externalId) {
      try {
        await database.write(async () => {
          await log.update((record) => {
            record.externalId = result.externalId;
          });
        });
      } catch (idPersistenceError) {
        // Without the returned id, a retry or delete cannot find this new mirror.
        // Keep ownership facts, but compensate for the untracked platform write.
        try {
          await deleteNutritionLogsFromHealthConnect([result.externalId]);
        } catch (cleanupError) {
          handleError(cleanupError, `${label}.cleanupUntrackedMirror`);
        }

        throw idPersistenceError;
      }
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
  logs: readonly Pick<NutritionLog, 'id' | 'externalId'>[],
  label: string
): Promise<void> {
  if (!hasHealthPlatform()) {
    return;
  }

  // A delete can race a pending export; remove the final returned platform id, not its predecessor.
  await Promise.all(logs.map((log) => pendingExports.get(log.id)));
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
