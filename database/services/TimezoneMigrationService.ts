import { Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { getCurrentTimezone } from '@/utils/timezone';

type TimezoneBackfillable = Model & { timezone?: string; updatedAt: number };

// Tables that gained a `timezone` column in v21 but predate it for existing rows.
const TIMEZONE_BACKFILL_TABLES = [
  'menstrual_cycles',
  'nutrition_checkins',
  'saved_for_later_groups',
  'nutrition_goals',
  'exercise_goals',
] as const;

export class TimezoneMigrationService {
  /**
   * One-time backfill: ensure all rows in newly timezone-aware tables have a
   * timezone offset. Uses the current device timezone as a best-effort fallback
   * for rows created before the offset was captured at write time.
   */
  static async backfillMissingTimezones(): Promise<void> {
    const fetched = await Promise.all(
      TIMEZONE_BACKFILL_TABLES.map((table) =>
        database
          .get<TimezoneBackfillable>(table)
          .query(Q.where('timezone', Q.eq(null)))
          .fetch()
      )
    );

    const records = fetched.flat();
    if (records.length === 0) {
      return;
    }

    const fallback = getCurrentTimezone();
    const now = Date.now();

    await database.write(async () => {
      await database.batch(
        ...records.map((record) =>
          record.prepareUpdate((rec) => {
            rec.timezone = fallback;
            rec.updatedAt = now;
          })
        )
      );
    });
  }
}
