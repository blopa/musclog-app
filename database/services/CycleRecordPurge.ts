import type { Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';

/** Every table whose rows hold an encrypted cycle payload or config. */
export const CYCLE_RECORD_TABLES = [
  'cycle_periods',
  'cycle_day_logs',
  'cycle_contexts',
  'menstrual_cycles',
] as const;

/**
 * Permanently destroys cycle records that were soft-deleted. A removed period stays a tombstone
 * for the rest of the session so the "Undo" snackbar can restore it; by the next boot that window
 * has closed, and keeping the row would keep text the person deleted on the device (decryptable
 * with the device key). Runs at every boot; a no-op when there is nothing to purge.
 */
export class CycleRecordPurge {
  static async purgeDeleted(): Promise<number> {
    const deleted = Q.where('deleted_at', Q.notEq(null));
    const counts = await Promise.all(
      CYCLE_RECORD_TABLES.map((table) => database.get(table).query(deleted).fetchCount())
    );
    if (counts.every((count) => count === 0)) {
      return 0;
    }

    return database.write(async () => {
      const records: Model[] = (
        await Promise.all(
          CYCLE_RECORD_TABLES.map((table) => database.get(table).query(deleted).fetch())
        )
      ).flat();
      await commitPrepared(database, records, () =>
        records.map((record) => record.prepareDestroyPermanently())
      );

      return records.length;
    });
  }
}
