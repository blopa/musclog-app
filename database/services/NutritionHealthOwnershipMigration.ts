import { Q } from '@nozbe/watermelondb';

import { HEALTH_NUTRITION_TAKEOVERS_SETTING_TYPE } from '@/constants/settings';
import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type Setting from '@/database/models/Setting';
import {
  NutritionHealthRepository,
  type OwnershipFact,
} from '@/database/repositories/NutritionHealthRepository';
import { parseHealthTakeovers } from '@/utils/healthTakeover';

/**
 * Converts the legacy `health_nutrition_takeovers` JSON setting into indexed ownership rows.
 * Idempotent by data (a converted setting reads `{}`), so a restored backup that still carries
 * the setting is converted on the next boot.
 */
export class NutritionHealthOwnershipMigration {
  static async run(): Promise<void> {
    await database.write(async () => {
      const legacy = (
        await database
          .get<Setting>('settings')
          .query(
            Q.where('type', HEALTH_NUTRITION_TAKEOVERS_SETTING_TYPE),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch()
      ).filter((setting) => setting.value !== '{}');
      if (legacy.length === 0) {
        return;
      }

      const facts: OwnershipFact[] = legacy.flatMap((setting) => {
        const { ownedLogIds, ignoredRecordIds } = parseHealthTakeovers(setting.value);

        return [
          ...ownedLogIds.map((recordId) => ({ kind: 'owned_log' as const, recordId })),
          ...ignoredRecordIds.map((recordId) => ({ kind: 'ignored_record' as const, recordId })),
        ];
      });
      const created = await NutritionHealthRepository.prepareMissing(facts);
      const now = Date.now();

      // One adapter transaction holds every fact and the cleared setting: splitting it at
      // MAX_BATCH_OPERATIONS would let a crash leave a partially migrated set.
      await commitPrepared(database, legacy, () => [
        ...created,
        ...legacy.map((setting) =>
          setting.prepareUpdate((row) => {
            row.value = '{}';
            row.updatedAt = now;
          })
        ),
      ]);
    });
  }
}
