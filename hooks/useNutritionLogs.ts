import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import { database } from '../database';
import Food from '../database/models/Food';
import NutritionLog, { type MealType } from '../database/models/NutritionLog';
import { NutritionService } from '../database/services';
import { localDayHalfOpenRange, localDayStartMs, localNextDayStartMsFromDate } from '../utils/calendarDate';

// Hook parameters
export interface UseNutritionLogsParams {
  mode?: 'daily' | 'range' | 'recent' | 'recent-logs' | 'meal-type'; // Default: 'daily'
  date?: Date; // For daily and meal-type modes
  startDate?: Date; // For range mode
  endDate?: Date; // For range mode
  mealType?: MealType; // For meal-type mode
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

export type UseNutritionLogsResultRecentLogs = {
  recentNutritionLogs: {
    log: NutritionLog;
    food: Food | null;
    nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    gramWeight: number;
    displayName: string;
  }[];
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
      MealType,
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
  totalCount?: number;
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
  | UseNutritionLogsResultRecent
  | UseNutritionLogsResultRecentLogs;

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
  params: UseNutritionLogsParams & { mode: 'recent-logs' }
): UseNutritionLogsResultRecentLogs;

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

  // State for recent-logs mode
  const [recentNutritionLogs, setRecentNutritionLogs] = useState<
    {
      log: NutritionLog;
      food: Food | null;
      nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      gramWeight: number;
      displayName: string;
    }[]
  >([]);

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
      // Clear data when not visible to free memory
      setLogs([]);
      setRecentFoods([]);
      setRecentNutritionLogs([]);
      setDailyNutrients(defaultDailyNutrients);
      setRangeNutrients(undefined);
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

        // Get total count of all logs in database
        // Retry on reset error to handle race conditions during database initialization
        let allLogsCount = 0;
        try {
          allLogsCount = await database
            .get<NutritionLog>('nutrition_logs')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetchCount();
        } catch (error: any) {
          const isResetError =
            error?.message?.includes('database is being reset') ||
            error?.message?.includes('underlyingAdapter');
          if (isResetError) {
            // Retry after a short delay
            await new Promise((resolve) => setTimeout(resolve, 200));
            allLogsCount = await database
              .get<NutritionLog>('nutrition_logs')
              .query(Q.where('deleted_at', Q.eq(null)))
              .fetchCount();
          } else {
            throw error;
          }
        }
        setTotalCount(allLogsCount);
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
        const recent = await NutritionService.getRecentFoods(initialLimit, date);
        setRecentFoods(recent);
        logsList = [];
        setHasMore(false);
      } else if (mode === 'recent-logs') {
        // Recent-logs mode: return recent nutrition logs with gramWeight
        const recent = await NutritionService.getRecentNutritionLogs(initialLimit, date);
        setRecentNutritionLogs(recent);
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
      if (!['daily', 'range', 'meal-type', 'recent', 'recent-logs'].includes(mode)) {
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
  }, [
    visible,
    defaultDailyNutrients,
    mode,
    date,
    startDate,
    endDate,
    mealType,
    initialLimit,
    getAll,
  ]);

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
      mode === 'recent' ||
      mode === 'recent-logs'
    ) {
      // Don't load more for modes that don't support pagination
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

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
    // Prevent infinite loops by checking if we're already loading
    if (isLoading) {
      return;
    }

    await loadInitialLogs();
  }, [loadInitialLogs, isLoading]);

  // Ref to hold the latest refresh function to avoid dependency issues
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Track if we've already loaded initial data to prevent duplicate calls
  const hasLoadedInitial = useRef(false);

  // Observe database changes for reactivity
  useEffect(() => {
    // Reset the loaded flag when key dependencies change
    hasLoadedInitial.current = false;

    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible && !hasLoadedInitial.current) {
        loadInitialLogs();
        hasLoadedInitial.current = true;
      }
      return;
    }

    // Build query based on mode - only observe relevant changes
    let query = database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)));

    // Add mode-specific filters to avoid unnecessary re-renders
    if (mode === 'daily' && date) {
      const { start, nextStart } = localDayHalfOpenRange(date);
      query = query.extend(
        Q.where('date', Q.gte(start)),
        Q.where('date', Q.lt(nextStart))
      );
    } else if (mode === 'range' && startDate && endDate) {
      const startTimestamp = localDayStartMs(startDate);
      const endTimestamp = localNextDayStartMsFromDate(endDate);
      query = query.extend(
        Q.where('date', Q.gte(startTimestamp)),
        Q.where('date', Q.lt(endTimestamp))
      );
    } else if (mode === 'meal-type' && date && mealType) {
      const { start, nextStart } = localDayHalfOpenRange(date);
      query = query.extend(
        Q.where('date', Q.gte(start)),
        Q.where('date', Q.lt(nextStart)),
        Q.where('type', mealType)
      );
    } else {
      // For basic mode, don't observe at all to avoid infinite loops during onboarding
      // Just load initial data once without reactivity
      if (!hasLoadedInitial.current) {
        loadInitialLogs();
        hasLoadedInitial.current = true;
      }
      return;
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // Only refresh if we've already loaded initial data to prevent infinite loops
        if (hasLoadedInitial.current) {
          refreshRef.current();
        }
      },
      error: (err) => {
        console.error('Error observing nutrition logs:', err);
      },
    });

    // Load initial data and mark as loaded
    loadInitialLogs();
    hasLoadedInitial.current = true;

    return () => subscription.unsubscribe();
  }, [enableReactivity, visible, mode, date, startDate, endDate, mealType, loadInitialLogs]);

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

  // Memoized result for recent-logs mode
  const recentLogsResult = useMemo(
    () => ({
      recentNutritionLogs,
      isLoading,
      refresh,
    }),
    [recentNutritionLogs, isLoading, refresh]
  );

  // Memoized result for daily mode
  const dailyResult = useMemo(
    () => ({
      logs,
      dailyNutrients,
      isLoading,
      refresh,
      totalCount,
    }),
    [logs, dailyNutrients, isLoading, refresh, totalCount]
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
  } else if (mode === 'recent-logs') {
    return recentLogsResult as UseNutritionLogsResult;
  } else {
    return basicResult as UseNutritionLogsResult;
  }
}

export default useNutritionLogs;
