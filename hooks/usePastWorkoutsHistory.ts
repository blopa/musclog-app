import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkoutService } from '../database/services/WorkoutService';
import {
  type WorkoutHistorySection,
  type WorkoutFilters,
  calculateDateRange,
  processWorkouts,
  groupWorkoutsByMonth,
  mergeWorkoutSections,
  filterWorkoutsBySearch,
} from '../utils/workoutHistory';

const BATCH_SIZE = 5;

export interface UsePastWorkoutsHistoryParams {
  visible: boolean;
}

export function usePastWorkoutsHistory({ visible }: UsePastWorkoutsHistoryParams) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [workoutHistoryData, setWorkoutHistoryData] = useState<WorkoutHistorySection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<WorkoutFilters>({
    workoutType: 'all',
    dateRange: '30',
    muscleGroups: [],
    minDuration: 0,
  });

  const loadWorkoutHistory = useCallback(async () => {
    setIsLoading(true);
    setPageOffset(0);
    setHasMore(true);
    try {
      const timeframe = calculateDateRange(filters.dateRange || '30');

      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE);

      const validWorkouts = await processWorkouts(workouts, filters, t);

      const sections = groupWorkoutsByMonth(validWorkouts);

      setWorkoutHistoryData(sections);
      setPageOffset(BATCH_SIZE);

      if (workouts.length < BATCH_SIZE) {
        setHasMore(false);
      } else {
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, BATCH_SIZE);
        setHasMore(nextBatch.length > 0);
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
      setWorkoutHistoryData([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [filters, t]);

  const loadMoreWorkouts = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    try {
      const timeframe = calculateDateRange(filters.dateRange || '30');

      const workouts = await WorkoutService.getWorkoutHistory(timeframe, BATCH_SIZE, pageOffset);

      if (workouts.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const validWorkouts = await processWorkouts(workouts, filters, t);

      if (validWorkouts.length > 0) {
        const mergedSections = mergeWorkoutSections(workoutHistoryData, validWorkouts);
        setWorkoutHistoryData(mergedSections);
      }

      const newOffset = pageOffset + workouts.length;
      setPageOffset(newOffset);

      if (workouts.length < BATCH_SIZE) {
        setHasMore(false);
      } else {
        const nextBatch = await WorkoutService.getWorkoutHistory(timeframe, 1, newOffset);
        setHasMore(nextBatch.length > 0);
      }
    } catch (error) {
      console.error('Error loading more workouts:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, pageOffset, filters, t, workoutHistoryData]);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setWorkoutHistoryData([]);
      setPageOffset(0);
      setHasMore(true);
      setIsLoadingMore(false);
      const timeoutId = setTimeout(() => {
        loadWorkoutHistory();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    } else {
      setIsLoading(false);
      setWorkoutHistoryData([]);
      setPageOffset(0);
      setHasMore(true);
      setIsLoadingMore(false);
    }
  }, [visible, filters, loadWorkoutHistory]);

  const filteredWorkoutHistoryData = filterWorkoutsBySearch(workoutHistoryData, searchQuery);

  const handleApplyFilters = useCallback(
    (newFilters: {
      workoutType?: 'all' | 'strength' | 'cardio' | 'hiit' | 'yoga';
      dateRange?: '30' | '90' | 'custom';
      muscleGroups?: ('chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full-body')[];
      minDuration?: number;
    }) => {
      setFilters({
        workoutType: newFilters.workoutType || 'all',
        dateRange: newFilters.dateRange || '30',
        muscleGroups: newFilters.muscleGroups || [],
        minDuration: newFilters.minDuration || 0,
      });
    },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      workoutType: 'all',
      dateRange: '30',
      muscleGroups: [],
      minDuration: 0,
    });
  }, []);

  return {
    isLoading,
    isLoadingMore,
    workoutHistoryData: filteredWorkoutHistoryData,
    searchQuery,
    hasMore,
    filters,
    setSearchQuery,
    loadMoreWorkouts,
    handleApplyFilters,
    handleClearFilters,
  };
}
