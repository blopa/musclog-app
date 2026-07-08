import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MACRO_STREAK_STATE } from '@/constants/misc';
import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import FastedDay from '@/database/models/FastedDay';
import {
  consumedDateTimeOnDay,
  type DayKeyRange,
  dayKeyRange,
  dayKeyRangeForLocalDate,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';

/**
 * Persists the days a user explicitly marked as fasting (ate nothing). Each row is stamped
 * with a consumed-datetime style `date` + `timezone` (mirroring nutrition_logs) so that
 * `utcNormalizedDayKey(row.date, row.timezone)` lands on exactly the same calendar-day key
 * a nutrition log on that day would — letting every historical average bucket fasted days
 * without any key-space mismatch.
 */
export class FastedDayRepository {
  /** All rows (any deleted state) that fall on the calendar day of `date`. */
  private static async fetchRowsForDay(date: Date): Promise<FastedDay[]> {
    const range = dayKeyRangeForLocalDate(date);
    const raw = await database
      .get<FastedDay>('fasted_days')
      .query(...dayRangeClauses(range))
      .fetch();
    return range.filterRecords(raw);
  }

  private static async bustStreakCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(MACRO_STREAK_STATE);
    } catch {
      // Best-effort: the streak simply recomputes on the next local day if this fails.
    }
  }

  /** True when the calendar day of `date` is currently flagged as fasted. */
  static async isFasted(date: Date): Promise<boolean> {
    const rows = await this.fetchRowsForDay(date);
    return rows.some((row) => row.deletedAt == null);
  }

  /** Mark the calendar day of `date` as fasted (idempotent; un-deletes a prior flag if present). */
  static async markFasted(date: Date): Promise<void> {
    const { timestamp, timezone } = consumedDateTimeOnDay(date);
    let shouldBustCache = false;

    await database.write(async () => {
      const rows = await this.fetchRowsForDay(date);
      const active = rows.filter((row) => row.deletedAt == null);
      const now = Date.now();

      if (active.length > 0) {
        const [, ...duplicates] = active;
        if (duplicates.length > 0) {
          await database.batch(
            ...duplicates.map((row) =>
              row.prepareUpdate((record) => {
                record.deletedAt = now;
                record.updatedAt = now;
              })
            )
          );
        }
        shouldBustCache = true;
        return;
      }

      const deleted = rows.find((row) => row.deletedAt != null);
      if (deleted) {
        await database.batch(
          deleted.prepareUpdate((row) => {
            row.date = timestamp;
            row.timezone = timezone;
            row.deletedAt = null;
            row.updatedAt = now;
          })
        );
        shouldBustCache = true;
        return;
      }

      await database.batch(
        database.get<FastedDay>('fasted_days').prepareCreate((row) => {
          row.date = timestamp;
          row.timezone = timezone;
          row.createdAt = now;
          row.updatedAt = now;
          row.deletedAt = null;
        })
      );
      shouldBustCache = true;
    });

    if (shouldBustCache) {
      await this.bustStreakCache();
    }
  }

  /** Remove the fasted flag from the calendar day of `date`. */
  static async unmarkFasted(date: Date): Promise<void> {
    let shouldBustCache = false;

    await database.write(async () => {
      const rows = await this.fetchRowsForDay(date);
      const active = rows.filter((row) => row.deletedAt == null);
      if (active.length === 0) {
        return;
      }

      const now = Date.now();
      await database.batch(
        ...active.map((row) =>
          row.prepareUpdate((r) => {
            r.deletedAt = now;
            r.updatedAt = now;
          })
        )
      );
      shouldBustCache = true;
    });

    if (shouldBustCache) {
      await this.bustStreakCache();
    }
  }

  /**
   * UTC-normalized day keys of every flagged fasted day whose calendar day falls within `range`.
   * Same key space as `utcNormalizedDayKey(log.date, log.timezone)`, so callers can union these
   * directly with logged-day keys.
   */
  static async getFastedDayKeysForRange(range: DayKeyRange): Promise<Set<number>> {
    const raw = await database
      .get<FastedDay>('fasted_days')
      .query(Q.where('deleted_at', Q.eq(null)), ...dayRangeClauses(range))
      .fetch();

    return new Set(
      range.filterRecords(raw).map((row) => utcNormalizedDayKey(row.date, row.timezone))
    );
  }

  /**
   * UTC-normalized day keys of every flagged fasted day whose calendar day falls within
   * `[startDate, endDate]` (inclusive). Same key space as `utcNormalizedDayKey(log.date,
   * log.timezone)`, so callers can union these directly with logged-day keys.
   */
  static async getFastedDayKeys(startDate: Date, endDate: Date): Promise<Set<number>> {
    return this.getFastedDayKeysForRange(
      dayKeyRange(utcDayKeyFromLocalDate(startDate), utcDayKeyFromLocalDate(endDate))
    );
  }

  /**
   * UTC-normalized day keys of every flagged fasted day (unbounded). Used by the streak
   * paths, which can't be windowed because a back-dated flag can extend a streak arbitrarily.
   */
  static async getAllFastedDayKeys(): Promise<Set<number>> {
    const rows = await database
      .get<FastedDay>('fasted_days')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return new Set(rows.map((row) => utcNormalizedDayKey(row.date, row.timezone)));
  }
}
