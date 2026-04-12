import { useEffect, useMemo, useState } from 'react';

import { NutritionService, UserMetricService } from '@/database/services';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import { computeWeightChangeFromCalorieDelta } from '@/utils/nutritionCalculator';
import { storedWeightToKg } from '@/utils/unitConversion';

import { useEmpiricalTDEE } from './useEmpiricalTDEE';
import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

/** Minimum days since last weigh-in before we show a prediction */
const MIN_DAYS_SINCE_WEIGHT = 4;

export interface UseWeightPredictionResult {
  /** Whether the prediction card should be shown */
  shouldShow: boolean;
  /** Predicted weight in kg */
  predictedWeightKg: number | null;
  isLoading: boolean;
}

// TODO: check if there were any workouts and steps since last weight and use that to predict if weight change was just fat or muscle
export function useWeightPrediction(): UseWeightPredictionResult {
  const [dataLoading, setDataLoading] = useState(true);
  const [conditionsMet, setConditionsMet] = useState(false);
  const [lastWeightKg, setLastWeightKg] = useState<number | null>(null);
  const [recentCalories, setRecentCalories] = useState<number[] | null>(null);

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

        setLastWeightKg(weightKg);
        setRecentCalories(caloriesPerDay);
        setConditionsMet(true);
      } catch {
        setConditionsMet(false);
      } finally {
        setDataLoading(false);
      }
    };

    check();
  }, []);

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

    const totalDeltaKcal = recentCalories.reduce(
      (sum, dayCalories) => sum + (dayCalories - tdee),
      0
    );

    const weightChangeKg = computeWeightChangeFromCalorieDelta(totalDeltaKcal, lastWeightKg, {
      bodyFatPercent: metrics?.bodyFat ?? undefined,
      liftingExperience: user?.liftingExperience ?? undefined,
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
  ]);

  const isLoading = dataLoading || tdeeLoading || userLoading || metricsLoading;

  return {
    shouldShow: !isLoading && conditionsMet && predictedWeightKg !== null,
    predictedWeightKg,
    isLoading,
  };
}
