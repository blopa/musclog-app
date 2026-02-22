import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import Exercise from '../database/models/Exercise';
import { ExerciseService } from '../database/services';

export interface UseReplaceExerciseExercisesParams {
  visible: boolean;
  muscleGroup?: string;
  searchTerm?: string;
  initialLimit?: number;
  batchSize?: number;
}

export interface UseReplaceExerciseExercisesResult {
  exercises: Exercise[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Hook for Replace Exercise modal: paginated exercises with optional muscle group and search filters.
 * Loads initial batch when visible/filters change; loadMore appends next batch with same filters.
 */
export function useReplaceExerciseExercises({
  visible,
  muscleGroup,
  searchTerm,
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
}: UseReplaceExerciseExercisesParams): UseReplaceExerciseExercisesResult {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);

    try {
      const filters =
        muscleGroup || (searchTerm?.trim() && searchTerm.trim())
          ? { muscleGroup: muscleGroup || undefined, searchTerm: searchTerm?.trim() || undefined }
          : undefined;

      const result = await ExerciseService.getExercisesPaginatedFiltered(initialLimit, 0, filters);

      setExercises(result);
      setCurrentOffset(result.length);
      setHasMore(result.length >= initialLimit);
    } catch (err) {
      console.error('Error loading exercises for replace modal:', err);
      setExercises([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, muscleGroup, searchTerm, initialLimit]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible) {
      return;
    }

    setIsLoadingMore(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      const filters =
        muscleGroup || (searchTerm?.trim() && searchTerm.trim())
          ? { muscleGroup: muscleGroup || undefined, searchTerm: searchTerm?.trim() || undefined }
          : undefined;

      const result = await ExerciseService.getExercisesPaginatedFiltered(
        batchSize,
        currentOffset,
        filters
      );

      if (result.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      setExercises((prev) => [...prev, ...result]);
      setCurrentOffset((prev) => prev + result.length);
      setHasMore(result.length >= batchSize);
    } catch (err) {
      console.error('Error loading more exercises:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, muscleGroup, searchTerm]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    exercises,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
