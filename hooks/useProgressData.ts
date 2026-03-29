import { subDays, subMonths, subYears } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { ProgressData, ProgressService } from '../database/services/ProgressService';
import { localDayClosedRangeMaxMs, localDayStartMs } from '../utils/calendarDate';

export type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface UseProgressDataParams {
  initialPreset?: DateRangePreset;
}

export function useProgressData({ initialPreset = '30d' }: UseProgressDataParams = {}) {
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [appliedCustomRange, setAppliedCustomRange] = useState<{
    startDate: Date;
    endDate: Date;
  } | null>(null);
  const [useWeeklyAverages, setUseWeeklyAverages] = useState(false);
  const [data, setData] = useState<ProgressData | null>(null);
  const [allAggregationData, setAllAggregationData] = useState<{
    daily: ProgressData | null;
    weekly: ProgressData | null;
    monthly: ProgressData | null;
  }>({ daily: null, weekly: null, monthly: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let start: number;
      let end: number;

      if (preset === 'custom' && appliedCustomRange) {
        start = localDayStartMs(appliedCustomRange.startDate);
        end = localDayClosedRangeMaxMs(appliedCustomRange.endDate);
      } else {
        const today = new Date();
        end = localDayClosedRangeMaxMs(today);

        switch (preset) {
          case '7d':
            start = localDayStartMs(subDays(today, 7));
            break;
          case '30d':
            start = localDayStartMs(subDays(today, 30));
            break;
          case '90d':
            start = localDayStartMs(subDays(today, 90));
            break;
          case '6m':
            start = localDayStartMs(subMonths(today, 6));
            break;
          case '1y':
            start = localDayStartMs(subYears(today, 1));
            break;
          case 'all':
            start = localDayStartMs(subYears(today, 10)); // Fallback for "all"
            break;
          default:
            start = localDayStartMs(subDays(today, 30));
        }
      }

      // Fetch data for all aggregations in parallel to check if any have data
      const [dailyData, weeklyData, monthlyData] = await Promise.all([
        ProgressService.getProgressData(start, end, useWeeklyAverages, 'daily'),
        ProgressService.getProgressData(start, end, useWeeklyAverages, 'weekly'),
        ProgressService.getProgressData(start, end, useWeeklyAverages, 'monthly'),
      ]);

      const fetched = { daily: dailyData, weekly: weeklyData, monthly: monthlyData };
      setAllAggregationData(fetched);
      setData(dailyData);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [preset, appliedCustomRange, useWeeklyAverages]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changePreset = (newPreset: DateRangePreset) => {
    if (newPreset !== 'custom') {
      setPreset(newPreset);
    }
  };

  const applyCustomRange = (start: Date, end: Date) => {
    setAppliedCustomRange({ startDate: start, endDate: end });
    setPreset('custom');
  };

  // Helper function to check if any aggregation has data for charts with aggregation options
  const hasAnyAggregationData = useCallback(
    (getData: (data: ProgressData) => unknown[]): boolean => {
      if (!allAggregationData.daily || !allAggregationData.weekly || !allAggregationData.monthly) {
        return false;
      }
      return (
        getData(allAggregationData.daily).length > 0 ||
        getData(allAggregationData.weekly).length > 0 ||
        getData(allAggregationData.monthly).length > 0
      );
    },
    [allAggregationData]
  );

  return {
    data,
    allAggregationData,
    isLoading,
    error,
    preset,
    changePreset,
    appliedCustomRange,
    applyCustomRange,
    useWeeklyAverages,
    setUseWeeklyAverages,
    refresh: fetchData,
    hasAnyAggregationData,
  };
}
