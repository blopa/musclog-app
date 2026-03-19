import { Q } from '@nozbe/watermelondb';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

import { database } from '../index';
import type NutritionCheckin from '../models/NutritionCheckin';
import { CheckinStatus } from '../models/NutritionCheckin';
import UserMetric from '../models/UserMetric';
import NutritionLog from '../models/NutritionLog';
import WorkoutLog from '../models/WorkoutLog';
import { NotificationService } from '../../services/NotificationService';

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
  dailyWeights: { value: number }[];
  workoutsCount: number;
  weekInfo: { current: number; total: number };
  status: CheckinStatus;
  hasEnoughData: boolean;
}

export class NutritionCheckinService {
  private static table = 'nutrition_checkins';

  static async getAll() {
    return await database.get<NutritionCheckin>(this.table).query().fetch();
  }

  static async getById(id: string) {
    try {
      return await database.get<NutritionCheckin>(this.table).find(id);
    } catch {
      return null;
    }
  }

  static async getByGoalId(goalId: string) {
    return await database
      .get<NutritionCheckin>(this.table)
      .query(Q.where('nutrition_goal_id', goalId))
      .fetch();
  }

  static async create(goalId: string, data: NutritionCheckinInput) {
    return await database.write(async () => {
      const checkin = await database.get<NutritionCheckin>(this.table).create((record) => {
        record.nutritionGoalId = goalId;
        record.checkinDate = data.checkinDate;
        record.targetWeight = data.targetWeight;
        record.targetBodyFat = data.targetBodyFat;
        record.targetBmi = data.targetBmi;
        record.targetFfmi = data.targetFfmi;
        record.status = data.status || 'pending';
      });

      // Schedule notification
      await NotificationService.scheduleNutritionCheckin(checkin.id, checkin.checkinDate);

      return checkin;
    });
  }

  static async createBatch(goalId: string, checkins: NutritionCheckinInput[]) {
    return await database.write(async () => {
      const createdCheckins = await Promise.all(
        checkins.map((data) =>
          database.get<NutritionCheckin>(this.table).create((record) => {
            record.nutritionGoalId = goalId;
            record.checkinDate = data.checkinDate;
            record.targetWeight = data.targetWeight;
            record.targetBodyFat = data.targetBodyFat;
            record.targetBmi = data.targetBmi;
            record.targetFfmi = data.targetFfmi;
            record.status = data.status || 'pending';
          })
        )
      );

      // Schedule first notification only to avoid cluttering
      if (createdCheckins.length > 0) {
        await NotificationService.scheduleNutritionCheckin(
          createdCheckins[0].id,
          createdCheckins[0].checkinDate
        );
      }

      return createdCheckins;
    });
  }

  static async update(id: string, data: Partial<NutritionCheckinInput>) {
    return await database.write(async () => {
      const checkin = await this.getById(id);
      if (!checkin) return null;

      await checkin.update((record) => {
        if (data.status) record.status = data.status;
      });

      return checkin;
    });
  }

  static async getCheckinMetrics(checkin: NutritionCheckin): Promise<CheckinMetrics> {
    const endDate = endOfDay(checkin.checkinDate);
    const startDate = startOfDay(subDays(endDate, 7));
    const prevStartDate = startOfDay(subDays(startDate, 7));

    // 1. Weight Average
    const weights = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('date', Q.between(startDate.getTime(), endDate.getTime())),
        Q.sortBy('date', Q.desc)
      )
      .fetch();

    const decryptedWeights = await Promise.all(weights.map((w) => w.getDecrypted()));
    const hasEnoughData = decryptedWeights.length >= 4;
    const avgWeight =
      decryptedWeights.length > 0
        ? decryptedWeights.reduce((acc, w) => acc + w.value, 0) / decryptedWeights.length
        : checkin.targetWeight;

    const prevWeights = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('date', Q.between(prevStartDate.getTime(), startDate.getTime()))
      )
      .fetch();
    const decryptedPrevWeights = await Promise.all(prevWeights.map((w) => w.getDecrypted()));
    const prevAvgWeight =
      decryptedPrevWeights.length > 0
        ? decryptedPrevWeights.reduce((acc, w) => acc + w.value, 0) / decryptedPrevWeights.length
        : avgWeight;
    const trend = avgWeight - prevAvgWeight;

    // 2. Nutrition Consistency
    const logs = await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('date', Q.between(startDate.getTime(), endDate.getTime())))
      .fetch();

    const dailyTotals: Record<string, number> = {};
    for (const log of logs) {
      const nutrients = await log.getNutrients();
      const day = format(log.date, 'yyyy-MM-dd');
      dailyTotals[day] = (dailyTotals[day] || 0) + nutrients.calories;
    }

    const daysLogged = Object.keys(dailyTotals).length;
    const avgCalories =
      daysLogged > 0
        ? Math.round(Object.values(dailyTotals).reduce((acc, val) => acc + val, 0) / daysLogged)
        : 0;

    const consistency = Math.min(100, Math.round((daysLogged / 7) * 100));

    // 3. Workouts
    const workouts = await database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('started_at', Q.between(startDate.getTime(), endDate.getTime())))
      .fetch();

    // 4. Body Fat
    const bodyFats = await database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'body_fat'),
        Q.where('date', Q.between(startDate.getTime(), endDate.getTime()))
      )
      .fetch();
    const decryptedBodyFats = await Promise.all(bodyFats.map((w) => w.getDecrypted()));
    const avgBodyFat =
      decryptedBodyFats.length > 0
        ? decryptedBodyFats.reduce((acc, w) => acc + w.value, 0) / decryptedBodyFats.length
        : null;

    // 5. Active Minutes
    const activeMinutes = workouts.reduce((acc, w) => {
      if (w.completedAt && w.startedAt) {
        return acc + Math.round((w.completedAt - w.startedAt) / 60000);
      }
      return acc;
    }, 0);

    const prevWorkouts = await database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('started_at', Q.between(prevStartDate.getTime(), startDate.getTime())))
      .fetch();
    const prevActiveMinutes = prevWorkouts.reduce((acc, w) => {
      if (w.completedAt && w.startedAt) {
        return acc + Math.round((w.completedAt - w.startedAt) / 60000);
      }
      return acc;
    }, 0);
    const activeMinutesTrend = activeMinutes - prevActiveMinutes;

    // Daily weights for the chart
    const dailyWeights = Array.from({ length: 7 }).map((_, i) => {
      const dateStr = format(subDays(endDate, 6 - i), 'yyyy-MM-dd');
      const weightForDay = decryptedWeights.find((w) => format(w.date, 'yyyy-MM-dd') === dateStr);
      return { value: weightForDay ? weightForDay.value : avgWeight };
    });

    // Determine status
    let status: CheckinStatus = 'onTrack';
    const weightDiffPercent = ((avgWeight - checkin.targetWeight) / checkin.targetWeight) * 100;

    if (weightDiffPercent < -0.5) {
      status = 'ahead';
    } else if (weightDiffPercent > 0.5) {
      status = 'behind';
    }

    // Week Info
    const weekInfo = { current: 1, total: 12 };

    return {
      avgWeight,
      trend,
      avgCalories,
      consistency,
      avgBodyFat,
      activeMinutes,
      activeMinutesTrend,
      dailyWeights,
      workoutsCount: workouts.length,
      weekInfo,
      status,
      hasEnoughData,
    };
  }
}
