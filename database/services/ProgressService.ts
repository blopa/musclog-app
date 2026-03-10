import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Exercise from '../models/Exercise';
import NutritionLog from '../models/NutritionLog';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogExercise from '../models/WorkoutLogExercise';
import WorkoutLogSet from '../models/WorkoutLogSet';
import UserMetric, { UserMetricType } from '../models/UserMetric';
import { UserMetricService } from './UserMetricService';
import { NutritionService } from './NutritionService';
import { SettingsService } from './SettingsService';
import { UserService } from './UserService';
import { NutritionGoalService } from './NutritionGoalService';
import { ffmiFromWeightHeightAndBodyFat, calculateTDEE } from '../../utils/nutritionCalculator';

export interface MetricPoint {
  date: number;
  value: number;
}

export interface DailyNutrition {
  date: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface WorkoutVolumePoint {
  date: number;
  volume: number;
}

export interface MuscleGroupSets {
  muscleGroup: string;
  sets: number;
}

export interface ProgressInsights {
  tdee: number;
  tdeeUsedEmpirical: boolean;
  avgWeight: number;
  weightChangeWeekly: number;
  avgFatPercent: number;
  fatPercentChangeWeekly: number;
  leanBodyMassChange: number;
  fatMassChange: number;
  weightTrend: 'up' | 'down' | 'stable';
  eatingPhase: string;
  targetWeights: {
    bf5: number;
    bf10: number;
    bf15: number;
    bf20: number;
  };
}

export interface ProgressData {
  weightHistory: MetricPoint[];
  fatHistory: MetricPoint[];
  ffmiHistory: MetricPoint[];
  nutritionHistory: DailyNutrition[];
  workoutVolumeHistory: WorkoutVolumePoint[];
  muscleGroupSets: MuscleGroupSets[];
  measurementsHistory: Record<string, MetricPoint[]>;
  insights: ProgressInsights;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ProgressService {
  /**
   * Main entry point to fetch all data for the progress screen
   */
  static async getProgressData(
    startDate: number,
    endDate: number,
    useWeeklyAverages: boolean = false
  ): Promise<ProgressData> {
    const units = await SettingsService.getUnits();
    const isImperial = units === 'imperial';
    const dateRange = { startDate, endDate };

    // 1. Fetch Body Metrics
    const weightMetrics = await UserMetricService.getMetricsHistory('weight', dateRange);
    const fatMetrics = await UserMetricService.getMetricsHistory('body_fat', dateRange);
    const heightMetric = await UserMetricService.getLatest('height');

    let heightCm = 0;
    if (heightMetric) {
      const decHeight = await heightMetric.getDecrypted();
      heightCm = decHeight.unit === 'in' ? decHeight.value * 2.54 : decHeight.value;
    }

    const weightPoints = await this.decryptMetricPoints(weightMetrics, isImperial);
    const fatPoints = await this.decryptMetricPoints(fatMetrics, false);

    // 2. Fetch Nutrition
    const nutritionLogs = await NutritionService.getNutritionLogsForDateRange(
      new Date(startDate),
      new Date(endDate)
    );
    const nutritionDaily = await this.aggregateNutritionDaily(nutritionLogs);

    // 3. Fetch Workouts
    const workoutLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('started_at', Q.between(startDate, endDate)),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    const workoutVolumeHistory = await this.calculateWorkoutVolumeHistory(workoutLogs);
    const muscleGroupSets = useWeeklyAverages
      ? []
      : await this.calculateMuscleGroupSets(workoutLogs);

    // 4. Fetch Measurements
    const measurementTypes: UserMetricType[] = [
      'chest',
      'waist',
      'hips',
      'arms',
      'thighs',
      'calves',
      'neck',
      'shoulders',
    ];
    const measurementsHistory: Record<string, MetricPoint[]> = {};
    for (const type of measurementTypes) {
      const metrics = await UserMetricService.getMetricsHistory(type, dateRange);
      if (metrics.length > 0) {
        measurementsHistory[type] = await this.decryptMetricPoints(metrics, isImperial);
      }
    }

    // 5. Calculate FFMI
    const ffmiHistory = this.calculateFFMIHistory(weightPoints, fatPoints, heightCm, isImperial);

    // 6. Handle Weekly Averages if requested
    let finalWeightPoints = weightPoints;
    let finalFatPoints = fatPoints;
    let finalFfmiPoints = ffmiHistory;
    let finalNutritionPoints = nutritionDaily;
    let finalWorkoutVolume = workoutVolumeHistory;

    if (useWeeklyAverages) {
      finalWeightPoints = this.aggregateMetricWeekly(weightPoints);
      finalFatPoints = this.aggregateMetricWeekly(fatPoints);
      finalFfmiPoints = this.aggregateMetricWeekly(ffmiHistory);
      finalNutritionPoints = this.aggregateNutritionWeekly(nutritionDaily);
      finalWorkoutVolume = this.aggregateVolumeWeekly(workoutVolumeHistory);
    }

    // 7. Calculate Insights
    const insights = await this.calculateInsights(
      weightPoints,
      fatPoints,
      nutritionDaily,
      heightCm,
      startDate,
      endDate,
      isImperial
    );

    return {
      weightHistory: finalWeightPoints,
      fatHistory: finalFatPoints,
      ffmiHistory: finalFfmiPoints,
      nutritionHistory: finalNutritionPoints,
      workoutVolumeHistory: finalWorkoutVolume,
      muscleGroupSets,
      measurementsHistory,
      insights,
    };
  }

  private static async decryptMetricPoints(
    metrics: UserMetric[],
    _isImperial: boolean
  ): Promise<MetricPoint[]> {
    const points = await Promise.all(
      metrics.map(async (m) => {
        const d = await m.getDecrypted();
        // The value returned by getDecrypted should already be converted or we should convert it here
        // Based on UserMetricService, we store what user entered.
        return { date: m.date, value: d.value };
      })
    );
    return points.sort((a, b) => a.date - b.date);
  }

  private static async aggregateNutritionDaily(logs: NutritionLog[]): Promise<DailyNutrition[]> {
    const dailyMap = new Map<number, DailyNutrition>();

    for (const log of logs) {
      const nutrients = await log.getNutrients();
      const date = log.date;
      const existing = dailyMap.get(date) || {
        date,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      };

      existing.calories += nutrients.calories;
      existing.protein += nutrients.protein;
      existing.carbs += nutrients.carbs;
      existing.fat += nutrients.fat;
      existing.fiber += nutrients.fiber;

      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date - b.date);
  }

  private static calculateFFMIHistory(
    weightPoints: MetricPoint[],
    fatPoints: MetricPoint[],
    heightCm: number,
    isImperial: boolean
  ): MetricPoint[] {
    if (heightCm <= 0) return [];

    const heightM = heightCm / 100;
    const history: MetricPoint[] = [];

    for (const wp of weightPoints) {
      if (fatPoints.length === 0) break;
      const closestFat = fatPoints.reduce((prev, curr) =>
        Math.abs(curr.date - wp.date) < Math.abs(prev.date - wp.date) ? curr : prev
      );

      if (closestFat && Math.abs(closestFat.date - wp.date) < 7 * MS_PER_DAY) {
        let weightKg = wp.value;
        if (isImperial) {
          weightKg = wp.value * 0.453592;
        }
        const ffmi = ffmiFromWeightHeightAndBodyFat(weightKg, heightM, closestFat.value);
        history.push({ date: wp.date, value: ffmi });
      }
    }

    return history;
  }

  private static async calculateWorkoutVolumeHistory(
    logs: WorkoutLog[]
  ): Promise<WorkoutVolumePoint[]> {
    return logs
      .map((log) => ({
        date: log.startedAt ?? 0,
        volume: log.totalVolume ?? 0,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static async calculateMuscleGroupSets(logs: WorkoutLog[]): Promise<MuscleGroupSets[]> {
    if (logs.length === 0) return [];
    const muscleGroupSets = new Map<string, number>();

    const logIds = logs.map((l) => l.id);
    const allLogExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', Q.oneOf(logIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (allLogExercises.length === 0) return [];

    const exerciseIds = [...new Set(allLogExercises.map((le) => le.exerciseId))];
    const allExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('id', Q.oneOf(exerciseIds)))
      .fetch();
    const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

    const logExIds = allLogExercises.map((le) => le.id);
    const allSets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(logExIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const setCountsByLogEx = new Map<string, number>();
    for (const s of allSets) {
      const count = setCountsByLogEx.get(s.logExerciseId) || 0;
      setCountsByLogEx.set(s.logExerciseId, count + 1);
    }

    for (const le of allLogExercises) {
      const exercise = exerciseMap.get(le.exerciseId);
      const muscleGroup = exercise?.muscleGroup || 'Other';
      const sets = setCountsByLogEx.get(le.id) || 0;

      const current = muscleGroupSets.get(muscleGroup) || 0;
      muscleGroupSets.set(muscleGroup, current + sets);
    }

    return Array.from(muscleGroupSets.entries())
      .map(([muscleGroup, sets]) => ({
        muscleGroup,
        sets,
      }))
      .sort((a, b) => b.sets - a.sets);
  }

  private static aggregateMetricWeekly(points: MetricPoint[]): MetricPoint[] {
    if (points.length === 0) return [];
    const weeksMap = new Map<number, number[]>();

    // Use Sunday-to-Saturday weeks or just 7-day windows?
    // Let's use 7-day windows from the first point for simplicity
    const firstDate = points[0].date;

    for (const p of points) {
      const weekIndex = Math.floor((p.date - firstDate) / (7 * MS_PER_DAY));
      const existing = weeksMap.get(weekIndex) || [];
      existing.push(p.value);
      weeksMap.set(weekIndex, existing);
    }

    return Array.from(weeksMap.entries())
      .map(([index, values]) => ({
        date: firstDate + index * 7 * MS_PER_DAY,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static aggregateNutritionWeekly(daily: DailyNutrition[]): DailyNutrition[] {
    if (daily.length === 0) return [];
    const weeksMap = new Map<number, DailyNutrition[]>();
    const firstDate = daily[0].date;

    for (const d of daily) {
      const weekIndex = Math.floor((d.date - firstDate) / (7 * MS_PER_DAY));
      const existing = weeksMap.get(weekIndex) || [];
      existing.push(d);
      weeksMap.set(weekIndex, existing);
    }

    return Array.from(weeksMap.entries())
      .map(([index, days]) => {
        const sum = days.reduce(
          (acc, curr) => {
            acc.calories += curr.calories;
            acc.protein += curr.protein;
            acc.carbs += curr.carbs;
            acc.fat += curr.fat;
            acc.fiber += curr.fiber;
            return acc;
          },
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        );

        const count = days.length;
        return {
          date: firstDate + index * 7 * MS_PER_DAY,
          calories: sum.calories / count,
          protein: sum.protein / count,
          carbs: sum.carbs / count,
          fat: sum.fat / count,
          fiber: sum.fiber / count,
        };
      })
      .sort((a, b) => a.date - b.date);
  }

  private static aggregateVolumeWeekly(points: WorkoutVolumePoint[]): WorkoutVolumePoint[] {
    if (points.length === 0) return [];
    const weeksMap = new Map<number, number>();
    const firstDate = points[0].date;

    for (const p of points) {
      const weekIndex = Math.floor((p.date - firstDate) / (7 * MS_PER_DAY));
      const existing = weeksMap.get(weekIndex) || 0;
      weeksMap.set(weekIndex, existing + p.volume);
    }

    return Array.from(weeksMap.entries())
      .map(([index, volume]) => ({
        date: firstDate + index * 7 * MS_PER_DAY,
        volume,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static async calculateInsights(
    weightPoints: MetricPoint[],
    fatPoints: MetricPoint[],
    nutritionDaily: DailyNutrition[],
    heightCm: number,
    startDate: number,
    endDate: number,
    isImperial: boolean
  ): Promise<ProgressInsights> {
    const user = await UserService.getUser();
    const currentGoal = await NutritionGoalService.getCurrent();
    const eatingPhase = currentGoal?.eatingPhase || 'maintain';

    const lookbackDays = Math.max(1, Math.ceil((endDate - startDate) / MS_PER_DAY));
    const totalCalories = nutritionDaily.reduce((acc, curr) => acc + curr.calories, 0);

    let initialWeight = weightPoints[0]?.value || 0;
    let finalWeight = weightPoints[weightPoints.length - 1]?.value || 0;
    const initialFat = fatPoints[0]?.value;
    const finalFat = fatPoints[fatPoints.length - 1]?.value;

    if (isImperial) {
      initialWeight = initialWeight * 0.453592;
      finalWeight = finalWeight * 0.453592;
    }

    const tdee = calculateTDEE({
      totalCalories,
      totalDays: lookbackDays,
      initialWeight,
      finalWeight,
      initialFatPercentage: initialFat,
      finalFatPercentage: finalFat,
      bmr: 2000,
      activityLevel: user?.activityLevel || 3,
      liftingExperience: user?.liftingExperience || 'intermediate',
    });

    const usedEmpirical = totalCalories > 0 && weightPoints.length >= 2;

    const weeklyAverages = this.aggregateMetricWeekly(weightPoints);
    let weightChangeWeekly = 0;
    if (weeklyAverages.length >= 2) {
      const first = weeklyAverages[0].value;
      const last = weeklyAverages[weeklyAverages.length - 1].value;
      weightChangeWeekly = (last - first) / Math.max(1, weeklyAverages.length - 1);
    }

    const fatWeeklyAverages = this.aggregateMetricWeekly(fatPoints);
    let fatPercentChangeWeekly = 0;
    if (fatWeeklyAverages.length >= 2) {
      const first = fatWeeklyAverages[0].value;
      const last = fatWeeklyAverages[fatWeeklyAverages.length - 1].value;
      fatPercentChangeWeekly = (last - first) / Math.max(1, fatWeeklyAverages.length - 1);
    }

    let leanBodyMassChange = 0;
    let fatMassChange = 0;
    if (
      initialWeight > 0 &&
      finalWeight > 0 &&
      initialFat !== undefined &&
      finalFat !== undefined
    ) {
      const initialLBM = initialWeight * (1 - initialFat / 100);
      const finalLBM = finalWeight * (1 - finalFat / 100);
      const initialFatMass = initialWeight * (initialFat / 100);
      const finalFatMass = finalWeight * (finalFat / 100);

      leanBodyMassChange = finalLBM - initialLBM;
      fatMassChange = finalFatMass - initialFatMass;

      if (isImperial) {
        leanBodyMassChange /= 0.453592;
        fatMassChange /= 0.453592;
      }
    }

    let targetWeights = { bf5: 0, bf10: 0, bf15: 0, bf20: 0 };
    if (finalWeight > 0 && finalFat !== undefined) {
      const currentLBM = finalWeight * (1 - finalFat / 100);
      targetWeights = {
        bf5: currentLBM / (1 - 0.05),
        bf10: currentLBM / (1 - 0.1),
        bf15: currentLBM / (1 - 0.15),
        bf20: currentLBM / (1 - 0.2),
      };

      if (isImperial) {
        targetWeights.bf5 /= 0.453592;
        targetWeights.bf10 /= 0.453592;
        targetWeights.bf15 /= 0.453592;
        targetWeights.bf20 /= 0.453592;
      }
    }

    const weightTrend =
      Math.abs(weightChangeWeekly) < 0.05 ? 'stable' : weightChangeWeekly > 0 ? 'up' : 'down';

    return {
      tdee,
      tdeeUsedEmpirical: usedEmpirical,
      avgWeight: finalWeight / (isImperial ? 0.453592 : 1),
      weightChangeWeekly,
      avgFatPercent: finalFat || 0,
      fatPercentChangeWeekly,
      leanBodyMassChange,
      fatMassChange,
      weightTrend,
      eatingPhase,
      targetWeights,
    };
  }
}
