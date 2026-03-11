import { useCallback, useEffect, useState } from 'react';

import {
  ProgressData,
  ProgressService,
  TimeAggregation,
} from '../database/services/ProgressService';

export type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

export interface UseProgressDataParams {
  initialPreset?: DateRangePreset;
}

export function useProgressData({ initialPreset = '30d' }: UseProgressDataParams = {}) {
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const [customRange, setCustomRange] = useState<{ startDate: Date; endDate: Date } | null>(null);
  const [useWeeklyAverages, setUseWeeklyAverages] = useState(false);
  const [aggregation, setAggregation] = useState<TimeAggregation>('daily');
  const [data, setData] = useState<ProgressData | null>(null);
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
        now.setHours(23, 59, 59, 999);
        end = now.getTime();

        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

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

      const progressData = await ProgressService.getProgressData(
        start,
        end,
        useWeeklyAverages,
        aggregation
      );
      setData(progressData);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [preset, customRange, useWeeklyAverages, aggregation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changePreset = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      setCustomRange(null);
    }
  };

  const setCustomDates = (start: Date, end: Date) => {
    setCustomRange({ startDate: start, endDate: end });
    setPreset('custom');
  };

  return {
    data,
    isLoading,
    error,
    preset,
    changePreset,
    customRange,
    setCustomDates,
    useWeeklyAverages,
    setUseWeeklyAverages,
    aggregation,
    setAggregation,
    refresh: fetchData,
  };
}
