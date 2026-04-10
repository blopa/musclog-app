import { useEffect, useMemo, useState } from 'react';

import { NutritionService, UserMetricService } from '@/database/services';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import { computeWeightChangeFromCalorieDelta } from '@/utils/nutritionCalculator';
import { storedWeightToKg } from '@/utils/unitConversion';

import { useEmpiricalTDEE } from './useEmpiricalTDEE';
import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

const PREDICTION_DAYS = 4;

export interface UseWeightPredictionResult {
  /** Whether the prediction card should be shown */
  shouldShow: boolean;
  /** Predicted weight in kg */
  predictedWeightKg: number | null;
  isLoading: boolean;
}

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
        // Start of 4 days ago (inclusive lower bound of our window)
        const windowStart = localDayKeyPlusCalendarDays(todayStart, -PREDICTION_DAYS);

        // Condition 1: no weight logged in the last 4 days
        const latestWeight = await UserMetricService.getLatest('weight');
        if (!latestWeight) {
          setConditionsMet(false);
          return;
        }

        if (latestWeight.date >= windowStart) {
          // Weight was logged within the 4-day window → nothing to predict
          setConditionsMet(false);
          return;
        }

        // Condition 2: all 4 days have calorie data
        const caloriesPerDay: number[] = [];
        for (let i = 1; i <= PREDICTION_DAYS; i++) {
          const dayStart = localDayKeyPlusCalendarDays(todayStart, -i);
          const nutrients = await NutritionService.getDailyNutrients(new Date(dayStart));
          if (nutrients.calories <= 0) {
            setConditionsMet(false);
            return;
          }
          caloriesPerDay.push(nutrients.calories);
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
