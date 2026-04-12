import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';

type Mode = 'active' | 'history';

interface UseExerciseGoalsParams {
  mode: Mode;
  visible?: boolean;
  initialLimit?: number;
  batchSize?: number;
}

interface UseExerciseGoalsResult {
  goals: ExerciseGoal[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useExerciseGoals({
  mode,
  visible = true,
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
}: UseExerciseGoalsParams): UseExerciseGoalsResult {
  const [goals, setGoals] = useState<ExerciseGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setOffset(0);
    setHasMore(true);

    try {
      if (mode === 'active') {
        const activeGoals = await ExerciseGoalService.getActiveGoals();
        setGoals(activeGoals);
        setHasMore(false);
      } else {
        const history = await ExerciseGoalService.getGoalHistory(initialLimit, 0);
        setGoals(history);
        setOffset(history.length);

        if (history.length < initialLimit) {
          setHasMore(false);
        } else {
          // Check if there's more
          const next = await ExerciseGoalService.getGoalHistory(1, initialLimit);
          setHasMore(next.length > 0);
        }
      }
    } catch (err) {
      console.error('Error loading exercise goals:', err);
      setGoals([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [mode, visible, initialLimit]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || mode !== 'history' || !visible) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const more = await ExerciseGoalService.getGoalHistory(batchSize, offset);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setGoals((prev) => [...prev, ...more]);
        setOffset((prev) => prev + more.length);

        if (more.length < batchSize) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Error loading more exercise goals:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, mode, visible, offset, batchSize]);

  // Subscribe to changes
  useEffect(() => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    loadInitial();

    // Subscribe to exercise_goals table changes
    const query = database
      .get<ExerciseGoal>('exercise_goals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(1));

    const subscription = query.observe().subscribe({
      next: () => loadInitial(),
      error: (err: Error) => console.error('Error observing exercise goals:', err),
    });

    return () => subscription.unsubscribe();
  }, [visible, loadInitial]);

  return useMemo(
    () => ({
      goals,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh: loadInitial,
    }),
    [goals, isLoading, isLoadingMore, hasMore, loadMore, loadInitial]
  );
}
