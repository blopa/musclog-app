import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import { database } from '@/database';
import type Exercise from '@/database/models/Exercise';
import { ExerciseService } from '@/database/services';
import { handleError } from '@/utils/handleError';

// Hook parameters
export interface UseExercisesParams {
  mode?: 'list' | 'search' | 'by-muscle' | 'by-equipment' | 'by-mechanic' | 'frequent'; // Default: 'list'
  searchTerm?: string; // For search mode
  muscleGroup?: string; // For by-muscle mode
  equipmentType?: string; // For by-equipment mode
  mechanicType?: string; // For by-mechanic mode
  initialLimit?: number; // Default: 20
  batchSize?: number; // Default: 20
  getAll?: boolean; // If true, fetch all exercises (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'muscle_group'; // Default: 'name'
  sortOrder?: 'asc' | 'desc'; // Default: 'asc'
}

// Return type
export type UseExercisesResult = {
  exercises: Exercise[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Hook for managing exercises data with reactive updates
 */
export function useExercises({
  mode = 'list',
  searchTerm,
  muscleGroup,
  equipmentType,
  mechanicType,
  initialLimit = 20,
  batchSize = DEFAULT_BATCH_SIZE,
  getAll = false,
  enableReactivity = true,
  visible = true,
  sortBy = 'name',
  sortOrder = 'asc',
}: UseExercisesParams = {}): UseExercisesResult {
  // State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Load initial batch of exercises
  const loadInitialExercises = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

    // Wait for the next animation frame so React commits the loading state to screen
    // before the heavy DB work starts (React 18 automatic batching would otherwise
    // coalesce setIsLoading(true) + setIsLoading(false) into a single no-op render)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      let exercisesList: Exercise[];

      if (mode === 'search' && searchTerm) {
        // Search mode
        exercisesList = await ExerciseService.searchExercises(searchTerm);
        setHasMore(false); // No pagination for search currently
        setCurrentOffset(exercisesList.length);
      } else if (mode === 'by-muscle' && muscleGroup) {
        // By muscle group mode
        exercisesList = await ExerciseService.getExercisesByMuscleGroup(muscleGroup);
        setHasMore(false); // No pagination for muscle group filter currently
        setCurrentOffset(exercisesList.length);
      } else if (mode === 'by-equipment' && equipmentType) {
        // By equipment type mode
        exercisesList = await ExerciseService.getExercisesByEquipmentType(equipmentType);
        setHasMore(false); // No pagination for equipment filter currently
        setCurrentOffset(exercisesList.length);
      } else if (mode === 'by-mechanic' && mechanicType) {
        // By mechanic type mode
        exercisesList = await ExerciseService.getExercisesByMechanicType(mechanicType);
        setHasMore(false); // No pagination for mechanic filter currently
        setCurrentOffset(exercisesList.length);
      } else if (mode === 'frequent') {
        // Frequent exercises mode
        exercisesList = await ExerciseService.getFrequentlyUsedExercises(initialLimit);
        setHasMore(false); // No pagination for frequent mode currently
        setCurrentOffset(exercisesList.length);
      } else {
        // List mode
        if (getAll) {
          exercisesList = await ExerciseService.getAllExercises();
          setHasMore(false);
          setCurrentOffset(exercisesList.length);
        } else {
          const filters = {
            muscleGroup: muscleGroup || undefined,
            searchTerm: searchTerm?.trim() || undefined,
          };
          const page = await ExerciseService.getExercisesPaginatedFiltered(
            initialLimit + 1,
            0,
            filters
          );
          exercisesList = page.slice(0, initialLimit);
          setHasMore(page.length > initialLimit);
          setCurrentOffset(exercisesList.length);
        }
      }

      // Paginated list queries use the database's stable catalogue ordering.
      if (mode !== 'list' || getAll) {
        exercisesList = exercisesList.sort((a, b) => {
          // First sort by source (app exercises first)
          const aSource = a.source ?? 'user';
          const bSource = b.source ?? 'user';
          const sourceCompare = aSource.localeCompare(bSource);
          if (sourceCompare !== 0) {
            return sourceCompare;
          }

          // For app exercises, sort by order_index (JSON order)
          if (a.source === 'app' && b.source === 'app') {
            const orderCompare = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
            if (orderCompare !== 0) {
              return orderCompare;
            }
          }

          // Then sort by the specified field
          let aValue: any = a[sortBy as keyof Exercise];
          let bValue: any = b[sortBy as keyof Exercise];

          if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = (bValue as string).toLowerCase();
          }

          if (sortOrder === 'asc') {
            if (aValue > bValue) {
              return 1;
            }

            if (aValue < bValue) {
              return -1;
            }

            return 0;
          }

          if (aValue < bValue) {
            return 1;
          }

          if (aValue > bValue) {
            return -1;
          }

          return 0;
        });
      }

      setExercises(exercisesList);
    } catch (err) {
      handleError(err, 'useExercises.loadExercises');
      console.error('Error loading exercises:', err);
      setExercises([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    visible,
    mode,
    searchTerm,
    muscleGroup,
    equipmentType,
    mechanicType,
    initialLimit,
    getAll,
    sortBy,
    sortOrder,
  ]);

  // Load more exercises (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll || mode !== 'list') {
      return;
    }

    setIsLoadingMore(true);

    // Small delay to allow React to render the loading state before closing
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    try {
      const filters = {
        muscleGroup: muscleGroup || undefined,
        searchTerm: searchTerm?.trim() || undefined,
      };
      const page = await ExerciseService.getExercisesPaginatedFiltered(
        batchSize + 1,
        currentOffset,
        filters
      );
      const moreExercises = page.slice(0, batchSize);

      if (moreExercises.length === 0) {
        setHasMore(false);
        return;
      }

      setExercises((prev) => [...prev, ...moreExercises]);
      setCurrentOffset((prev) => prev + moreExercises.length);
      setHasMore(page.length > batchSize);
    } catch (err) {
      handleError(err, 'useExercises.loadMoreExercises');
      console.error('Error loading more exercises:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    visible,
    currentOffset,
    batchSize,
    mode,
    getAll,
    muscleGroup,
    searchTerm,
  ]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitialExercises();
  }, [loadInitialExercises]);

  // Observe database changes for reactivity
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        const run = () => {
          void loadInitialExercises();
        };
        run();
      }
      return;
    }

    // Build query based on mode
    let query = database.get<Exercise>('exercises').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy(sortBy, sortOrder === 'asc' ? Q.asc : Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    // Add mode-specific filters
    if (mode === 'by-muscle' && muscleGroup) {
      query = query.extend(Q.where('muscle_group', muscleGroup));
    } else if (mode === 'by-equipment' && equipmentType) {
      query = query.extend(Q.where('equipment_type', equipmentType));
    } else if (mode === 'by-mechanic' && mechanicType) {
      query = query.extend(Q.where('mechanic_type', mechanicType));
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // When an exercise is created/updated, reload the initial batch
        loadInitialExercises();
      },
      error: (err) => {
        console.error('Error observing exercises:', err);
      },
    });

    // Load initial data
    const runInit = () => {
      void loadInitialExercises();
    };
    runInit();

    return () => subscription.unsubscribe();
  }, [
    enableReactivity,
    visible,
    mode,
    muscleGroup,
    equipmentType,
    mechanicType,
    sortBy,
    sortOrder,
    loadInitialExercises,
  ]);

  // Memoized result
  const result = useMemo(
    () => ({
      exercises,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh,
    }),
    [exercises, isLoading, isLoadingMore, hasMore, loadMore, refresh]
  );

  return result;
}

export default useExercises;
