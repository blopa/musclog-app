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

import type NutritionLog from '@/database/models/NutritionLog';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';

export type OwnershipContext = {
  /** Local logs (live or soft-deleted) whose id some health record names as its origin. */
  ownLogs: ReadonlyMap<string, NutritionLog>;
  /** `external_id`s of soft-deleted logs: the user removed these, they must not come back. */
  tombstonedExternalIds: ReadonlySet<string>;
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

  return context.tombstonedExternalIds.has(externalId) ? 'tombstoned' : 'foreign';
}

export async function loadOwnershipContext(
  originLogIds: readonly string[],
  externalIds: readonly string[]
): Promise<OwnershipContext> {
  const [ownLogs, tombstones] = await Promise.all([
    fetchMapByIds<NutritionLog>('nutrition_logs', 'id', originLogIds),
    fetchByIds<NutritionLog>(
      'nutrition_logs',
      'external_id',
      externalIds,
      Q.where('deleted_at', Q.notEq(null))
    ),
  ]);

  return {
    ownLogs,
    tombstonedExternalIds: new Set(
      tombstones.flatMap((log) => (log.externalId ? [log.externalId] : []))
    ),
  };
}
