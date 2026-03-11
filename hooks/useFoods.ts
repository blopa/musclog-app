import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import { database } from '../database';
import Food from '../database/models/Food';
import { FoodService } from '../database/services';

// Hook parameters
export interface UseFoodsParams {
  mode?: 'list' | 'search' | 'favorites'; // Default: 'list'
  searchTerm?: string; // For search mode
  brand?: string; // Filter by brand
  source?: 'user' | 'usda' | 'ai' | 'openfood'; // Filter by source
  initialLimit?: number; // Default: 20
  batchSize?: number; // Default: 20
  getAll?: boolean; // If true, fetch all foods (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'calories'; // Default: 'name'
  sortOrder?: 'asc' | 'desc'; // Default: 'asc'
}

// Return type for list/search/favorites mode
export type UseFoodsResult = {
  foods: Food[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalCount?: number;
};

/**
 * Hook for managing foods data with reactive updates
 */
export function useFoods({
  mode = 'list',
  searchTerm,
  brand,
  source,
  initialLimit = 20,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  enableReactivity = true,
  visible = true,
  sortBy = 'name',
  sortOrder = 'asc',
}: UseFoodsParams = {}): UseFoodsResult {
  // State
  const [foods, setFoods] = useState<Food[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalCount, setTotalCount] = useState<number | undefined>();

  // Load initial batch of foods
  const loadInitialFoods = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

    try {
      let foodsList: Food[];

      if (mode === 'search' && searchTerm) {
        // Search mode
        foodsList = await FoodService.searchFoods(searchTerm);
        setHasMore(false); // No pagination for search currently
        setCurrentOffset(foodsList.length);
      } else if (mode === 'favorites') {
        // Favorites mode
        foodsList = await FoodService.getFavoriteFoods();
        setHasMore(false); // No pagination for favorites currently
        setCurrentOffset(foodsList.length);
      } else {
        // List mode
        if (getAll) {
          // Fetch all foods (no pagination)
          foodsList = await FoodService.getAllFoods();
          setHasMore(false);
        } else {
          // Fetch initial batch - since FoodService doesn't have pagination, get all and slice
          const allFoods = await FoodService.getAllFoods();
          foodsList = allFoods.slice(0, initialLimit);
          setHasMore(allFoods.length > initialLimit);
          setCurrentOffset(initialLimit);
        }
      }

      setFoods(foodsList);

      // Get total count for list mode
      if (mode === 'list') {
        const allFoods = await FoodService.getAllFoods();
        setTotalCount(allFoods.length);
      }
    } catch (err) {
      console.error('Error loading foods:', err);
      setFoods([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, mode, searchTerm, initialLimit, getAll]);

  // Load more foods (pagination)
  const loadMore = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMore ||
      !visible ||
      getAll ||
      mode === 'search' ||
      mode === 'favorites'
    ) {
      // Don't load more for search/favorites modes or if getAll is true
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      // Get all foods and slice the next batch
      const allFoods = await FoodService.getAllFoods();
      const moreFoods = allFoods.slice(currentOffset, currentOffset + batchSize);

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
        setHasMore(newOffset < allFoods.length);
      }
    } catch (err) {
      console.error('Error loading more foods:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, mode, getAll]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitialFoods();
  }, [loadInitialFoods]);

  // Observe database changes for reactivity
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialFoods();
      }
      return;
    }

    // Build query based on mode and filters
    let query = database.get<Food>('foods').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy(sortBy, sortOrder === 'asc' ? Q.asc : Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    // Add mode-specific filters
    if (mode === 'favorites') {
      query = query.extend(Q.where('is_favorite', true));
    }

    if (brand) {
      query = query.extend(Q.where('brand', brand));
    }

    if (source) {
      query = query.extend(Q.where('source', source));
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // When a food is created/updated, reload the initial batch
        loadInitialFoods();
      },
      error: (err) => {
        console.error('Error observing foods:', err);
      },
    });

    // Load initial data
    loadInitialFoods();

    return () => subscription.unsubscribe();
  }, [enableReactivity, visible, mode, brand, source, sortBy, sortOrder, loadInitialFoods]);

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
    }),
    [foods, isLoading, isLoadingMore, hasMore, loadMore, refresh, totalCount]
  );

  return result;
}

export default useFoods;
