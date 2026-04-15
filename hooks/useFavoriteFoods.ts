import { useCallback, useEffect, useMemo, useState } from 'react';

import Food from '@/database/models/Food';
import { NutritionService } from '@/database/services';
import { handleError } from '@/utils/handleError';

// Hook parameters
export interface UseFavoriteFoodsParams {
  initialLimit?: number; // Default: 10
  batchSize?: number; // Default: 10
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
}

// Return type
export type UseFavoriteFoodsResult = {
  foods: Food[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalCount: number;
  error: Error | null;
};

/**
 * Hook for managing favorite foods with pagination and reactive updates
 */
export function useFavoriteFoods({
  initialLimit = 10,
  batchSize = 10,
  enableReactivity = true,
  visible = true,
}: UseFavoriteFoodsParams = {}): UseFavoriteFoodsResult {
  // State
  const [foods, setFoods] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Always load total count (even when not visible for tab labels)
  useEffect(() => {
    const loadTotalCount = async () => {
      try {
        const count = await NutritionService.getFavoriteFoodsCount();
        setTotalCount(count);
        setError(null);
      } catch (err) {
        handleError(err, 'useFavoriteFoods.loadCount');
        console.error('Error loading favorite foods count:', err);
        setError(err as Error);
        setTotalCount(0);
      }
    };

    loadTotalCount();
  }, []);

  // Load initial batch of favorite foods
  const loadInitialFoods = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setError(null);

    try {
      // Get total count first (in case it wasn't loaded yet)
      const count = await NutritionService.getFavoriteFoodsCount();
      setTotalCount(count);

      // Load initial batch
      const foodsList = await NutritionService.getFavoriteFoods(initialLimit, 0);
      setFoods(foodsList);
      setHasMore(foodsList.length === initialLimit && foodsList.length < count);
      setCurrentOffset(foodsList.length);
    } catch (err) {
      handleError(err, 'useFavoriteFoods.loadFavorites');
      console.error('Error loading favorite foods:', err);
      setFoods([]);
      setHasMore(false);
      setTotalCount(0);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit]);

  // Load more foods (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      const moreFoods = await NutritionService.getFavoriteFoods(batchSize, currentOffset);

      if (moreFoods.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing foods
      setFoods((prev) => [...prev, ...moreFoods]);

      const newOffset = currentOffset + moreFoods.length;
      setCurrentOffset(newOffset);

      // Check if there are more foods
      if (moreFoods.length < batchSize) {
        setHasMore(false);
      } else {
        setHasMore(newOffset < totalCount);
      }
    } catch (err) {
      handleError(err, 'useFavoriteFoods.loadMoreFavorites');
      console.error('Error loading more favorite foods:', err);
      setHasMore(false);
      setError(err as Error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, totalCount]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitialFoods();
  }, [loadInitialFoods]);

  // Load initial data when hook mounts or dependencies change
  useEffect(() => {
    loadInitialFoods();
  }, [loadInitialFoods]);

  // Memoized result
  const result = useMemo(
    () => ({
      foods,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh,
      totalCount,
      error,
    }),
    [foods, isLoading, isLoadingMore, hasMore, loadMore, refresh, totalCount, error]
  );

  return result;
}

export default useFavoriteFoods;
