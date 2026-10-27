import { Q } from '@nozbe/watermelondb';
import { addDays } from 'date-fns';

import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import type UserMetric from '@/database/models/UserMetric';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import type { ComebackState } from '@/utils/comeback/comebackState';
import { storedWeightToKg } from '@/utils/unitConversion';

export type ComebackProgress = {
  /** Completed workouts since day 1 (a logged walk or run counts). */
  workouts: number;
  /** Distinct days with food logged since day 1. */
  foodDays: number;
  /** Days the person did their minimum. */
  minimumDays: number;
  /** The weight at day 1 and the recent average, kg; null until there are weigh-ins to compare. */
  weight: { startKg: number; nowKg: number } | null;
};

/** How far back from day 1 a weigh-in still counts as "the weight I started at". */
const START_WEIGHT_LOOKBACK_DAYS = 14;
/** The recent weight is the average of this many days, so one noisy morning does not move it. */
const RECENT_WEIGHT_DAYS = 7;

/**
 * "Since you came back": what the person has done, measured against day 1 — never against their
 * old peak. A comeback that compared today with a lift from two years ago would only ever report
 * how far there is left to go.
 */
export class ComebackProgressService {
  static async summarize(
    state: ComebackState,
    now: number = Date.now()
  ): Promise<ComebackProgress> {
    const startedAt = state.startedAt;
    if (startedAt === null) {
      return { workouts: 0, foodDays: 0, minimumDays: 0, weight: null };
    }

    const [workouts, foodLogs, weight] = await Promise.all([
      database
        .get<WorkoutLog>('workout_logs')
        .query(Q.where('completed_at', Q.gte(startedAt)), Q.where('deleted_at', Q.eq(null)))
        .fetchCount(),
      database
        .get<NutritionLog>('nutrition_logs')
        .query(Q.where('date', Q.gte(startedAt)), Q.where('deleted_at', Q.eq(null)))
        .fetch(),
      this.weightChange(startedAt, now),
    ]);
    const foodDays = new Set(foodLogs.map((log) => localDayStartFromUtcMs(log.date))).size;
    const minimumDays = state.minimumDays.filter(
      (day) => new Date(`${day}T00:00:00`).getTime() >= startedAt
    ).length;

    return { workouts, foodDays, minimumDays, weight };
  }

  private static async weightChange(
    startedAt: number,
    now: number
  ): Promise<ComebackProgress['weight']> {
    const rows = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.gte(addDays(new Date(startedAt), -START_WEIGHT_LOOKBACK_DAYS).getTime())),
        Q.sortBy('date', Q.asc)
      )
      .fetch();
    if (rows.length === 0) {
      return null;
    }

    const kg = async (row: UserMetric) => {
      const value = await row.getDecrypted();

      return storedWeightToKg(value.value, value.unit);
    };

    // Day 1 is the first weigh-in from the last two weeks before it onwards: setup logs one for
    // today when the person types it, and otherwise the latest recent one stands in.
    const start = rows[0];
    const recentFrom = addDays(new Date(now), -RECENT_WEIGHT_DAYS).getTime();
    const recent = rows.filter((row) => row.date >= recentFrom);
    const nowRows = recent.length > 0 ? recent : [rows[rows.length - 1]];
    const startKg = await kg(start);
    const nowKg =
      (await Promise.all(nowRows.map(kg))).reduce((sum, value) => sum + value, 0) / nowRows.length;

    return { startKg, nowKg };
  }
}
