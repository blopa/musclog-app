/**
 * Who owns a nutrition record found in Health Connect / HealthKit?
 *
 * Musclog writes `nutrition_logs.id` into every record it exports (`clientRecordId` on Android,
 * `HKExternalUUID` on iOS), so a record that names a local log is Musclog's own echo, and
 * the local log stays the authority for it. Only records written by other apps are imported
 * and overwritten from the health platform. Pure decision + one thin loader, shared by the
 * Android and iOS pulls.
 */

import { Q } from '@nozbe/watermelondb';

import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';
import { NutritionHealthRepository } from '@/database/repositories/NutritionHealthRepository';

import { HC_SENTINEL_FOOD_SOURCE } from './healthConnectConstants';

export type OwnershipContext = {
  /** Local logs (live or soft-deleted) whose id some health record names as its origin. */
  ownLogs: ReadonlyMap<string, NutritionLog>;
  /** `external_id`s of soft-deleted logs: the user removed these, they must not come back. */
  tombstonedExternalIds: ReadonlySet<string>;
  /** Originals superseded by Musclog's own corrected copy (see `utils/healthTakeover.ts`). */
  ignoredRecordIds: ReadonlySet<string>;
  /** Local authority, including legacy non-sentinel logs and persisted takeovers. */
  ownedLogIds: ReadonlySet<string>;
  /** Matching platform IDs of locally owned logs, even when origin metadata is absent. */
  ownedExternalIds: ReadonlySet<string>;
};

/**
 * - `adopt`: Musclog's own record and its local log is alive — keep the local data, just make
 *   sure the log points at this record.
 * - `orphan`: Musclog's own record but the local log was deleted — the health copy is stale.
 * - `tombstoned`: another app's record that the user already deleted here.
 * - `foreign`: another app's record — reconcile as usual.
 */
export type HealthRecordDisposition = 'adopt' | 'orphan' | 'tombstoned' | 'foreign';

export function classifyHealthRecord(
  externalId: string,
  originLogId: string | undefined,
  context: OwnershipContext
): HealthRecordDisposition {
  const own = originLogId ? context.ownLogs.get(originLogId) : undefined;
  if (own) {
    return own.deletedAt ? 'orphan' : 'adopt';
  }

  if (context.ownedExternalIds.has(externalId)) {
    return 'adopt';
  }

  if (originLogId && context.ownedLogIds.has(originLogId)) {
    return 'orphan';
  }

  return context.tombstonedExternalIds.has(externalId) || context.ignoredRecordIds.has(externalId)
    ? 'tombstoned'
    : 'foreign';
}

export async function loadOwnershipContext(
  originLogIds: readonly string[],
  externalIds: readonly string[],
  localLogs: readonly NutritionLog[] = []
): Promise<OwnershipContext> {
  const [ownLogs, tombstones, persisted, foods] = await Promise.all([
    fetchMapByIds<NutritionLog>('nutrition_logs', 'id', originLogIds),
    fetchByIds<NutritionLog>(
      'nutrition_logs',
      'external_id',
      externalIds,
      Q.where('deleted_at', Q.notEq(null))
    ),
    NutritionHealthRepository.loadState(
      [...originLogIds, ...localLogs.map((log) => log.id)],
      externalIds
    ),
    fetchMapByIds<Food>(
      'foods',
      'id',
      localLogs.map((log) => log.foodId)
    ),
  ]);

  const ownedLogIds = new Set([...persisted.ownedLogIds, ...ownLogs.keys()]);
  for (const log of localLogs) {
    const food = foods.get(log.foodId);
    // A non-sentinel food proves a legacy row is ours even before ownership was recorded.
    // Missing food is not evidence of local ownership: imported rows must remain reconcilable.
    if (food && food.source !== HC_SENTINEL_FOOD_SOURCE) {
      ownedLogIds.add(log.id);
    }
  }

  return {
    ownLogs,
    tombstonedExternalIds: new Set(
      tombstones.flatMap((log) => (log.externalId ? [log.externalId] : []))
    ),
    ignoredRecordIds: persisted.ignoredRecordIds,
    ownedLogIds,
    ownedExternalIds: new Set(
      localLogs.flatMap((log) =>
        ownedLogIds.has(log.id) && log.externalId ? [log.externalId] : []
      )
    ),
  };
}
