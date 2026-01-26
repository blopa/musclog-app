import { useState, useEffect, useMemo, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Meal from '../database/models/Meal';
import MealFood from '../database/models/MealFood';
import { MealService } from '../database/services';
import { DEFAULT_BATCH_SIZE } from '../constants/database';

// Hook parameters
export interface UseMealsParams {
  mode?: 'list' | 'search' | 'favorites' | 'with-foods'; // Default: 'list'
  searchTerm?: string; // For search mode
  initialLimit?: number; // Default: 20
  batchSize?: number; // Default: 20
  getAll?: boolean; // If true, fetch all meals (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  sortBy?: 'name' | 'created_at' | 'updated_at'; // Default: 'name'
  sortOrder?: 'asc' | 'desc'; // Default: 'asc'
  mealId?: string; // For with-foods mode to get specific meal with its foods
}

// Return type for list/search/favorites mode
export type UseMealsResultBasic = {
  meals: Meal[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalCount?: number;
};

// Return type for with-foods mode
export type UseMealsResultWithFoods = {
  meal: Meal | null;
  foods: MealFood[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  totalNutrients?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
};

export type UseMealsResult = UseMealsResultBasic | UseMealsResultWithFoods;

/**
 * Hook for managing meals data with reactive updates
 */
export function useMeals({
  mode = 'list',
  searchTerm,
  initialLimit = 20,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  enableReactivity = true,
  visible = true,
  sortBy = 'name',
  sortOrder = 'asc',
  mealId,
}: UseMealsParams = {}): UseMealsResult {
  // State for basic modes
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalCount, setTotalCount] = useState<number | undefined>();

  // State for with-foods mode
  const [meal, setMeal] = useState<Meal | null>(null);
  const [foods, setFoods] = useState<MealFood[]>([]);
  const [totalNutrients, setTotalNutrients] = useState<
    | {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      }
    | undefined
  >();

  // Load initial batch of meals (basic modes)
  const loadInitialMeals = useCallback(async () => {
    if (!visible || mode === 'with-foods') {
      if (mode !== 'with-foods') {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

    try {
      let mealsList: Meal[];

      if (mode === 'search' && searchTerm) {
        // Search mode
        mealsList = await MealService.searchMeals(searchTerm);
        setHasMore(false); // No pagination for search currently
        setCurrentOffset(mealsList.length);
      } else if (mode === 'favorites') {
        // Favorites mode
        mealsList = await MealService.getFavoriteMeals();
        setHasMore(false); // No pagination for favorites currently
        setCurrentOffset(mealsList.length);
      } else {
        // List mode
        if (getAll) {
          // Fetch all meals (no pagination)
          mealsList = await MealService.getAllMeals();
          setHasMore(false);
        } else {
          // Fetch initial batch - since MealService doesn't have pagination, get all and slice
          const allMeals = await MealService.getAllMeals();
          mealsList = allMeals.slice(0, initialLimit);
          setHasMore(allMeals.length > initialLimit);
          setCurrentOffset(initialLimit);
        }
      }

      setMeals(mealsList);

      // Get total count for list mode
      if (mode === 'list') {
        const allMeals = await MealService.getAllMeals();
        setTotalCount(allMeals.length);
      }
    } catch (err) {
      console.error('Error loading meals:', err);
      setMeals([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, mode, searchTerm, initialLimit, getAll]);

  // Load specific meal with foods (with-foods mode)
  const loadMealWithFoods = useCallback(async () => {
    if (!visible || mode !== 'with-foods' || !mealId) {
      if (mode === 'with-foods' && !mealId) {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);

    try {
      const result = await MealService.getMealWithFoods(mealId);

      if (result) {
        setMeal(result.meal);
        setFoods(result.foods);

        // Calculate total nutrients
        const nutrients = await result.meal.getTotalNutrients();
        setTotalNutrients(nutrients);
      } else {
        setMeal(null);
        setFoods([]);
        setTotalNutrients(undefined);
      }
    } catch (err) {
      console.error('Error loading meal with foods:', err);
      setMeal(null);
      setFoods([]);
      setTotalNutrients(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [visible, mode, mealId]);

  // Load more meals (pagination)
  const loadMore = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMore ||
      !visible ||
      getAll ||
      mode === 'search' ||
      mode === 'favorites' ||
      mode === 'with-foods'
    ) {
      // Don't load more for search/favorites/with-foods modes or if getAll is true
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      // Get all meals and slice the next batch
      const allMeals = await MealService.getAllMeals();
      const moreMeals = allMeals.slice(currentOffset, currentOffset + batchSize);

      if (moreMeals.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing meals
      setMeals((prev) => [...prev, ...moreMeals]);

      const newOffset = currentOffset + moreMeals.length;
      setCurrentOffset(newOffset);

      // Check if there are more meals
      if (moreMeals.length < batchSize) {
        setHasMore(false);
      } else {
        setHasMore(newOffset < allMeals.length);
      }
    } catch (err) {
      console.error('Error loading more meals:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, mode, getAll]);

  // Refresh data
  const refresh = useCallback(async () => {
    if (mode === 'with-foods') {
      await loadMealWithFoods();
    } else {
      await loadInitialMeals();
    }
  }, [mode, loadInitialMeals, loadMealWithFoods]);

  // Observe database changes for reactivity
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        if (mode === 'with-foods') {
          loadMealWithFoods();
        } else {
          loadInitialMeals();
        }
      }
      return;
    }

    // Build query based on mode
    let query = database.get<Meal>('meals').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy(sortBy, sortOrder === 'asc' ? Q.asc : Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    // Add mode-specific filters
    if (mode === 'favorites') {
      query = query.extend(Q.where('is_favorite', true));
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // When a meal is created/updated, reload the data
        refresh();
      },
      error: (err) => {
        console.error('Error observing meals:', err);
      },
    });

    // Load initial data
    refresh();

    return () => subscription.unsubscribe();
  }, [enableReactivity, visible, mode, sortBy, sortOrder, refresh]);

  // Memoized result for basic modes
  const basicResult = useMemo(
    () => ({
      meals,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh,
      totalCount,
    }),
    [meals, isLoading, isLoadingMore, hasMore, loadMore, refresh, totalCount]
  );

  // Memoized result for with-foods mode
  const withFoodsResult = useMemo(
    () => ({
      meal,
      foods,
      isLoading,
      refresh,
      totalNutrients,
    }),
    [meal, foods, isLoading, refresh, totalNutrients]
  );

  // Return appropriate type based on mode
  return (mode === 'with-foods' ? withFoodsResult : basicResult) as UseMealsResult;
}

export default useMeals;
