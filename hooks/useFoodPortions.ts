import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import { FoodPortionService } from '@/database/services';

// Utility functions for working with portions
export const FoodPortionUtils = {
  /**
   * Prefer the 100g app catalog portion, else any app catalog portion.
   */
  getDefaultPortion: (portions: FoodPortion[]): FoodPortion | null => {
    return (
      portions.find((p) => p.source === 'app' && p.gramWeight === 100) ||
      portions.find((p) => p.source === 'app') ||
      null
    );
  },

  /**
   * User-defined portions (`source !== 'app'`).
   */
  getNonDefaultPortions: (portions: FoodPortion[]): FoodPortion[] => {
    return portions.filter((p) => p.source !== 'app');
  },

  /**
   * Sort with app catalog portions first, then by name.
   */
  sortPortions: (portions: FoodPortion[]): FoodPortion[] => {
    return [...portions].sort((a, b) => {
      const aApp = a.source === 'app';
      const bApp = b.source === 'app';
      if (aApp !== bApp) {
        return aApp ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
  },
};

// Hook parameters
export interface UseFoodPortionsParams {
  mode?: 'all' | 'paginated'; // Default: 'all'
  initialLimit?: number; // For paginated mode, default: 10
  batchSize?: number; // For paginated mode, default: 10
  getAll?: boolean; // For paginated mode: if true, fetch all portions (no pagination)
  /** Paginated mode without `food`: when true, return all portion sources (not only `source === 'app'`). */
  includeAllPortionSources?: boolean;
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  food?: Food; // Optional food to get food-specific portions
}

// Return type for all mode
export type UseFoodPortionsResultAll = {
  portions: FoodPortion[];
  allGlobalPortions: FoodPortion[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

// Return type for paginated mode
export type UseFoodPortionsResultPaginated = {
  portions: FoodPortion[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
};

export type UseFoodPortionsResult = UseFoodPortionsResultAll | UseFoodPortionsResultPaginated;

// Function overloads for proper type narrowing
export function useFoodPortions(
  params?: UseFoodPortionsParams & { mode?: 'all' }
): UseFoodPortionsResultAll;

export function useFoodPortions(
  params: UseFoodPortionsParams & { mode: 'paginated' }
): UseFoodPortionsResultPaginated;

export function useFoodPortions({
  mode = 'all',
  initialLimit = 10,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  includeAllPortionSources = false,
  enableReactivity = true,
  visible = true,
  food,
}: UseFoodPortionsParams = {}): UseFoodPortionsResult {
  // State for all mode
  const [allPortions, setAllPortions] = useState<FoodPortion[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  // State for food-specific portions
  const [foodSpecificPortions, setFoodSpecificPortions] = useState<FoodPortion[]>([]);
  const [isLoadingFood, setIsLoadingFood] = useState(false);

  // State for paginated mode
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load initial batch of portions (paginated mode)
  const loadInitialPortions = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setError(null);

    try {
      if (getAll) {
        // Fetch all portions (no pagination)
        const allPortionsData = await FoodPortionService.getAllPortions();
        setAllPortions(allPortionsData);
        setHasMore(false);
      } else {
        // Newest first (created_at desc); fetch one extra row to detect hasMore
        const pageSize = initialLimit;
        const sourceOpt = includeAllPortionSources ? undefined : { source: 'app' as const };
        const batch = await FoodPortionService.getPortionsPaginated(pageSize + 1, 0, sourceOpt);

        if (batch.length === 0) {
          setAllPortions([]);
          setHasMore(false);
          setIsLoading(false);
          return;
        }

        const hasMoreItems = batch.length > pageSize;
        const initialPortions = hasMoreItems ? batch.slice(0, pageSize) : batch;

        setAllPortions(initialPortions);
        setCurrentOffset(initialPortions.length);
        setHasMore(hasMoreItems);
      }
    } catch (err) {
      console.error('Error loading food portions:', err);
      setAllPortions([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load food portions');
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit, getAll, includeAllPortionSources]);

  // Load more portions (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      const sourceOpt = includeAllPortionSources ? undefined : { source: 'app' as const };
      const batch = await FoodPortionService.getPortionsPaginated(
        batchSize + 1,
        currentOffset,
        sourceOpt
      );

      if (batch.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const hasMoreItems = batch.length > batchSize;
      const nextBatch = hasMoreItems ? batch.slice(0, batchSize) : batch;

      setAllPortions((prev) => [...prev, ...nextBatch]);

      const newOffset = currentOffset + nextBatch.length;
      setCurrentOffset(newOffset);
      setHasMore(hasMoreItems);
    } catch (err) {
      console.error('Error loading more food portions:', err);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load more food portions');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, getAll, includeAllPortionSources]);

  // Load food-specific portions when food changes
  useEffect(() => {
    const loadFoodPortions = async () => {
      if (!food) {
        setFoodSpecificPortions([]);
        setIsLoadingFood(false);
        return;
      }

      setIsLoadingFood(true);
      try {
        const portions = await food.getPortionsAsync();
        setFoodSpecificPortions(portions);
      } catch (err) {
        console.warn('Error loading food portions:', err);
        setFoodSpecificPortions([]);
      } finally {
        setIsLoadingFood(false);
      }
    };

    loadFoodPortions();
  }, [food]);

  // All mode: Load all portions on mount or when visible changes
  useEffect(() => {
    if (mode !== 'all') {
      return;
    }

    if (!visible || !enableReactivity) {
      return;
    }

    const loadAllPortions = async () => {
      setIsLoadingAll(true);
      setErrorAll(null);

      try {
        const allPortionsData = await FoodPortionService.getAllPortions();
        setAllPortions(allPortionsData);
      } catch (err) {
        console.error('Error loading all food portions:', err);
        setAllPortions([]);
        setErrorAll(err instanceof Error ? err.message : 'Failed to load food portions');
      } finally {
        setIsLoadingAll(false);
      }
    };

    loadAllPortions();
  }, [mode, visible, enableReactivity]);

  // Paginated mode: Load initial portions on mount or when params change
  useEffect(() => {
    if (mode !== 'paginated') {
      return;
    }

    if (!enableReactivity) {
      return;
    }

    loadInitialPortions();
  }, [mode, enableReactivity, loadInitialPortions]);

  // Refresh function for all mode
  const refreshAll = useCallback(async () => {
    setIsLoadingAll(true);
    setErrorAll(null);

    try {
      const allPortionsData = await FoodPortionService.getAllPortions();
      setAllPortions(allPortionsData);
    } catch (err) {
      console.error('Error refreshing food portions:', err);
      setAllPortions([]);
      setErrorAll(err instanceof Error ? err.message : 'Failed to refresh food portions');
    } finally {
      setIsLoadingAll(false);
    }
  }, []);

  // Refresh function for paginated mode
  const refreshPaginated = useCallback(async () => {
    await loadInitialPortions();
  }, [loadInitialPortions]);

  // Determine which portions to return based on food availability
  const getEffectivePortions = useCallback(() => {
    // If food is provided and has specific portions, use those
    if (food && foodSpecificPortions.length > 0) {
      return foodSpecificPortions;
    }

    if (includeAllPortionSources) {
      return allPortions;
    }

    // Otherwise, show built-in catalog portions (createCommonPortions uses source='app').
    return allPortions.filter((portion) => portion.source === 'app');
  }, [food, foodSpecificPortions, allPortions, includeAllPortionSources]);

  // Return appropriate type based on mode
  if (mode === 'all') {
    const effectivePortions = getEffectivePortions();

    return {
      portions: effectivePortions,
      allGlobalPortions: allPortions,
      isLoading: isLoadingAll || isLoadingFood,
      error: errorAll,
      refresh: refreshAll,
    };
  }

  const effectivePortions = getEffectivePortions();
  return {
    portions: effectivePortions,
    isLoading: isLoading || isLoadingFood,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshPaginated,
    error,
  };
}
