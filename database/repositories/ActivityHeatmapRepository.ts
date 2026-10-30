import { type Model, Q, type Query } from '@nozbe/watermelondb';
import { endOfDay, startOfDay } from 'date-fns';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { ActivityHeatmapSource } from '@/constants/settings';
import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import type NutritionLog from '@/database/models/NutritionLog';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { nutritionHeatmapDays, workoutHeatmapDays } from '@/utils/activityHeatmapData';
import { dayKeyRange, utcDayKeyFromLocalDate } from '@/utils/calendarDate';

/** One heatmap source over a date range: its days once, or live. */
type SourceRead = {
  observe: () => Observable<ActivityHeatmapDay[]>;
  fetch: () => Promise<ActivityHeatmapDay[]>;
};

/**
 * Pairs a source's query with the bucketing that understands ITS records. The record type is
 * generic here and erased in the result, so each source keeps a typed `toDays` (no casts) while the
 * sources still share one `SourceRead` shape.
 */
function sourceRead<T extends Model>({
  query,
  watchedColumns,
  toDays,
}: {
  query: Query<T>;
  /** Columns that edit in place; `observe()` would miss those. Omit when a row never edits into another day. */
  watchedColumns?: string[];
  toDays: (records: T[]) => ActivityHeatmapDay[];
}): SourceRead {
  return {
    observe: () =>
      (watchedColumns ? query.observeWithColumns(watchedColumns) : query.observe()).pipe(
        map(toDays)
      ),
    fetch: async () => toDays(await query.fetch()),
  };
}

const SOURCE_READERS: Record<
  ActivityHeatmapSource,
  (startDate: Date, endDate: Date) => SourceRead
> = {
  /** Completed, not deleted workouts that started between the two local days, inclusive. */
  workouts: (startDate, endDate) =>
    sourceRead({
      query: database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('completed_at', Q.notEq(null)),
          Q.where('deleted_at', Q.eq(null)),
          Q.where('started_at', Q.gte(startOfDay(startDate).getTime())),
          Q.where('started_at', Q.lte(endOfDay(endDate).getTime()))
        ),
      toDays: (logs) => workoutHeatmapDays(logs.map((log) => log.startedAt)),
    }),

  /** Food logged between the two local days, inclusive; valued by distinct meals. */
  nutrition: (startDate, endDate) => {
    const range = dayKeyRange(utcDayKeyFromLocalDate(startDate), utcDayKeyFromLocalDate(endDate));

    return sourceRead({
      query: database
        .get<NutritionLog>('nutrition_logs')
        .query(Q.where('deleted_at', Q.eq(null)), ...dayRangeClauses(range)),
      // The meal type and the consumed time edit in place.
      watchedColumns: ['type', 'date', 'timezone'],
      // The query widens the range to be safe; the range trims the overscan back to the days asked for.
      toDays: (logs) => nutritionHeatmapDays(range.filterRecords(logs)),
    });
  },
};

/**
 * Per-day activity for the heatmaps, by source. `observeDays` is live: it re-emits whenever a row
 * that could change a day is added, removed or edited, so the home screen needs no refetch on
 * focus. `fetchDays` reads the same days once, for the home screen widget, which is not a React
 * tree. Both read only plaintext columns: a heatmap never decrypts a log.
 */
export class ActivityHeatmapRepository {
  static observeDays(
    source: ActivityHeatmapSource,
    startDate: Date,
    endDate: Date
  ): Observable<ActivityHeatmapDay[]> {
    return SOURCE_READERS[source](startDate, endDate).observe();
  }

  static async fetchDays(
    source: ActivityHeatmapSource,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityHeatmapDay[]> {
    return SOURCE_READERS[source](startDate, endDate).fetch();
  }
}
