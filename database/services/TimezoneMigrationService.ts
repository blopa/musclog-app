import { Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import {
  calendarDateFromRecordDay,
  instantForDateTimeInTimezone,
  timeOfDayMsInTimezone,
  wallClockDateInTimezone,
} from '@/utils/calendarDate';
import { getCurrentTimezone, getTimezoneAt } from '@/utils/timezone';

type TimezoneBackfillable = Model & { timezone?: string; updatedAt: number };

// Tables that gained a `timezone` column in v21 but predate it for existing rows.
const TIMEZONE_BACKFILL_TABLES = [
  'menstrual_cycles',
  'nutrition_checkins',
  'saved_for_later_groups',
  'nutrition_goals',
  'exercise_goals',
] as const;

function dateWithCreatedAtTimeOfDay(
  date: number,
  createdAt: number,
  timezone: string | null | undefined
): number | null {
  if (timeOfDayMsInTimezone(createdAt, timezone) === 0) {
    return null;
  }

  return instantForDateTimeInTimezone(
    calendarDateFromRecordDay(date, timezone),
    wallClockDateInTimezone(createdAt, timezone),
    timezone
  );
}

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

  /**
   * Idempotent shape repair for nutrition logs written before `nutrition_logs.timezone`
   * existed. Uses the device-local offset at each row's stored date as a best-effort
   * approximation and, for legacy midnight day keys, restores a consumed time-of-day
   * from `created_at`.
   */
  static async repairNullTimezoneNutritionLogs(): Promise<void> {
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.or(Q.where('timezone', Q.eq(null)), Q.where('timezone', Q.eq(''))))
      .fetch();

    if (logs.length === 0) {
      return;
    }

    const now = Date.now();
    const updates = logs.map((log) => {
      const timezone = getTimezoneAt(log.date);
      const hasConsumedTime = timeOfDayMsInTimezone(log.date, timezone) !== 0;
      const newDate = hasConsumedTime
        ? null
        : dateWithCreatedAtTimeOfDay(log.date, log.createdAt, timezone);

      return { log, timezone, newDate };
    });

    await database.write(async () => {
      await database.batch(
        ...updates.map(({ log, timezone, newDate }) =>
          log.prepareUpdate((record) => {
            record.timezone = timezone;
            if (newDate !== null) {
              record.date = newDate;
            }
            record.updatedAt = now;
          })
        )
      );
    });
  }

  /**
   * One-time backfill for `nutrition_logs.date` gaining a time-of-day component.
   * Legacy rows stored `date` at local midnight (a day key). For those, preserve
   * the user-picked calendar day but stamp it with the time-of-day from
   * `created_at` (best-effort).
   *
   * Must run exactly once (gated via `runOnce` in AppBoot): now that the time
   * picker ships, a midnight `date` can be a deliberate user choice, so the caller
   * passes a persisted cutoff to exclude rows created after the first attempt began.
   */
  static async backfillConsumedTimeFromCreatedAt(cutoffMs: number = Date.now()): Promise<void> {
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)), Q.where('created_at', Q.lte(cutoffMs)))
      .fetch();

    const updates = logs
      .map((log) => {
        if (timeOfDayMsInTimezone(log.date, log.timezone) !== 0) {
          return null;
        }

        const newDate = dateWithCreatedAtTimeOfDay(log.date, log.createdAt, log.timezone);
        if (newDate === null) {
          return null;
        }

        return { log, newDate };
      })
      .filter((u): u is { log: NutritionLog; newDate: number } => u !== null);

    if (updates.length === 0) {
      return;
    }

    const now = Date.now();
    await database.write(async () => {
      await database.batch(
        ...updates.map(({ log, newDate }) =>
          log.prepareUpdate((r) => {
            r.date = newDate;
            r.updatedAt = now;
          })
        )
      );
    });
  }
}
