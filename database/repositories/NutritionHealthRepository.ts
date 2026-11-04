import type { Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { waitForBootMigrations } from '@/database/dbReady';
import type NutritionHealthOwnership from '@/database/models/NutritionHealthOwnership';
import type { NutritionHealthOwnershipKind } from '@/database/models/NutritionHealthOwnership';
import { fetchByIds } from '@/database/queryByIds';

export type NutritionHealthOwnershipState = {
  ownedLogIds: ReadonlySet<string>;
  ignoredRecordIds: ReadonlySet<string>;
};

export type OwnershipFact = { kind: NutritionHealthOwnershipKind; recordId: string };

/**
 * Ownership is a permanent fact, independent of the lifetime of a local log. Keeping it in
 * indexed rows allows a pull to read only the IDs in its window without forgetting history.
 * `record_id` is a local log id for `owned_log` and a platform record id for `ignored_record`.
 */
export class NutritionHealthRepository {
  /**
   * Prepares the facts that are not stored yet. Call inside the database writer so concurrent
   * edits cannot duplicate a fact.
   */
  static async prepareMissing(facts: readonly OwnershipFact[]): Promise<Model[]> {
    const wanted = new Map(facts.map((fact) => [`${fact.kind}:${fact.recordId}`, fact]));
    const existing = await fetchByIds<NutritionHealthOwnership>(
      'nutrition_health_ownership',
      'record_id',
      facts.map((fact) => fact.recordId)
    );
    for (const row of existing) {
      wanted.delete(`${row.kind}:${row.recordId}`);
    }

    const now = Date.now();

    return [...wanted.values()].map(({ kind, recordId }) =>
      database.get<NutritionHealthOwnership>('nutrition_health_ownership').prepareCreate((row) => {
        row.kind = kind;
        row.recordId = recordId;
        row.createdAt = now;
      })
    );
  }

  private static async record(facts: OwnershipFact[]): Promise<void> {
    await database.write(async () => {
      const operations = await this.prepareMissing(facts);
      if (operations.length > 0) {
        await database.batch(...operations);
      }
    });
  }

  static recordOwned(logId: string): Promise<void> {
    return this.record([{ kind: 'owned_log', recordId: logId }]);
  }

  static recordTakeover(logId: string, originalRecordId: string): Promise<void> {
    return this.record([
      { kind: 'owned_log', recordId: logId },
      { kind: 'ignored_record', recordId: originalRecordId },
    ]);
  }

  static async loadState(
    logIds: readonly string[],
    externalIds: readonly string[]
  ): Promise<NutritionHealthOwnershipState> {
    // Facts from the legacy takeover setting are converted by a boot migration.
    await waitForBootMigrations();
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
