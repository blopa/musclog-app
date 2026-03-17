import convert from 'convert';
import { useEffect, useState } from 'react';

import { NutritionService } from '../database/services/NutritionService';
import { UserMetricService } from '../database/services/UserMetricService';

export type FuelingStatus = 'low' | 'optimal' | 'loading';

/**
 * Hook to evaluate if the user has consumed enough carbohydrates to fuel their current workout.
 * Based on ACSM/ISSN Consensus Guideline: 1-4g carbs/kg 1-4 hours prior to workout.
 */
export function useWorkoutFueling(workoutStartTime?: number) {
  const [status, setStatus] = useState<FuelingStatus>('loading');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkFueling() {
      try {
        const start = workoutStartTime ? new Date(workoutStartTime) : new Date();
        const hour = start.getHours();

        // 1. Get user weight (to calculate g/kg)
        const latestWeightMetric = await UserMetricService.getLatest('weight');
        let weightKg = 70; // Fallback to a standard weight if not provided
        if (latestWeightMetric) {
          const dec = await latestWeightMetric.getDecrypted();
          weightKg = dec.value;
          if (dec.unit === 'lb' || dec.unit === 'lbs') {
            weightKg = convert(weightKg, 'lb').to('kg') as number;
          }
        }

        // 2. Resolve dates for today and yesterday
        const today = new Date(start);
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // 3. Fetch logs
        const logsToday = await NutritionService.getNutritionLogsForDate(today);
        const logsYesterday = await NutritionService.getNutritionLogsForDate(yesterday);

        let totalCarbs = 0;

        // 4. Implement Time Range Logic
        if (hour < 11) {
          // Morning workout (< 11 AM):
          // Look at Yesterday's Dinner + Today's Breakfast/Snacks to see if stores are topped off.
          const yesterdayDinner = logsYesterday.filter((l) => l.type === 'dinner');
          const todayMorning = logsToday.filter((l) => l.type === 'breakfast' || l.type === 'snack');

          for (const log of [...yesterdayDinner, ...todayMorning]) {
            const nutrients = await log.getNutrients();
            totalCarbs += nutrients.carbs;
          }
        } else {
          // Afternoon/Evening workout (>= 11 AM):
          // Look primarily at the acute fueling window (Today's logs so far).
          for (const log of logsToday) {
            const nutrients = await log.getNutrients();
            totalCarbs += nutrients.carbs;
          }
        }

        // 5. Threshold evaluation (using lower bound of 1g/kg as "Too Low" threshold)
        const threshold = weightKg * 1.0;

        if (totalCarbs < threshold) {
          setStatus('low');
        } else {
          setStatus('optimal');
        }
      } catch (error) {
        console.error('[useWorkoutFueling] Error evaluating fueling status:', error);
        // Fallback to optimal on error to avoid false-positive warnings
        setStatus('optimal');
      } finally {
        setIsLoading(false);
      }
    }

    checkFueling();
  }, [workoutStartTime]);

  return { status, isLoading };
}
