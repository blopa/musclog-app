import { useState, useEffect, useMemo, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Exercise from '../database/models/Exercise';
import { ExerciseService } from '../database/services';
import { DEFAULT_BATCH_SIZE } from '../constants/database';

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
  totalCount?: number;
  muscleGroups?: string[];
  equipmentTypes?: string[];
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
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [muscleGroups, setMuscleGroups] = useState<string[]>();
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>();

  // Load initial batch of exercises
  const loadInitialExercises = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

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
          // Fetch all exercises (no pagination)
          exercisesList = await ExerciseService.getAllExercises();
          setHasMore(false);
        } else {
          // Fetch initial batch - since ExerciseService doesn't have pagination, get all and slice
          const allExercises = await ExerciseService.getAllExercises();
          exercisesList = allExercises.slice(0, initialLimit);
          setHasMore(allExercises.length > initialLimit);
          setCurrentOffset(initialLimit);
        }
      }

      // Apply sorting
      exercisesList = exercisesList.sort((a, b) => {
        let aValue: any = a[sortBy as keyof Exercise];
        let bValue: any = b[sortBy as keyof Exercise];
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue as string).toLowerCase();
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      setExercises(exercisesList);

      // Get total count for list mode
      if (mode === 'list') {
        const count = await ExerciseService.getExercisesCount();
        setTotalCount(count);
      }

      // Load muscle groups and equipment types for list mode
      if (mode === 'list') {
        const [muscleGroupsList, equipmentTypesList] = await Promise.all([
          ExerciseService.getMuscleGroups(),
          ExerciseService.getEquipmentTypes()
        ]);
        setMuscleGroups(muscleGroupsList);
        setEquipmentTypes(equipmentTypesList);
      }
    } catch (err) {
      console.error('Error loading exercises:', err);
      setExercises([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, mode, searchTerm, muscleGroup, equipmentType, mechanicType, initialLimit, getAll, sortBy, sortOrder]);

  // Load more exercises (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll || 
        mode === 'search' || mode === 'by-muscle' || mode === 'by-equipment' || 
        mode === 'by-mechanic' || mode === 'frequent') {
      // Don't load more for filtered modes or if getAll is true
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      // Get all exercises and slice the next batch
      const allExercises = await ExerciseService.getAllExercises();
      const moreExercises = allExercises.slice(currentOffset, currentOffset + batchSize);

      if (moreExercises.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Apply sorting to the batch
      moreExercises.sort((a, b) => {
        let aValue: any = a[sortBy as keyof Exercise];
        let bValue: any = b[sortBy as keyof Exercise];
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue as string).toLowerCase();
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      // Append to existing exercises
      setExercises((prev) => [...prev, ...moreExercises]);

      const newOffset = currentOffset + moreExercises.length;
      setCurrentOffset(newOffset);

      // Check if there are more exercises
      if (moreExercises.length < batchSize) {
        setHasMore(false);
      } else {
        setHasMore(newOffset < allExercises.length);
      }
    } catch (err) {
      console.error('Error loading more exercises:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, mode, getAll, sortBy, sortOrder]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitialExercises();
  }, [loadInitialExercises]);

  // Observe database changes for reactivity
  useEffect(() => {
    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialExercises();
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
    loadInitialExercises();

    return () => subscription.unsubscribe();
  }, [enableReactivity, visible, mode, muscleGroup, equipmentType, mechanicType, sortBy, sortOrder, loadInitialExercises]);

  // Memoized result
  const result = useMemo(
    () => ({
      exercises,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh,
      totalCount,
      muscleGroups,
      equipmentTypes,
    }),
    [exercises, isLoading, isLoadingMore, hasMore, loadMore, refresh, totalCount, muscleGroups, equipmentTypes]
  );

  return result;
}

export default useExercises;
