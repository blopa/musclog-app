import { Q } from '@nozbe/watermelondb';

import { HEALTH_NUTRITION_TAKEOVERS_SETTING_TYPE } from '@/constants/settings';
import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type NutritionHealthOwnership from '@/database/models/NutritionHealthOwnership';
import type { NutritionHealthOwnershipKind } from '@/database/models/NutritionHealthOwnership';
import type Setting from '@/database/models/Setting';
import { fetchByIds } from '@/database/queryByIds';
import { parseHealthTakeovers } from '@/utils/healthTakeover';

export type NutritionHealthOwnershipState = {
  ownedLogIds: ReadonlySet<string>;
  ignoredRecordIds: ReadonlySet<string>;
};

type OwnershipFact = { kind: NutritionHealthOwnershipKind; recordId: string };

/**
 * Ownership is a permanent fact, independent of the lifetime of a local log. Keeping it in
 * indexed rows allows a pull to read only the IDs in its window without forgetting history.
 */
export class NutritionHealthRepository {
  /** Called inside the database writer so concurrent edits cannot lose or duplicate facts. */
  private static async persist(facts: OwnershipFact[]): Promise<void> {
    const legacySettings = await database
      .get<Setting>('settings')
      .query(
        Q.where('type', HEALTH_NUTRITION_TAKEOVERS_SETTING_TYPE),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
    const legacyWithValues = legacySettings.filter((setting) => setting.value !== '{}');
    const wanted = new Map<string, OwnershipFact>();

    const add = (fact: OwnershipFact) => wanted.set(`${fact.kind}:${fact.recordId}`, fact);
    for (const setting of legacyWithValues) {
      const legacy = parseHealthTakeovers(setting.value);
      legacy.ownedLogIds.forEach((recordId) => add({ kind: 'owned_log', recordId }));
      legacy.ignoredRecordIds.forEach((recordId) => add({ kind: 'ignored_record', recordId }));
    }

    facts.forEach(add);
    const existing = await fetchByIds<NutritionHealthOwnership>(
      'nutrition_health_ownership',
      'record_id',
      [...wanted.values()].map((fact) => fact.recordId)
    );
    for (const fact of existing) {
      wanted.delete(`${fact.kind}:${fact.recordId}`);
    }

    const now = Date.now();
    // A single adapter transaction includes every migrated fact and clearing the legacy value.
    // Splitting at MAX_BATCH_OPERATIONS would allow a crash to leave a partially migrated set.
    await commitPrepared(database, legacyWithValues, () => [
      ...[...wanted.values()].map(({ kind, recordId }) =>
        database
          .get<NutritionHealthOwnership>('nutrition_health_ownership')
          .prepareCreate((row) => {
            row.kind = kind;
            row.recordId = recordId;
            row.createdAt = now;
          })
      ),
      ...legacyWithValues.map((setting) =>
        setting.prepareUpdate((row) => {
          row.value = '{}';
          row.updatedAt = now;
        })
      ),
    ]);
  }

  static async recordOwned(logId: string): Promise<void> {
    await database.write(() => this.persist([{ kind: 'owned_log', recordId: logId }]));
  }

  static async recordTakeover(logId: string, originalRecordId: string): Promise<void> {
    await database.write(() =>
      this.persist([
        { kind: 'owned_log', recordId: logId },
        { kind: 'ignored_record', recordId: originalRecordId },
      ])
    );
  }

  static async loadState(
    logIds: readonly string[],
    externalIds: readonly string[]
  ): Promise<NutritionHealthOwnershipState> {
    await database.write(() => this.persist([]));
    const [owned, ignored] = await Promise.all([
      fetchByIds<NutritionHealthOwnership>(
        'nutrition_health_ownership',
        'record_id',
        logIds,
        Q.where('kind', 'owned_log')
      ),
      fetchByIds<NutritionHealthOwnership>(
        'nutrition_health_ownership',
        'record_id',
        externalIds,
        Q.where('kind', 'ignored_record')
      ),
    ]);

    return {
      ownedLogIds: new Set(owned.map((row) => row.recordId)),
      ignoredRecordIds: new Set(ignored.map((row) => row.recordId)),
    };
  }
}
