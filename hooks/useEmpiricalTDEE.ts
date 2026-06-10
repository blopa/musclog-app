import { useEffect, useMemo, useState } from 'react';

import {
  getHistoricalNutritionParams,
  type HistoricalNutritionParams,
} from '@/utils/historicalNutritionParams';
import { calculateTDEE } from '@/utils/nutritionCalculator';

import { useSettings } from './useSettings';
import { useUser } from './useUser';
import { useUserMetrics } from './useUserMetrics';

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

        const data = await getHistoricalNutritionParams({
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
