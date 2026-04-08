import { Q } from '@nozbe/watermelondb';
import { differenceInCalendarDays } from 'date-fns';

import { database } from '@/database/index';
import type NutritionCheckin from '@/database/models/NutritionCheckin';
import type { CheckinStatus } from '@/database/models/NutritionCheckin';
import type NutritionLog from '@/database/models/NutritionLog';
import type UserMetric from '@/database/models/UserMetric';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { localDayKeyPlusCalendarDays, localDayStartFromUtcMs } from '@/utils/calendarDate';

export interface NutritionCheckinInput {
  checkinDate: number;
  targetWeight: number;
  targetBodyFat: number;
  targetBmi: number;
  targetFfmi: number;
  status?: CheckinStatus;
}

export interface CheckinMetrics {
  avgWeight: number;
  trend: number;
  avgCalories: number;
  consistency: number;
  avgBodyFat: number | null;
  activeMinutes: number;
  activeMinutesTrend: number | null;
  dailyWeights: number[];
  workoutsCount: number;
  weekInfo: { current: number; total: number };
  status: 'ahead' | 'onTrack' | 'behind';
  hasEnoughData: boolean;
}

export class NutritionCheckinService {
  /**
   * Get all check-ins for a nutrition goal, ordered by checkin_date ascending.
   */
  static async getByGoalId(nutritionGoalId: string): Promise<NutritionCheckin[]> {
    return await database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(
        Q.where('nutrition_goal_id', nutritionGoalId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('checkin_date', Q.asc)
      )
      .fetch();
  }

  /**
   * Get a single check-in by id.
   */
  static async getById(id: string): Promise<NutritionCheckin | null> {
    const rows = await database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(Q.where('id', id), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all check-ins with pagination support, ordered by checkin_date descending.
   */
  static async getHistory(limit?: number, offset?: number): Promise<NutritionCheckin[]> {
    let query = database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('checkin_date', Q.desc));

    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Compute metrics for a check-in based on logs from the 7 days ending on checkinDate.
   */
  static async getCheckinMetrics(checkin: NutritionCheckin): Promise<CheckinMetrics> {
    const periodEnd = localDayStartFromUtcMs(checkin.checkinDate);
    const periodStart = localDayKeyPlusCalendarDays(periodEnd, -7);
    const prevPeriodStart = localDayKeyPlusCalendarDays(periodEnd, -14);

    // Fetch all check-ins for the same goal to compute weekInfo
    const allCheckins = await NutritionCheckinService.getByGoalId(checkin.nutritionGoalId);
    const currentIndex = allCheckins.findIndex((c) => c.id === checkin.id);
    const weekInfo = {
      current: currentIndex >= 0 ? currentIndex + 1 : allCheckins.length,
      total: allCheckins.length,
    };

    // Fetch weight metrics for current period
    const weightMetrics = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('date', Q.between(periodStart, periodEnd)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.asc)
      )
      .fetch();

    // Build daily weights array (7 slots, one per day)
    const dailyWeights: number[] = Array(7).fill(0);
    const decryptedWeights: number[] = [];
    for (const metric of weightMetrics) {
      const { value } = await metric.getDecrypted();
      decryptedWeights.push(value);
      const dayIndex = differenceInCalendarDays(
        new Date(localDayStartFromUtcMs(metric.date)),
        new Date(localDayStartFromUtcMs(periodStart))
      );
      if (dayIndex >= 0 && dayIndex < 7) {
        dailyWeights[dayIndex] = value;
      }
    }

    const avgWeight =
      decryptedWeights.length > 0
        ? decryptedWeights.reduce((a, b) => a + b, 0) / decryptedWeights.length
        : checkin.targetWeight;

    const trend = avgWeight - checkin.targetWeight;

    // Fetch body fat metrics for current period
    const bodyFatMetrics = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'body_fat'),
        Q.where('date', Q.between(periodStart, periodEnd)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    let avgBodyFat: number | null = null;
    if (bodyFatMetrics.length > 0) {
      const bodyFatValues = await Promise.all(
        bodyFatMetrics.map(async (m) => (await m.getDecrypted()).value)
      );
      avgBodyFat = bodyFatValues.reduce((a: number, b: number) => a + b, 0) / bodyFatValues.length;
    }

    // Fetch nutrition logs for current period
    const nutritionLogs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('date', Q.between(periodStart, periodEnd)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Group nutrition logs by day and sum calories per day
    const caloriesByDay = new Map<number, number>();
    for (const log of nutritionLogs) {
      const snapshot = await log.getDecryptedSnapshot();
      const dayKey = localDayStartFromUtcMs(log.date);
      caloriesByDay.set(dayKey, (caloriesByDay.get(dayKey) ?? 0) + (snapshot.loggedCalories ?? 0));
    }

    const daysWithLogs = caloriesByDay.size;
    const totalCalories = Array.from(caloriesByDay.values()).reduce((a, b) => a + b, 0);
    const avgCalories = daysWithLogs > 0 ? Math.round(totalCalories / daysWithLogs) : 0;
    const consistency = Math.round((daysWithLogs / 7) * 100);

    // Fetch workout logs for current period
    const workoutLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('started_at', Q.between(periodStart, periodEnd)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    const workoutsCount = workoutLogs.length;
    const activeMinutes = workoutLogs.reduce((sum, w) => {
      if (w.completedAt && w.startedAt) {
        return sum + Math.round((w.completedAt - w.startedAt) / 60000);
      }
      return sum;
    }, 0);

    // Fetch workout logs for prior period to compute trend
    const prevWorkoutLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('started_at', Q.between(prevPeriodStart, periodStart)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    const prevActiveMinutes = prevWorkoutLogs.reduce((sum, w) => {
      if (w.completedAt && w.startedAt) {
        return sum + Math.round((w.completedAt - w.startedAt) / 60000);
      }
      return sum;
    }, 0);

    const activeMinutesTrend =
      prevWorkoutLogs.length > 0 ? activeMinutes - prevActiveMinutes : null;

    // Determine status using 0.5% weight deviation threshold
    const threshold = checkin.targetWeight * 0.005;
    let status: 'ahead' | 'onTrack' | 'behind';
    if (Math.abs(trend) <= threshold) {
      status = 'onTrack';
    } else if (trend < 0) {
      status = 'ahead';
    } else {
      status = 'behind';
    }

    const hasEnoughData = decryptedWeights.length >= 3 && daysWithLogs >= 3;

    return {
      avgWeight,
      trend,
      avgCalories,
      consistency,
      avgBodyFat,
      activeMinutes,
      activeMinutesTrend,
      dailyWeights,
      workoutsCount,
      weekInfo,
      status,
      hasEnoughData,
    };
  }

  /**
   * Create a new check-in for a nutrition goal.
   */
  static async create(
    nutritionGoalId: string,
    data: NutritionCheckinInput
  ): Promise<NutritionCheckin> {
    return await database.write(async () => {
      const now = Date.now();
      return await database.get<NutritionCheckin>('nutrition_checkins').create((r) => {
        r.nutritionGoalId = nutritionGoalId;
        r.checkinDate = data.checkinDate;
        r.targetWeight = data.targetWeight;
        r.targetBodyFat = data.targetBodyFat;
        r.targetBmi = data.targetBmi;
        r.targetFfmi = data.targetFfmi;
        r.status = data.status ?? 'pending';
        r.createdAt = now;
        r.updatedAt = now;
      });
    });
  }

  /**
   * Create multiple check-ins for a nutrition goal in a single batch operation.
   */
  static async createBatch(
    nutritionGoalId: string,
    checkins: NutritionCheckinInput[]
  ): Promise<NutritionCheckin[]> {
    if (checkins.length === 0) {
      return [];
    }

    return await database.write(async () => {
      const now = Date.now();
      const collection = database.get<NutritionCheckin>('nutrition_checkins');

      const preparedRecords = checkins.map((data) =>
        collection.prepareCreate((r) => {
          r.nutritionGoalId = nutritionGoalId;
          r.checkinDate = data.checkinDate;
          r.targetWeight = data.targetWeight;
          r.targetBodyFat = data.targetBodyFat;
          r.targetBmi = data.targetBmi;
          r.targetFfmi = data.targetFfmi;
          r.status = data.status ?? 'pending';
          r.createdAt = now;
          r.updatedAt = now;
        })
      );

      await database.batch(...preparedRecords);
      return preparedRecords;
    });
  }

  /**
   * Update a check-in.
   */
  static async update(
    id: string,
    updates: Partial<NutritionCheckinInput>
  ): Promise<NutritionCheckin> {
    return await database.write(async () => {
      const checkin = await database.get<NutritionCheckin>('nutrition_checkins').find(id);

      if (checkin.deletedAt) {
        throw new Error('Cannot update deleted check-in');
      }

      await checkin.update((record) => {
        if (updates.checkinDate !== undefined) {
          record.checkinDate = updates.checkinDate;
        }
        if (updates.targetWeight !== undefined) {
          record.targetWeight = updates.targetWeight;
        }
        if (updates.targetBodyFat !== undefined) {
          record.targetBodyFat = updates.targetBodyFat;
        }
        if (updates.targetBmi !== undefined) {
          record.targetBmi = updates.targetBmi;
        }
        if (updates.targetFfmi !== undefined) {
          record.targetFfmi = updates.targetFfmi;
        }
        if (updates.status !== undefined) {
          record.status = updates.status;
        }
        record.updatedAt = Date.now();
      });

      return checkin;
    });
  }

  /**
   * Soft-delete a check-in.
   */
  static async delete(id: string): Promise<void> {
    await database.write(async () => {
      const checkin = await database.get<NutritionCheckin>('nutrition_checkins').find(id);
      await checkin.markAsDeleted();
    });
  }

  /**
   * Soft-delete all check-ins belonging to a given nutrition goal.
   * Called when a goal is superseded so its check-ins don't linger as dead data.
   */
  static async deleteByGoalId(goalId: string): Promise<void> {
    await database.write(async () => {
      const checkins = await database
        .get<NutritionCheckin>('nutrition_checkins')
        .query(Q.where('nutrition_goal_id', goalId), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const checkin of checkins) {
        await checkin.markAsDeleted();
      }
    });
  }
}
