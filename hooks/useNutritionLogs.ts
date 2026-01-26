import { useState, useEffect, useMemo, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import NutritionLog from '../database/models/NutritionLog';
import Food from '../database/models/Food';
import { NutritionService } from '../database/services';
import { DEFAULT_BATCH_SIZE } from '../constants/database';

// Hook parameters
export interface UseNutritionLogsParams {
  mode?: 'daily' | 'range' | 'recent' | 'meal-type'; // Default: 'daily'
  date?: Date; // For daily and meal-type modes
  startDate?: Date; // For range mode
  endDate?: Date; // For range mode
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'; // For meal-type mode
  initialLimit?: number; // Default: 20
  batchSize?: number; // Default: 20
  getAll?: boolean; // If true, fetch all logs (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  sortBy?: 'date' | 'created_at' | 'updated_at'; // Default: 'date'
  sortOrder?: 'asc' | 'desc'; // Default: 'desc'
}

// Return type for basic modes
export type UseNutritionLogsResultBasic = {
  logs: NutritionLog[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalCount?: number;
};

export type UseNutritionLogsResultRecent = {
  recentFoods: Food[];
  isLoading: boolean;
  refresh: () => Promise<void>;
};

// Return type for daily mode (with nutrients)
export type UseNutritionLogsResultDaily = {
  logs: NutritionLog[];
  dailyNutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    byMealType: Record<
      'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other',
      {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }
    >;
  };
  isLoading: boolean;
  refresh: () => Promise<void>;
};

// Return type for range mode (with nutrients)
export type UseNutritionLogsResultRange = {
  logs: NutritionLog[];
  rangeNutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    dailyAverages: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
    };
  };
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export type UseNutritionLogsResult =
  | UseNutritionLogsResultBasic
  | UseNutritionLogsResultDaily
  | UseNutritionLogsResultRange
  | UseNutritionLogsResultRecent;

export function useNutritionLogs(
  params: UseNutritionLogsParams & { mode?: 'daily'; date: Date }
): UseNutritionLogsResultDaily;

export function useNutritionLogs(
  params: UseNutritionLogsParams & { mode: 'range'; startDate: Date; endDate: Date }
): UseNutritionLogsResultRange;

export function useNutritionLogs(
  params: UseNutritionLogsParams & { mode: 'recent' }
): UseNutritionLogsResultRecent;

export function useNutritionLogs(
  params: UseNutritionLogsParams & {
    mode: 'meal-type';
    date: Date;
    mealType: NonNullable<UseNutritionLogsParams['mealType']>;
  }
): UseNutritionLogsResultBasic;

export function useNutritionLogs(params?: UseNutritionLogsParams): UseNutritionLogsResult;

/**
 * Hook for managing nutrition logs data with reactive updates
 */
export function useNutritionLogs({
  mode = 'daily',
  date,
  startDate,
  endDate,
  mealType,
  initialLimit = 20,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  enableReactivity = true,
  visible = true,
  sortBy = 'date',
  sortOrder = 'desc',
}: UseNutritionLogsParams = {}): UseNutritionLogsResult {
  const defaultDailyNutrients = useMemo(
    () => ({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      byMealType: {
        breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        snack: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        other: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      },
    }),
    []
  );

  // State for basic modes
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalCount, setTotalCount] = useState<number | undefined>();

  // State for recent mode
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);

  // State for daily mode
  const [dailyNutrients, setDailyNutrients] = useState(defaultDailyNutrients);

  // State for range mode
  const [rangeNutrients, setRangeNutrients] = useState<
    | {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        dailyAverages: {
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber: number;
        };
      }
    | undefined
  >();

  // Load initial batch of nutrition logs
  const loadInitialLogs = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

    try {
      let logsList: NutritionLog[];

      if (mode === 'daily' && date) {
        // Daily mode
        logsList = await NutritionService.getNutritionLogsForDate(date);
        setHasMore(false); // No pagination for daily mode

        // Calculate daily nutrients
        const nutrients = await NutritionService.getDailyNutrients(date);
        setDailyNutrients(nutrients);
      } else if (mode === 'range' && startDate && endDate) {
        // Range mode
        logsList = await NutritionService.getNutritionLogsForDateRange(startDate, endDate);
        setHasMore(false); // No pagination for range mode

        // Calculate range nutrients
        const nutrients = await NutritionService.getRangeNutrients(startDate, endDate);
        setRangeNutrients(nutrients);
      } else if (mode === 'meal-type' && date && mealType) {
        // Meal-type mode
        logsList = await NutritionService.getNutritionLogsForMeal(date, mealType);
        setHasMore(false); // No pagination for meal-type mode
      } else if (mode === 'recent') {
        // Recent mode: return recently eaten foods for quick logging
        const recent = await NutritionService.getRecentFoods(initialLimit);
        setRecentFoods(recent);
        logsList = [];
        setHasMore(false);
      } else {
        // Default: get all logs with client-side pagination
        const allLogs = await NutritionService.getNutritionLogsForDateRange(
          new Date(0), // Beginning of time
          new Date() // Now
        );

        if (getAll) {
          logsList = allLogs;
          setHasMore(false);
        } else {
          logsList = allLogs.slice(0, initialLimit);
          setHasMore(allLogs.length > initialLimit);
          setCurrentOffset(initialLimit);
        }
      }

      setLogs(logsList);

      // Get total count for basic (non-special) modes
      if (!['daily', 'range', 'meal-type', 'recent'].includes(mode)) {
        const allLogs = await NutritionService.getNutritionLogsForDateRange(
          new Date(0),
          new Date()
        );
        setTotalCount(allLogs.length);
      }
    } catch (err) {
      console.error('Error loading nutrition logs:', err);
      setLogs([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, mode, date, startDate, endDate, mealType, initialLimit, getAll]);

  // Load more logs (pagination)
  const loadMore = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMore ||
      !visible ||
      getAll ||
      mode === 'daily' ||
      mode === 'range' ||
      mode === 'meal-type' ||
      mode === 'recent'
    ) {
      // Don't load more for modes that don't support pagination
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      // Get all logs and slice the next batch
      const allLogs = await NutritionService.getNutritionLogsForDateRange(new Date(0), new Date());
      const moreLogs = allLogs.slice(currentOffset, currentOffset + batchSize);

      if (moreLogs.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing logs
      setLogs((prev) => [...prev, ...moreLogs]);

      const newOffset = currentOffset + moreLogs.length;
      setCurrentOffset(newOffset);

      // Check if there are more logs
      if (moreLogs.length < batchSize) {
        setHasMore(false);
      } else {
        setHasMore(newOffset < allLogs.length);
      }
    } catch (err) {
      console.error('Error loading more nutrition logs:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, mode, getAll]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitialLogs();
  }, [loadInitialLogs]);

  // Observe database changes for reactivity
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialLogs();
      }
      return;
    }

    // Build query based on mode
    let query = database.get<NutritionLog>('nutrition_logs').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy(sortBy, sortOrder === 'asc' ? Q.asc : Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    // Add mode-specific filters
    if (mode === 'daily' && date) {
      const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;
      query = query.extend(
        Q.where('date', Q.gte(dateTimestamp)),
        Q.where('date', Q.lt(nextDayTimestamp))
      );
    } else if (mode === 'range' && startDate && endDate) {
      const startTimestamp = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      ).getTime();
      const endTimestamp =
        new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() +
        24 * 60 * 60 * 1000;
      query = query.extend(
        Q.where('date', Q.gte(startTimestamp)),
        Q.where('date', Q.lt(endTimestamp))
      );
    } else if (mode === 'meal-type' && date && mealType) {
      const dateTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const nextDayTimestamp = dateTimestamp + 24 * 60 * 60 * 1000;
      query = query.extend(
        Q.where('date', Q.gte(dateTimestamp)),
        Q.where('date', Q.lt(nextDayTimestamp)),
        Q.where('type', mealType)
      );
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // When a nutrition log is created/updated, reload the data
        refresh();
      },
      error: (err) => {
        console.error('Error observing nutrition logs:', err);
      },
    });

    // Load initial data
    refresh();

    return () => subscription.unsubscribe();
  }, [
    enableReactivity,
    visible,
    mode,
    date,
    startDate,
    endDate,
    mealType,
    sortBy,
    sortOrder,
    refresh,
    loadInitialLogs,
  ]);

  // Memoized result for basic modes
  const basicResult = useMemo(
    () => ({
      logs,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh,
      totalCount,
    }),
    [logs, isLoading, isLoadingMore, hasMore, loadMore, refresh, totalCount]
  );

  // Memoized result for recent mode
  const recentResult = useMemo(
    () => ({
      recentFoods,
      isLoading,
      refresh,
    }),
    [recentFoods, isLoading, refresh]
  );

  // Memoized result for daily mode
  const dailyResult = useMemo(
    () => ({
      logs,
      dailyNutrients,
      isLoading,
      refresh,
    }),
    [logs, dailyNutrients, isLoading, refresh]
  );

  // Memoized result for range mode
  const rangeResult = useMemo(
    () => ({
      logs,
      rangeNutrients: rangeNutrients!,
      isLoading,
      refresh,
    }),
    [logs, rangeNutrients, isLoading, refresh]
  );

  // Return appropriate type based on mode
  if (mode === 'daily') {
    return dailyResult as UseNutritionLogsResult;
  } else if (mode === 'range') {
    return rangeResult as UseNutritionLogsResult;
  } else if (mode === 'recent') {
    return recentResult as UseNutritionLogsResult;
  } else {
    return basicResult as UseNutritionLogsResult;
  }
}

export default useNutritionLogs;
