import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import FoodPortion from '../database/models/FoodPortion';
import { FoodPortionService } from '../database/services';

// Hook parameters
export interface UseFoodPortionsParams {
  mode?: 'all' | 'paginated'; // Default: 'all'
  initialLimit?: number; // For paginated mode, default: 10
  batchSize?: number; // For paginated mode, default: 10
  getAll?: boolean; // For paginated mode: if true, fetch all portions (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
}

// Return type for all mode
export type UseFoodPortionsResultAll = {
  portions: FoodPortion[];
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
  enableReactivity = true,
  visible = true,
}: UseFoodPortionsParams = {}): UseFoodPortionsResult {
  // State for all mode
  const [allPortions, setAllPortions] = useState<FoodPortion[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  // State for paginated mode
  const [portions, setPortions] = useState<FoodPortion[]>([]);
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
        setPortions(allPortionsData);
        setHasMore(false);
      } else {
        // Fetch initial batch with pagination
        const allPortionsData = await FoodPortionService.getAllPortions();
        const initialPortions = allPortionsData.slice(0, initialLimit);

        if (initialPortions.length === 0) {
          setPortions([]);
          setHasMore(false);
          setIsLoading(false);
          return;
        }

        setPortions(initialPortions);
        setCurrentOffset(initialLimit);

        // Check if there are more portions
        setHasMore(allPortionsData.length > initialLimit);
      }
    } catch (err) {
      console.error('Error loading food portions:', err);
      setPortions([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load food portions');
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit, getAll]);

  // Load more portions (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      const allPortionsData = await FoodPortionService.getAllPortions();
      const nextBatch = allPortionsData.slice(currentOffset, currentOffset + batchSize);

      if (nextBatch.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing portions
      setPortions((prev) => [...prev, ...nextBatch]);

      const newOffset = currentOffset + nextBatch.length;
      setCurrentOffset(newOffset);

      // Check if there are more portions
      setHasMore(newOffset < allPortionsData.length);
    } catch (err) {
      console.error('Error loading more food portions:', err);
      setHasMore(false);
      setError(err instanceof Error ? err.message : 'Failed to load more food portions');
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, getAll]);

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

  // Return appropriate type based on mode
  if (mode === 'all') {
    return {
      portions: allPortions,
      isLoading: isLoadingAll,
      error: errorAll,
      refresh: refreshAll,
    };
  }

  return {
    portions,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: refreshPaginated,
    error,
  };
}
