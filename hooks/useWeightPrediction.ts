import { useEffect, useMemo, useState } from 'react';

import { WorkoutLogRepository } from '@/database/repositories/WorkoutLogRepository';
import { NutritionService, UserMetricService } from '@/database/services';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import { computeWeightChangeFromCalorieDelta } from '@/utils/nutritionCalculator';
import { storedHeightToCm, storedWeightToKg } from '@/utils/unitConversion';
import { calculateCaloriesBurnedBySteps } from '@/utils/workoutCalculator';

import { useEmpiricalTDEE } from './useEmpiricalTDEE';
import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

/** Minimum days since last weigh-in before we show a prediction */
const MIN_DAYS_SINCE_WEIGHT = 4;

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAverageStepCalories(
  stepCounts: number[],
  gender: 'male' | 'female' | 'other',
  weightKg: number,
  heightCm: number
): number | null {
  const dailyCalories = stepCounts
    .map((steps) => calculateCaloriesBurnedBySteps(steps, gender, weightKg, heightCm))
    .filter((calories) => calories > 0);

  return average(dailyCalories);
}

export interface UseWeightPredictionResult {
  /** Whether the prediction card should be shown */
  shouldShow: boolean;
  /** Predicted weight in kg */
  predictedWeightKg: number | null;
  /** Whether the user had completed workouts since the last weigh-in */
  hadWorkouts: boolean;
  /** Average daily steps since the last weigh-in, or null if no data */
  avgDailySteps: number | null;
  isLoading: boolean;
}

export function useWeightPrediction(): UseWeightPredictionResult {
  const [dataLoading, setDataLoading] = useState(true);
  const [conditionsMet, setConditionsMet] = useState(false);
  const [lastWeightKg, setLastWeightKg] = useState<number | null>(null);
  const [recentCalories, setRecentCalories] = useState<number[] | null>(null);
  const [hadWorkouts, setHadWorkouts] = useState(false);
  const [avgDailySteps, setAvgDailySteps] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [baselineStepCounts, setBaselineStepCounts] = useState<number[] | null>(null);
  const [currentStepCounts, setCurrentStepCounts] = useState<number[] | null>(null);

  const { tdee, isLoading: tdeeLoading } = useEmpiricalTDEE({
    lookbackDays: 30,
    minNutritionDays: 7,
  });

  const { user, isLoading: userLoading } = useUser();
  const { metrics, isLoading: metricsLoading } = useUserMetrics();

  useEffect(() => {
    const check = async () => {
      try {
        setDataLoading(true);

        const today = new Date();
        const todayStart = localDayStartMs(today);
        // Start of the minimum gap window
        const windowStart = localDayKeyPlusCalendarDays(todayStart, -MIN_DAYS_SINCE_WEIGHT);

        // Condition 1: no weight logged in the last MIN_DAYS_SINCE_WEIGHT days
        const latestWeight = await UserMetricService.getLatest('weight');
        if (!latestWeight) {
          setConditionsMet(false);
          return;
        }

        if (latestWeight.date >= windowStart) {
          // Weight was logged too recently → nothing to predict
          setConditionsMet(false);
          return;
        }

        // Condition 2: collect calorie data for every day since the last weigh-in
        const daysSinceLastWeight = Math.round(
          (todayStart - latestWeight.date) / (24 * 60 * 60 * 1000)
        );
        const currentPeriodEnd = localDayKeyPlusCalendarDays(todayStart, -1);

        const caloriesPerDay: number[] = [];
        for (let i = 1; i <= daysSinceLastWeight; i++) {
          const dayStart = localDayKeyPlusCalendarDays(todayStart, -i);
          const nutrients = await NutritionService.getDailyNutrients(new Date(dayStart));
          if (nutrients.calories > 0) {
            caloriesPerDay.push(nutrients.calories);
          }
        }

        // Need at least MIN_DAYS_SINCE_WEIGHT days of calorie data to make a useful prediction
        if (caloriesPerDay.length < MIN_DAYS_SINCE_WEIGHT) {
          setConditionsMet(false);
          return;
        }

        const decrypted = await latestWeight.getDecrypted();
        const weightKg = storedWeightToKg(decrypted.value, decrypted.unit);
        const latestHeight = await UserMetricService.getLatest('height');
        const heightDecrypted = latestHeight ? await latestHeight.getDecrypted() : null;
        const normalizedHeightCm = heightDecrypted
          ? storedHeightToCm(heightDecrypted.value, heightDecrypted.unit)
          : null;

        // Activity data since last weigh-in: workouts and steps
        const sinceLastWeighIn = {
          startDate: latestWeight.date,
          endDate: currentPeriodEnd,
        };

        const baselineStepsRange = {
          startDate: localDayKeyPlusCalendarDays(latestWeight.date, -daysSinceLastWeight),
          endDate: localDayKeyPlusCalendarDays(latestWeight.date, -1),
        };

        const [completedWorkouts, stepsMetrics, baselineStepsMetrics] = await Promise.all([
          WorkoutLogRepository.getCompleted(sinceLastWeighIn).fetch(),
          UserMetricService.getMetricsHistory('daily_steps', sinceLastWeighIn),
          UserMetricService.getMetricsHistory('daily_steps', baselineStepsRange),
        ]);
        const workoutsPresent = completedWorkouts.length > 0;

        let averageSteps: number | null = null;
        let currentSteps: number[] = [];
        if (stepsMetrics.length > 0) {
          const decryptedSteps = await Promise.all(stepsMetrics.map((m) => m.getDecrypted()));
          currentSteps = decryptedSteps.map((step) => step.value);
          averageSteps = average(currentSteps);
        }

        let previousPeriodSteps: number[] = [];
        if (baselineStepsMetrics.length > 0) {
          const decryptedSteps = await Promise.all(
            baselineStepsMetrics.map((m) => m.getDecrypted())
          );
          previousPeriodSteps = decryptedSteps.map((step) => step.value);
        }

        setLastWeightKg(weightKg);
        setHeightCm(normalizedHeightCm);
        setRecentCalories(caloriesPerDay);
        setHadWorkouts(workoutsPresent);
        setAvgDailySteps(averageSteps);
        setCurrentStepCounts(currentSteps);
        setBaselineStepCounts(previousPeriodSteps);
        setConditionsMet(true);
      } catch {
        setConditionsMet(false);
      } finally {
        setDataLoading(false);
      }
    };

    check();
  }, []);

  const stepCalorieAdjustmentKcal = useMemo(() => {
    if (
      !conditionsMet ||
      lastWeightKg === null ||
      heightCm === null ||
      recentCalories === null ||
      !user ||
      currentStepCounts === null ||
      baselineStepCounts === null
    ) {
      return 0;
    }

    const currentAverageStepCalories = getAverageStepCalories(
      currentStepCounts,
      user.gender,
      lastWeightKg,
      heightCm
    );

    const baselineAverageStepCalories = getAverageStepCalories(
      baselineStepCounts,
      user.gender,
      lastWeightKg,
      heightCm
    );

    if (currentAverageStepCalories === null || baselineAverageStepCalories === null) {
      return 0;
    }

    return (currentAverageStepCalories - baselineAverageStepCalories) * recentCalories.length;
  }, [
    conditionsMet,
    lastWeightKg,
    heightCm,
    recentCalories,
    user,
    currentStepCounts,
    baselineStepCounts,
  ]);

  const predictedWeightKg = useMemo(() => {
    if (
      !conditionsMet ||
      lastWeightKg === null ||
      recentCalories === null ||
      tdeeLoading ||
      userLoading ||
      metricsLoading
    ) {
      return null;
    }

    const totalDeltaKcal =
      recentCalories.reduce((sum, dayCalories) => sum + (dayCalories - tdee), 0) -
      stepCalorieAdjustmentKcal;

    // If the user had no declared lifting experience but was actively working out
    // during the period, treat them as at least intermediate so the prediction
    // reflects realistic muscle-vs-fat composition rather than defaulting to a
    // beginner split.
    const inferredExperience =
      user?.liftingExperience ?? (hadWorkouts ? 'intermediate' : undefined);

    const weightChangeKg = computeWeightChangeFromCalorieDelta(totalDeltaKcal, lastWeightKg, {
      bodyFatPercent: metrics?.bodyFat ?? undefined,
      liftingExperience: inferredExperience,
    });

    return lastWeightKg + weightChangeKg;
  }, [
    conditionsMet,
    lastWeightKg,
    recentCalories,
    tdee,
    tdeeLoading,
    userLoading,
    metricsLoading,
    metrics?.bodyFat,
    user?.liftingExperience,
    hadWorkouts,
    stepCalorieAdjustmentKcal,
  ]);

  const isLoading = dataLoading || tdeeLoading || userLoading || metricsLoading;

  return {
    shouldShow: !isLoading && conditionsMet && predictedWeightKg !== null,
    predictedWeightKg,
    hadWorkouts,
    avgDailySteps,
    isLoading,
  };
}
