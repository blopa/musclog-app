import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import type UserMetric from '@/database/models/UserMetric';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';

/** The latest thing the person did in each area. Every field is null when they never did it. */
export type LastActivity = {
  /** Latest COMPLETED workout; a logged walk or run is a workout log too. */
  lastWorkoutAt: number | null;
  /** Latest food log or flagged fasting day. */
  lastFoodAt: number | null;
  lastWeighInAt: number | null;
};

/**
 * "When did they last…?" for comeback detection. One indexed `take(1)` per area: the streak scans
 * walk every day of history, which is far too much to run every time Home gains focus.
 */
export class ActivityRepository {
  static async lastActivity(): Promise<LastActivity> {
    const [workout, food, weighIn, fastedKeys] = await Promise.all([
      database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('completed_at', Q.notEq(null)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('completed_at', Q.desc),
          Q.take(1)
        )
        .fetch(),
      database
        .get<NutritionLog>('nutrition_logs')
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('date', Q.desc), Q.take(1))
        .fetch(),
      database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', 'weight'),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc),
          Q.take(1)
        )
        .fetch(),
      FastedDayRepository.getAllFastedDayKeys(),
    ]);

    // A flagged fast is a day the person tracked on purpose, so it counts as food activity. Its key is
    // the UTC-normalised day; the local day it names is what compares against "now".
    const latestFast = fastedKeys.size > 0 ? Math.max(...fastedKeys) : null;
    const foodCandidates = [
      food[0]?.date ?? null,
      latestFast === null ? null : localDayStartFromUtcMs(latestFast),
    ].filter((value): value is number => value !== null);

    return {
      lastWorkoutAt: workout[0]?.completedAt ?? null,
      lastFoodAt: foodCandidates.length > 0 ? Math.max(...foodCandidates) : null,
      lastWeighInAt: weighIn[0]?.date ?? null,
    };
  }
}
