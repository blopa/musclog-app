import { useCallback, useEffect, useState } from 'react';

import { ProgressData, ProgressService } from '../database/services/ProgressService';

export type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface UseProgressDataParams {
  initialPreset?: DateRangePreset;
}

export function useProgressData({ initialPreset = '30d' }: UseProgressDataParams = {}) {
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [customRange, setCustomRange] = useState<{ startDate: Date; endDate: Date } | null>(null);
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
      let end: number = new Date().getTime();

      if (preset === 'custom' && customRange) {
        start = customRange.startDate.getTime();
        end = customRange.endDate.getTime();
      } else {
        const now = new Date();
        now.setUTCHours(23, 59, 59, 999);
        end = now.getTime();

        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);

        switch (preset) {
          case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(startDate.getDate() - 90);
            break;
          case '6m':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
          case '1y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          case 'all':
            startDate.setFullYear(startDate.getFullYear() - 10); // Fallback for "all"
            break;
          default:
            startDate.setDate(startDate.getDate() - 30);
        }
        start = startDate.getTime();
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
  }, [preset, customRange, useWeeklyAverages]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changePreset = (newPreset: DateRangePreset) => {
    if (newPreset === 'custom' && !customRange) {
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 30);
      setCustomRange({ startDate: start, endDate: end });
    }
    setPreset(newPreset);
  };

  const setCustomDates = (start: Date, end: Date) => {
    setCustomRange({ startDate: start, endDate: end });
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
    customRange,
    setCustomDates,
    useWeeklyAverages,
    setUseWeeklyAverages,
    refresh: fetchData,
    hasAnyAggregationData,
  };
}
