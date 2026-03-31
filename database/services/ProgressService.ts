import { Q } from '@nozbe/watermelondb';
import convert from 'convert';

import { localDayStartFromUtcMs, localDayStartMs } from '../../utils/calendarDate';
import {
  calculateBMR,
  calculateBMRKatchMcArdle,
  calculateTDEE,
  ffmiFromWeightHeightAndBodyFat,
  isValidBodyFat,
} from '../../utils/nutritionCalculator';
import { calculateEmpiricalTDEEWindow } from '../../utils/progress';
import { database } from '../index';
import Exercise from '../models/Exercise';
import MenstrualCycle from '../models/MenstrualCycle';
import NutritionLog from '../models/NutritionLog';
import UserMetric, { UserMetricType } from '../models/UserMetric';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogExercise from '../models/WorkoutLogExercise';
import WorkoutLogSet from '../models/WorkoutLogSet';
import { NutritionGoalService } from './NutritionGoalService';
import { NutritionService } from './NutritionService';
import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';
import { UserService } from './UserService';

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

/** Per-day averages: sum of logged intake divided by number of days with nutrition logs. */
export interface AverageIntakeForPeriod {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  dayCount: number;
}

export interface ProgressInsights {
  tdee: number;
  empiricalTdee: number;
  statisticalTdee: number;
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
  averageIntake: AverageIntakeForPeriod | null;
}

export interface CorrelationPoint {
  date: number;
  weeklyVolume: number;
  dailyCalories: number;
}

export interface BodyCompProteinPoint {
  date: number;
  protein: number;
  weightChange: number;
  fatChange: number;
}

export interface MenstrualPhasePoint {
  date: number;
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
  workoutScore: number;
  energyLevel: number;
  weight: number;
}

export interface RecoveryTrainingPoint {
  date: number;
  volume: number;
  exhaustion: number;
  caloriesBurned: number;
}

export interface MacroMusclePoint {
  date: number;
  protein: number;
  carbs: number;
  fat: number;
  muscleGroupVolume: Record<string, number>;
}

export interface MoodPoint {
  date: number;
  mood: number; // average 0-4
}

export interface MoodCaloriesPoint {
  date: number;
  mood: number;
  calories: number;
}

export interface MoodVolumePoint {
  date: number;
  mood: number;
  volume: number;
}

export interface MoodMacrosPoint {
  date: number;
  mood: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type TimeAggregation = 'daily' | 'weekly' | 'monthly';

export interface ProgressData {
  weightHistory: MetricPoint[];
  fatHistory: MetricPoint[];
  ffmiHistory: MetricPoint[];
  nutritionHistory: DailyNutrition[];
  workoutVolumeHistory: WorkoutVolumePoint[];
  muscleGroupSets: MuscleGroupSets[];
  measurementsHistory: Record<string, MetricPoint[]>;
  insights: ProgressInsights;
  correlationHistory: CorrelationPoint[];
  bodyCompProteinHistory: BodyCompProteinPoint[];
  menstrualPhaseHistory: MenstrualPhasePoint[];
  recoveryTrainingHistory: RecoveryTrainingPoint[];
  macroMuscleHistory: MacroMusclePoint[];
  moodHistory: MoodPoint[];
  moodCaloriesHistory: MoodCaloriesPoint[];
  moodVolumeHistory: MoodVolumePoint[];
  moodMacrosHistory: MoodMacrosPoint[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ProgressService {
  /**
   * Main entry point to fetch all data for the progress screen
   */
  static async getProgressData(
    startDate: number,
    endDate: number,
    useWeeklyAverages: boolean = false,
    aggregation: TimeAggregation = 'daily'
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
      heightCm =
        decHeight.unit === 'in'
          ? (convert(decHeight.value, 'in').to('cm') as number)
          : decHeight.value;
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

    // 5. Fetch Mood Metrics
    const moodMetrics = await UserMetricService.getMetricsHistory('mood', dateRange);
    const moodPoints = await this.decryptMetricPoints(moodMetrics, false);

    // 5b. Calculate FFMI
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

    // 8. Calculate New Correlation Data
    const correlationHistory = this.calculateCorrelationHistory(
      workoutVolumeHistory,
      nutritionDaily,
      aggregation
    );
    const bodyCompProteinHistory = this.calculateBodyCompProteinHistory(
      weightPoints,
      fatPoints,
      nutritionDaily,
      aggregation
    );

    const menstrualPhaseHistory = await this.calculateMenstrualPhaseHistory(
      weightPoints,
      workoutLogs,
      startDate,
      endDate,
      aggregation
    );

    const recoveryTrainingHistory = this.calculateRecoveryTrainingHistory(workoutLogs, aggregation);

    const macroMuscleHistory = await this.calculateMacroMuscleHistory(
      nutritionDaily,
      workoutLogs,
      startDate,
      endDate,
      aggregation
    );

    const moodHistory = this.calculateMoodHistory(moodPoints, aggregation);
    const moodCaloriesHistory = this.calculateMoodCaloriesHistory(
      moodPoints,
      nutritionDaily,
      aggregation
    );
    const moodVolumeHistory = this.calculateMoodVolumeHistory(
      moodPoints,
      workoutVolumeHistory,
      aggregation
    );
    const moodMacrosHistory = this.calculateMoodMacrosHistory(
      moodPoints,
      nutritionDaily,
      aggregation
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
      correlationHistory,
      bodyCompProteinHistory,
      menstrualPhaseHistory,
      recoveryTrainingHistory,
      macroMuscleHistory,
      moodHistory,
      moodCaloriesHistory,
      moodVolumeHistory,
      moodMacrosHistory,
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
      const date = localDayStartFromUtcMs(log.date);
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
    if (heightCm <= 0) {
      return [];
    }

    const heightM = convert(heightCm, 'cm').to('m') as number;
    const history: MetricPoint[] = [];

    for (const wp of weightPoints) {
      if (fatPoints.length === 0) {
        break;
      }
      const closestFat = fatPoints.reduce((prev, curr) =>
        Math.abs(curr.date - wp.date) < Math.abs(prev.date - wp.date) ? curr : prev
      );

      if (closestFat && Math.abs(closestFat.date - wp.date) < 7 * MS_PER_DAY) {
        let weightKg = wp.value;
        if (isImperial) {
          weightKg = convert(wp.value, 'lb').to('kg') as number;
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
    if (logs.length === 0) {
      return [];
    }
    const muscleGroupSets = new Map<string, number>();

    const logIds = logs.map((l) => l.id);
    const allLogExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', Q.oneOf(logIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (allLogExercises.length === 0) {
      return [];
    }

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
    if (points.length === 0) {
      return [];
    }
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
    if (daily.length === 0) {
      return [];
    }
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
    if (points.length === 0) {
      return [];
    }
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
    const user = await UserService.getCurrentUser();
    const currentGoal = await NutritionGoalService.getCurrent();
    const eatingPhase = currentGoal?.eatingPhase || 'maintain';

    // For empirical TDEE, we find the tracking window and anchor values.
    const {
      empiricalStart,
      empiricalEnd,
      initialWeight: initW,
      finalWeight: finW,
      initialFat,
      finalFat,
      empiricalDays,
    } = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, startDate, endDate);

    let initialWeight = initW;
    let finalWeight = finW;

    // Only include calories within the period covered by the measurements.
    // We use [start, end) interval for calories because the final weight measurement
    // is typically taken at the start of the final day.
    const empiricalStartKey = localDayStartFromUtcMs(empiricalStart);
    const empiricalEndKey = localDayStartFromUtcMs(empiricalEnd);

    const empiricalCalories = nutritionDaily
      .filter((n) => n.date >= empiricalStartKey && n.date < empiricalEndKey)
      .reduce((acc, curr) => acc + curr.calories, 0);

    if (isImperial) {
      initialWeight = convert(initialWeight, 'lb').to('kg') as number;
      finalWeight = convert(finalWeight, 'lb').to('kg') as number;
    }

    const gender = user?.gender || 'male';
    const weightKg =
      finalWeight ||
      (isImperial
        ? (convert(initialWeight || 70, 'lb').to('kg') as number)
        : initialWeight || 70) ||
      70;
    const dob = user?.dateOfBirth || localDayStartMs(new Date(1990, 0, 1));
    const age = Math.floor((new Date().getTime() - dob) / (365.25 * 24 * 60 * 60 * 1000));

    const bmr = isValidBodyFat(finalFat)
      ? calculateBMRKatchMcArdle(weightKg, finalFat)
      : calculateBMR(gender, weightKg, heightCm || 170, age);

    const empiricalTdee = calculateTDEE({
      totalCalories: empiricalCalories,
      totalDays: empiricalDays,
      initialWeight,
      finalWeight,
      initialFatPercentage: initialFat,
      finalFatPercentage: finalFat,
      liftingExperience: user?.liftingExperience || 'intermediate',
    });

    const statisticalTdee = calculateTDEE({
      bmr,
      activityLevel: user?.activityLevel || 3,
    });

    const usedEmpirical = empiricalCalories > 0 && empiricalDays > 0 && weightPoints.length >= 2;
    const tdee = usedEmpirical ? empiricalTdee : statisticalTdee;

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
        leanBodyMassChange = convert(leanBodyMassChange, 'kg').to('lb') as number;
        fatMassChange = convert(fatMassChange, 'kg').to('lb') as number;
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
        targetWeights.bf5 = convert(targetWeights.bf5, 'kg').to('lb') as number;
        targetWeights.bf10 = convert(targetWeights.bf10, 'kg').to('lb') as number;
        targetWeights.bf15 = convert(targetWeights.bf15, 'kg').to('lb') as number;
        targetWeights.bf20 = convert(targetWeights.bf20, 'kg').to('lb') as number;
      }
    }

    const weightTrend =
      Math.abs(weightChangeWeekly) < 0.05 ? 'stable' : weightChangeWeekly > 0 ? 'up' : 'down';

    const intakeDayCount = nutritionDaily.length;
    let averageIntake: AverageIntakeForPeriod | null = null;
    if (intakeDayCount > 0) {
      const totals = nutritionDaily.reduce(
        (acc, n) => ({
          calories: acc.calories + n.calories,
          protein: acc.protein + n.protein,
          carbs: acc.carbs + n.carbs,
          fat: acc.fat + n.fat,
          fiber: acc.fiber + n.fiber,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
      const d = intakeDayCount;
      averageIntake = {
        calories: totals.calories / d,
        protein: totals.protein / d,
        carbs: totals.carbs / d,
        fat: totals.fat / d,
        fiber: totals.fiber / d,
        dayCount: d,
      };
    }

    return {
      tdee,
      empiricalTdee,
      statisticalTdee,
      tdeeUsedEmpirical: usedEmpirical,
      avgWeight: isImperial ? (convert(finalWeight, 'kg').to('lb') as number) : finalWeight,
      weightChangeWeekly,
      avgFatPercent: finalFat || 0,
      fatPercentChangeWeekly,
      leanBodyMassChange,
      fatMassChange,
      weightTrend,
      eatingPhase,
      targetWeights,
      averageIntake,
    };
  }

  private static getStartOfAggregation(date: number, aggregation: TimeAggregation): number {
    const d = new Date(localDayStartFromUtcMs(date));
    if (aggregation === 'weekly') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      d.setDate(diff);
    } else if (aggregation === 'monthly') {
      d.setDate(1);
    }
    return localDayStartMs(d);
  }

  private static calculateCorrelationHistory(
    workoutVolumeHistory: WorkoutVolumePoint[],
    nutritionDaily: DailyNutrition[],
    aggregation: TimeAggregation
  ): CorrelationPoint[] {
    const groupedData = new Map<number, { volume: number; calories: number; count: number }>();

    for (const n of nutritionDaily) {
      const start = this.getStartOfAggregation(n.date, aggregation);
      const existing = groupedData.get(start) || { volume: 0, calories: 0, count: 0 };
      existing.calories += n.calories;
      existing.count += 1;
      groupedData.set(start, existing);
    }

    for (const v of workoutVolumeHistory) {
      const start = this.getStartOfAggregation(v.date, aggregation);
      const existing = groupedData.get(start);
      if (existing) {
        existing.volume += v.volume;
      }
    }

    return Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        weeklyVolume: aggregation === 'daily' ? data.volume : data.volume, // Sum for week/month
        dailyCalories: data.calories / data.count, // Average for week/month
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static calculateBodyCompProteinHistory(
    weightPoints: MetricPoint[],
    fatPoints: MetricPoint[],
    nutritionDaily: DailyNutrition[],
    aggregation: TimeAggregation
  ): BodyCompProteinPoint[] {
    const groupedData = new Map<number, { protein: number; count: number }>();

    for (const n of nutritionDaily) {
      const start = this.getStartOfAggregation(n.date, aggregation);
      const existing = groupedData.get(start) || { protein: 0, count: 0 };
      existing.protein += n.protein;
      existing.count += 1;
      groupedData.set(start, existing);
    }

    const history: BodyCompProteinPoint[] = [];
    const sortedStarts = Array.from(groupedData.keys()).sort();

    for (let i = 1; i < sortedStarts.length; i++) {
      const start = sortedStarts[i];
      const prevStart = sortedStarts[i - 1];
      const data = groupedData.get(start)!;

      const weight = weightPoints.find((wp) => Math.abs(wp.date - start) < MS_PER_DAY);
      const prevWeight = weightPoints.find((wp) => Math.abs(wp.date - prevStart) < MS_PER_DAY);

      const fat = fatPoints.find((fp) => Math.abs(fp.date - start) < MS_PER_DAY);
      const prevFat = fatPoints.find((fp) => Math.abs(fp.date - prevStart) < MS_PER_DAY);

      if (weight && prevWeight) {
        history.push({
          date: start,
          protein: data.protein / data.count,
          weightChange: weight.value - prevWeight.value,
          fatChange: fat && prevFat ? fat.value - prevFat.value : 0,
        });
      }
    }

    return history;
  }

  private static async calculateMenstrualPhaseHistory(
    weightPoints: MetricPoint[],
    workoutLogs: WorkoutLog[],
    startDate: number,
    endDate: number,
    aggregation: TimeAggregation
  ): Promise<MenstrualPhasePoint[]> {
    const cycle = await database
      .get<MenstrualCycle>('menstrual_cycles')
      .query(Q.where('is_active', Q.eq(true)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (cycle.length === 0) {
      return [];
    }

    const c = cycle[0];
    const history: MenstrualPhasePoint[] = [];

    // Get energy levels from user metrics
    const energyMetrics = await UserMetricService.getMetricsHistory('mood', { startDate, endDate });
    const energyPoints = await this.decryptMetricPoints(energyMetrics, false);

    const step =
      aggregation === 'daily'
        ? MS_PER_DAY
        : aggregation === 'weekly'
          ? MS_PER_DAY * 7
          : MS_PER_DAY * 30;

    for (let d = startDate; d <= endDate; d += step) {
      const dayTs = this.getStartOfAggregation(d, aggregation);

      // Determine phase
      const daysSinceStart = Math.floor((dayTs - c.lastPeriodStartDate) / MS_PER_DAY);
      const cycleDay = ((daysSinceStart % c.avgCycleLength) + c.avgCycleLength) % c.avgCycleLength;

      let phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
      if (cycleDay < c.avgPeriodDuration) {
        phase = 'menstrual';
      } else if (cycleDay < c.avgCycleLength / 2 - 2) {
        phase = 'follicular';
      } else if (cycleDay < c.avgCycleLength / 2 + 2) {
        phase = 'ovulatory';
      } else {
        phase = 'luteal';
      }

      const workoutsInPeriod = workoutLogs.filter((wl) => {
        const start = this.getStartOfAggregation(wl.startedAt || 0, aggregation);
        return start === dayTs;
      });

      const avgWorkoutScore =
        workoutsInPeriod.length > 0
          ? workoutsInPeriod.reduce((acc, wl) => acc + (wl.workoutScore || 0), 0) /
            workoutsInPeriod.length
          : 0;

      const weight = weightPoints.find((wp) => Math.abs(wp.date - dayTs) < MS_PER_DAY);
      const energiesInPeriod = energyPoints.filter((ep) => {
        const start = this.getStartOfAggregation(ep.date, aggregation);
        return start === dayTs;
      });
      const avgEnergy =
        energiesInPeriod.length > 0
          ? energiesInPeriod.reduce((acc, ep) => acc + ep.value, 0) / energiesInPeriod.length
          : 0;

      history.push({
        date: dayTs,
        phase,
        workoutScore: avgWorkoutScore,
        energyLevel: avgEnergy,
        weight: weight?.value || 0,
      });
    }

    return history;
  }

  private static calculateRecoveryTrainingHistory(
    workoutLogs: WorkoutLog[],
    aggregation: TimeAggregation
  ): RecoveryTrainingPoint[] {
    const groupedData = new Map<
      number,
      { volume: number; exhaustion: number; calories: number; count: number }
    >();

    for (const wl of workoutLogs) {
      const start = this.getStartOfAggregation(wl.startedAt || 0, aggregation);
      const existing = groupedData.get(start) || {
        volume: 0,
        exhaustion: 0,
        calories: 0,
        count: 0,
      };
      existing.volume += wl.totalVolume || 0;
      existing.exhaustion += wl.exhaustionLevel || 0;
      existing.calories += wl.caloriesBurned || 0;
      existing.count += 1;
      groupedData.set(start, existing);
    }

    return Array.from(groupedData.entries())
      .map(([date, data]) => ({
        date,
        volume: data.volume,
        exhaustion: data.exhaustion / data.count,
        caloriesBurned: data.calories,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static async calculateMacroMuscleHistory(
    nutritionDaily: DailyNutrition[],
    workoutLogs: WorkoutLog[],
    startDate: number,
    endDate: number,
    aggregation: TimeAggregation
  ): Promise<MacroMusclePoint[]> {
    const history: MacroMusclePoint[] = [];

    // Get all exercises in these logs to group by muscle group
    const logIds = workoutLogs.map((l) => l.id);
    const allLogExercises =
      logIds.length > 0
        ? await database
            .get<WorkoutLogExercise>('workout_log_exercises')
            .query(Q.where('workout_log_id', Q.oneOf(logIds)), Q.where('deleted_at', Q.eq(null)))
            .fetch()
        : [];

    const exerciseIds = [...new Set(allLogExercises.map((le) => le.exerciseId))];
    const allExercises =
      exerciseIds.length > 0
        ? await database
            .get<Exercise>('exercises')
            .query(Q.where('id', Q.oneOf(exerciseIds)))
            .fetch()
        : [];
    const exerciseMap = new Map(allExercises.map((e) => [e.id, e]));

    // Fetch all sets for all log exercises at once
    const logExIds = allLogExercises.map((le) => le.id);
    const allSets =
      logExIds.length > 0
        ? await database
            .get<WorkoutLogSet>('workout_log_sets')
            .query(Q.where('log_exercise_id', Q.oneOf(logExIds)), Q.where('deleted_at', Q.eq(null)))
            .fetch()
        : [];

    const setsByLogExId = new Map<string, WorkoutLogSet[]>();
    for (const s of allSets) {
      const existing = setsByLogExId.get(s.logExerciseId) || [];
      existing.push(s);
      setsByLogExId.set(s.logExerciseId, existing);
    }

    const groupedNutrition = new Map<
      number,
      { protein: number; carbs: number; fat: number; count: number }
    >();
    for (const n of nutritionDaily) {
      const start = this.getStartOfAggregation(n.date, aggregation);
      const existing = groupedNutrition.get(start) || { protein: 0, carbs: 0, fat: 0, count: 0 };
      existing.protein += n.protein;
      existing.carbs += n.carbs;
      existing.fat += n.fat;
      existing.count += 1;
      groupedNutrition.set(start, existing);
    }

    const groupedMuscleVol = new Map<number, Record<string, number>>();

    for (const log of workoutLogs) {
      const start = this.getStartOfAggregation(log.startedAt || 0, aggregation);
      const muscleGroupVolume = groupedMuscleVol.get(start) || {};
      const logExs = allLogExercises.filter((le) => le.workoutLogId === log.id);
      for (const le of logExs) {
        const exercise = exerciseMap.get(le.exerciseId);
        const muscleGroup = exercise?.muscleGroup || 'Other';

        const sets = setsByLogExId.get(le.id) || [];
        const volume = sets.reduce((acc, s) => acc + s.reps * s.weight, 0);
        muscleGroupVolume[muscleGroup] = (muscleGroupVolume[muscleGroup] || 0) + volume;
      }
      groupedMuscleVol.set(start, muscleGroupVolume);
    }

    for (const [date, nut] of groupedNutrition.entries()) {
      history.push({
        date,
        protein: nut.protein / nut.count,
        carbs: nut.carbs / nut.count,
        fat: nut.fat / nut.count,
        muscleGroupVolume: groupedMuscleVol.get(date) || {},
      });
    }

    return history.sort((a, b) => a.date - b.date);
  }

  private static calculateMoodHistory(
    moodPoints: MetricPoint[],
    aggregation: TimeAggregation
  ): MoodPoint[] {
    const grouped = new Map<number, { sum: number; count: number }>();
    for (const mp of moodPoints) {
      const start = this.getStartOfAggregation(mp.date, aggregation);
      const existing = grouped.get(start) || { sum: 0, count: 0 };
      existing.sum += mp.value;
      existing.count += 1;
      grouped.set(start, existing);
    }
    return Array.from(grouped.entries())
      .map(([date, data]) => ({ date, mood: data.sum / data.count }))
      .sort((a, b) => a.date - b.date);
  }

  private static calculateMoodCaloriesHistory(
    moodPoints: MetricPoint[],
    nutritionDaily: DailyNutrition[],
    aggregation: TimeAggregation
  ): MoodCaloriesPoint[] {
    const grouped = new Map<
      number,
      { moodSum: number; moodCount: number; calories: number; calCount: number }
    >();

    for (const mp of moodPoints) {
      const start = this.getStartOfAggregation(mp.date, aggregation);
      const existing = grouped.get(start) || {
        moodSum: 0,
        moodCount: 0,
        calories: 0,
        calCount: 0,
      };
      existing.moodSum += mp.value;
      existing.moodCount += 1;
      grouped.set(start, existing);
    }

    for (const n of nutritionDaily) {
      const start = this.getStartOfAggregation(n.date, aggregation);
      const existing = grouped.get(start);
      if (existing) {
        existing.calories += n.calories;
        existing.calCount += 1;
      }
    }

    return Array.from(grouped.entries())
      .filter(([, data]) => data.moodCount > 0 && data.calCount > 0)
      .map(([date, data]) => ({
        date,
        mood: data.moodSum / data.moodCount,
        calories: data.calories / data.calCount,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static calculateMoodVolumeHistory(
    moodPoints: MetricPoint[],
    workoutVolumeHistory: WorkoutVolumePoint[],
    aggregation: TimeAggregation
  ): MoodVolumePoint[] {
    const grouped = new Map<number, { moodSum: number; moodCount: number; volume: number }>();

    for (const mp of moodPoints) {
      const start = this.getStartOfAggregation(mp.date, aggregation);
      const existing = grouped.get(start) || { moodSum: 0, moodCount: 0, volume: 0 };
      existing.moodSum += mp.value;
      existing.moodCount += 1;
      grouped.set(start, existing);
    }

    for (const v of workoutVolumeHistory) {
      const start = this.getStartOfAggregation(v.date, aggregation);
      const existing = grouped.get(start);
      if (existing) {
        existing.volume += v.volume;
      }
    }

    return Array.from(grouped.entries())
      .filter(([, data]) => data.moodCount > 0 && data.volume > 0)
      .map(([date, data]) => ({
        date,
        mood: data.moodSum / data.moodCount,
        volume: data.volume,
      }))
      .sort((a, b) => a.date - b.date);
  }

  private static calculateMoodMacrosHistory(
    moodPoints: MetricPoint[],
    nutritionDaily: DailyNutrition[],
    aggregation: TimeAggregation
  ): MoodMacrosPoint[] {
    const grouped = new Map<
      number,
      {
        moodSum: number;
        moodCount: number;
        protein: number;
        carbs: number;
        fat: number;
        nutCount: number;
      }
    >();

    for (const mp of moodPoints) {
      const start = this.getStartOfAggregation(mp.date, aggregation);
      const existing = grouped.get(start) || {
        moodSum: 0,
        moodCount: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        nutCount: 0,
      };
      existing.moodSum += mp.value;
      existing.moodCount += 1;
      grouped.set(start, existing);
    }

    for (const n of nutritionDaily) {
      const start = this.getStartOfAggregation(n.date, aggregation);
      const existing = grouped.get(start);
      if (existing) {
        existing.protein += n.protein;
        existing.carbs += n.carbs;
        existing.fat += n.fat;
        existing.nutCount += 1;
      }
    }

    return Array.from(grouped.entries())
      .filter(([, data]) => data.moodCount > 0 && data.nutCount > 0)
      .map(([date, data]) => ({
        date,
        mood: data.moodSum / data.moodCount,
        protein: data.protein / data.nutCount,
        carbs: data.carbs / data.nutCount,
        fat: data.fat / data.nutCount,
      }))
      .sort((a, b) => a.date - b.date);
  }
}
