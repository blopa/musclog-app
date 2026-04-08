import { useEffect, useMemo, useState } from 'react';

import { NutritionService, UserMetricService } from '@/database/services';
import {
  localCalendarWeekIndexSince,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
} from '@/utils/calendarDate';
import { calculateTDEE } from '@/utils/nutritionCalculator';
import { storedWeightToKg } from '@/utils/unitConversion';

import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function bucketByWeek(
  points: { date: number; valueKg: number }[],
  startTs: number
): Map<number, { date: number; valueKg: number }[]> {
  const map = new Map<number, { date: number; valueKg: number }[]>();
  for (const p of points) {
    const w = localCalendarWeekIndexSince(p.date, startTs);
    if (!map.has(w)) {
      map.set(w, []);
    }
    map.get(w)!.push(p);
  }
  return map;
}

function bucketByWeekBodyFat(
  points: { date: number; value: number }[],
  startTs: number
): Map<number, { date: number; value: number }[]> {
  const map = new Map<number, { date: number; value: number }[]>();
  for (const p of points) {
    const w = localCalendarWeekIndexSince(p.date, startTs);
    if (!map.has(w)) {
      map.set(w, []);
    }
    map.get(w)!.push(p);
  }
  return map;
}

interface HistoricalNutritionParams {
  historicalTotalCalories: number;
  historicalTotalDays: number;
  historicalInitialWeightKg: number;
  historicalFinalWeightKg: number;
  historicalInitialFatPercent?: number;
  historicalFinalFatPercent?: number;
}

async function getHistoricalNutritionParamsCustom(options: {
  lookbackDays: number;
  minNutritionDays: number;
  asOfDate?: Date;
  useWeeklyAverages?: boolean;
}): Promise<HistoricalNutritionParams | null> {
  const {
    lookbackDays,
    minNutritionDays,
    asOfDate = new Date(),
    useWeeklyAverages = true,
  } = options;

  const endDayStartTs = localDayStartMs(asOfDate);
  const inclusiveRangeEndDate = new Date(endDayStartTs);
  const startTs = localDayKeyPlusCalendarDays(endDayStartTs, -lookbackDays);
  const startOfRange = new Date(startTs);

  const dateRange = { startDate: startTs, endDate: endDayStartTs };

  const [weightMetrics, bodyFatMetrics, rangeNutrients, nutritionLogs] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', dateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
    NutritionService.getRangeNutrients(startOfRange, inclusiveRangeEndDate),
    NutritionService.getNutritionLogsForDateRange(startOfRange, inclusiveRangeEndDate),
  ]);

  const distinctDaysWithNutrition = new Set(nutritionLogs.map((log) => log.date)).size;
  if (distinctDaysWithNutrition < minNutritionDays || rangeNutrients.calories <= 0) {
    return null;
  }

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const valueKg = storedWeightToKg(d.value, d.unit);
      return { date: m.date, valueKg };
    })
  );

  weightWithDecrypted.sort((a, b) => a.date - b.date);
  if (weightWithDecrypted.length < 2) {
    return null;
  }

  let initialWeight: number;
  let finalWeight: number;

  if (useWeeklyAverages) {
    const weightByWeek = bucketByWeek(weightWithDecrypted, startTs);
    const weekIndices = Array.from(weightByWeek.keys()).sort((a, b) => a - b);
    if (weekIndices.length < 2) {
      return null;
    }
    initialWeight = average(weightByWeek.get(weekIndices[0])!.map((x) => x.valueKg));
    finalWeight = average(
      weightByWeek.get(weekIndices[weekIndices.length - 1])!.map((x) => x.valueKg)
    );
  } else {
    initialWeight = weightWithDecrypted[0].valueKg;
    finalWeight = weightWithDecrypted[weightWithDecrypted.length - 1].valueKg;
  }

  let initialFatPercent: number | undefined;
  let finalFatPercent: number | undefined;

  if (bodyFatMetrics.length > 0) {
    const bodyFatWithDecrypted = await Promise.all(
      bodyFatMetrics.map(async (m) => {
        const d = await m.getDecrypted();
        return { date: m.date, value: d.value };
      })
    );
    bodyFatWithDecrypted.sort((a, b) => a.date - b.date);
    if (useWeeklyAverages) {
      const bodyFatByWeek = bucketByWeekBodyFat(bodyFatWithDecrypted, startTs);
      const weekIndices = Array.from(bodyFatByWeek.keys()).sort((a, b) => a - b);
      if (weekIndices.length >= 2) {
        initialFatPercent = average(bodyFatByWeek.get(weekIndices[0])!.map((x) => x.value));
        finalFatPercent = average(
          bodyFatByWeek.get(weekIndices[weekIndices.length - 1])!.map((x) => x.value)
        );
      } else {
        initialFatPercent = bodyFatWithDecrypted[0].value;
        finalFatPercent = bodyFatWithDecrypted[bodyFatWithDecrypted.length - 1].value;
      }
    } else {
      initialFatPercent = bodyFatWithDecrypted[0].value;
      finalFatPercent = bodyFatWithDecrypted[bodyFatWithDecrypted.length - 1].value;
    }
  }

  return {
    historicalTotalCalories: Math.round(rangeNutrients.calories),
    historicalTotalDays: lookbackDays,
    historicalInitialWeightKg: initialWeight,
    historicalFinalWeightKg: finalWeight,
    ...(initialFatPercent !== undefined && { historicalInitialFatPercent: initialFatPercent }),
    ...(finalFatPercent !== undefined && { historicalFinalFatPercent: finalFatPercent }),
  };
}

export interface UseEmpiricalTDEEConfig {
  /** Number of days to look back for historical data (default: 30) */
  lookbackDays?: number;
  /** Minimum days with nutrition data required (default: 7) */
  minNutritionDays?: number;
  /** Use weekly averages for weight/body fat (default: true) */
  useWeeklyAverages?: boolean;
  /** Fallback TDEE value when calculation fails (default: 2850) */
  fallbackValue?: number;
}

export interface UseEmpiricalTDEEResult {
  /** Calculated TDEE value */
  tdee: number;
  /** Whether any data is still loading */
  isLoading: boolean;
  /** Whether empirical data was used for calculation */
  usedEmpiricalData: boolean;
  /** Historical nutrition data if available */
  historicalData: HistoricalNutritionParams | null;
  /** Error information if calculation failed */
  error: string | null;
}

export function useEmpiricalTDEE(config: UseEmpiricalTDEEConfig = {}): UseEmpiricalTDEEResult {
  const {
    lookbackDays = 30,
    minNutritionDays = 7,
    useWeeklyAverages = true,
    fallbackValue = 2850,
  } = config;

  const { user, isLoading: userLoading } = useUser();
  const { metrics, isLoading: metricsLoading } = useUserMetrics();
  const [historicalData, setHistoricalData] = useState<HistoricalNutritionParams | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch historical nutrition data
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setHistoricalLoading(true);
        setError(null);

        const data = await getHistoricalNutritionParamsCustom({
          lookbackDays,
          minNutritionDays,
          useWeeklyAverages,
        });

        setHistoricalData(data);
      } catch (err) {
        console.error('Error fetching historical nutrition data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch historical data');
        setHistoricalData(null);
      } finally {
        setHistoricalLoading(false);
      }
    };

    fetchHistoricalData();
  }, [lookbackDays, minNutritionDays, useWeeklyAverages]);

  // Calculate TDEE when data is available
  const { tdee, usedEmpiricalData } = useMemo(() => {
    // Default result
    const result = {
      tdee: fallbackValue,
      usedEmpiricalData: false,
    };

    // Check if we have required user and metrics data
    if (!user || !metrics?.weight || !metrics?.height) {
      return result;
    }

    // Still loading data
    if (userLoading || metricsLoading || historicalLoading) {
      return result;
    }

    try {
      // Build TDEE parameters
      const tdeeParams: any = {
        activityLevel: user.activityLevel,
        liftingExperience: user.liftingExperience,
      };

      // Add empirical data if available
      if (historicalData) {
        tdeeParams.totalCalories = historicalData.historicalTotalCalories;
        tdeeParams.totalDays = historicalData.historicalTotalDays;
        tdeeParams.initialWeight = historicalData.historicalInitialWeightKg;
        tdeeParams.finalWeight = historicalData.historicalFinalWeightKg;

        if (historicalData.historicalInitialFatPercent !== undefined) {
          tdeeParams.initialFatPercentage = historicalData.historicalInitialFatPercent;
        }

        if (historicalData.historicalFinalFatPercent !== undefined) {
          tdeeParams.finalFatPercentage = historicalData.historicalFinalFatPercent;
        }

        result.usedEmpiricalData = true;
      }

      const calculatedTdee = calculateTDEE(tdeeParams);
      result.tdee = calculatedTdee || fallbackValue;
    } catch (err) {
      console.error('Error calculating TDEE:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate TDEE');
      result.tdee = fallbackValue;
    }

    return result;
  }, [
    user,
    metrics,
    historicalData,
    userLoading,
    metricsLoading,
    historicalLoading,
    fallbackValue,
  ]);

  const isLoading = userLoading || metricsLoading || historicalLoading;

  return {
    tdee,
    isLoading,
    usedEmpiricalData,
    historicalData,
    error,
  };
}
