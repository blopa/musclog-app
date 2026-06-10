import { useEffect, useMemo, useState } from 'react';

import { NutritionService, UserMetricService } from '@/database/services';
import {
  bucketPointsByUtcWeek,
  localDayClosedRangeMaxMs,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { calculateTDEE } from '@/utils/nutritionCalculator';
import { storedWeightToKg } from '@/utils/unitConversion';

import { useSettings } from './useSettings';
import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
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
  const endMetricTs = localDayClosedRangeMaxMs(asOfDate);
  const inclusiveRangeEndDate = new Date(endDayStartTs);
  const startTs = localDayKeyPlusCalendarDays(endDayStartTs, -lookbackDays);
  const startOfRange = new Date(startTs);

  const utcStartKey = utcDayKeyFromLocalDate(new Date(startTs));

  const dateRange = { startDate: startTs, endDate: endMetricTs };

  const [weightMetrics, bodyFatMetrics, rangeNutrients, nutritionLogs] = await Promise.all([
    UserMetricService.getMetricsHistory('weight', dateRange),
    UserMetricService.getMetricsHistory('body_fat', dateRange),
    NutritionService.getRangeNutrients(startOfRange, inclusiveRangeEndDate),
    NutritionService.getNutritionLogsForDateRange(startOfRange, inclusiveRangeEndDate),
  ]);

  const distinctDaysWithNutrition = new Set(
    nutritionLogs.map((log) => utcNormalizedDayKey(log.date, log.timezone))
  ).size;
  if (distinctDaysWithNutrition < minNutritionDays || rangeNutrients.calories <= 0) {
    return null;
  }

  const weightWithDecrypted = await Promise.all(
    weightMetrics.map(async (m) => {
      const d = await m.getDecrypted();
      const valueKg = storedWeightToKg(d.value, d.unit);
      return { date: m.date, timezone: m.timezone, valueKg };
    })
  );

  weightWithDecrypted.sort(
    (a, b) => utcNormalizedDayKey(a.date, a.timezone) - utcNormalizedDayKey(b.date, b.timezone)
  );

  if (weightWithDecrypted.length < 2) {
    return null;
  }

  let initialWeight: number;
  let finalWeight: number;

  if (useWeeklyAverages) {
    const weightByWeek = bucketPointsByUtcWeek(weightWithDecrypted, utcStartKey);
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
        return { date: m.date, timezone: m.timezone, value: d.value };
      })
    );
    bodyFatWithDecrypted.sort(
      (a, b) => utcNormalizedDayKey(a.date, a.timezone) - utcNormalizedDayKey(b.date, b.timezone)
    );

    if (useWeeklyAverages) {
      const bodyFatByWeek = bucketPointsByUtcWeek(bodyFatWithDecrypted, utcStartKey);
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
  const { useBfForCalculations } = useSettings();
  const [historicalData, setHistoricalData] = useState<HistoricalNutritionParams | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(true);
  const [historicalError, setHistoricalError] = useState<string | null>(null);

  // Fetch historical nutrition data
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setHistoricalLoading(true);
        setHistoricalError(null);

        const data = await getHistoricalNutritionParamsCustom({
          lookbackDays,
          minNutritionDays,
          useWeeklyAverages,
        });

        setHistoricalData(data);
      } catch (err) {
        console.error('Error fetching historical nutrition data:', err);
        setHistoricalError(err instanceof Error ? err.message : 'Failed to fetch historical data');
        setHistoricalData(null);
      } finally {
        setHistoricalLoading(false);
      }
    };

    fetchHistoricalData();
  }, [lookbackDays, minNutritionDays, useWeeklyAverages]);

  // Calculate TDEE when data is available
  const { tdee, usedEmpiricalData, calculationError } = useMemo(() => {
    // Default result
    const result = {
      tdee: fallbackValue,
      usedEmpiricalData: false,
      calculationError: null as string | null,
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

        if (useBfForCalculations && historicalData.historicalInitialFatPercent !== undefined) {
          tdeeParams.initialFatPercentage = historicalData.historicalInitialFatPercent;
        }

        if (useBfForCalculations && historicalData.historicalFinalFatPercent !== undefined) {
          tdeeParams.finalFatPercentage = historicalData.historicalFinalFatPercent;
        }

        result.usedEmpiricalData = true;
      }

      const calculatedTdee = calculateTDEE(tdeeParams);
      result.tdee = calculatedTdee || fallbackValue;
    } catch (err) {
      console.error('Error calculating TDEE:', err);
      result.calculationError = err instanceof Error ? err.message : 'Failed to calculate TDEE';
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
    useBfForCalculations,
  ]);

  const isLoading = userLoading || metricsLoading || historicalLoading;
  const error = historicalError ?? calculationError;

  return {
    tdee,
    isLoading,
    usedEmpiricalData,
    historicalData,
    error,
  };
}
