import { Q } from '@nozbe/watermelondb';
import { endOfDay, startOfDay } from 'date-fns';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import type NutritionLog from '@/database/models/NutritionLog';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { nutritionHeatmapDays, workoutHeatmapDays } from '@/utils/activityHeatmapData';
import { dayKeyRange, utcDayKeyFromLocalDate } from '@/utils/calendarDate';

/**
 * Live per-day activity for the home heatmaps. Each method observes its own query and re-emits
 * whenever a row that could change a day is added, removed or edited, so the home screen needs
 * no refetch on focus. Both read only plaintext columns: a heatmap never decrypts a log.
 */
export class ActivityHeatmapRepository {
  /** Completed, not deleted workouts that started between `startDate` and `endDate` (local days, inclusive). */
  static observeWorkoutDays(startDate: Date, endDate: Date): Observable<ActivityHeatmapDay[]> {
    return database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('started_at', Q.gte(startOfDay(startDate).getTime())),
        Q.where('started_at', Q.lte(endOfDay(endDate).getTime()))
      )
      .observe()
      .pipe(map((logs) => workoutHeatmapDays(logs.map((log) => log.startedAt))));
  }

  /** Food logged between `startDate` and `endDate` (local days, inclusive), valued by distinct meals. */
  static observeMealDays(startDate: Date, endDate: Date): Observable<ActivityHeatmapDay[]> {
    const range = dayKeyRange(utcDayKeyFromLocalDate(startDate), utcDayKeyFromLocalDate(endDate));

    return (
      database
        .get<NutritionLog>('nutrition_logs')
        .query(Q.where('deleted_at', Q.eq(null)), ...dayRangeClauses(range))
        // The meal type and the consumed time edit in place; `observe()` would miss those.
        .observeWithColumns(['type', 'date', 'timezone'])
        .pipe(map((logs) => nutritionHeatmapDays(range.filterRecords(logs))))
    );
  }
}
