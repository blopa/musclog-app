import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '@/constants/database';
import { database } from '@/database';
import NutritionGoal from '@/database/models/NutritionGoal';
import { NutritionGoalService } from '@/database/services';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { resolveDailyMacros, type ResolvedMacros } from '@/utils/dynamicNutritionTarget';

// Hook parameters
export interface UseCurrentNutritionGoalParams {
  mode?: 'current' | 'history'; // Default: 'current'
  /** When set, resolve the goal active on this date (e.g. Food screen). When omitted, use today. */
  date?: Date;
  initialLimit?: number; // For history mode, default: 5
  batchSize?: number; // For history mode, default: 5
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
}

// Return type for current mode
export type UseCurrentNutritionGoalResultCurrent = {
  goal: NutritionGoal | null;
  /** For dynamic goals: computed macros for the resolved date. Null for static goals. */
  resolvedMacros: ResolvedMacros | null;
  isLoading: boolean;
};

// Return type for history mode
export type UseCurrentNutritionGoalResultHistory = {
  goals: NutritionGoal[];
  current: NutritionGoal | null; // The active goal (effective_until IS NULL)
  /** For dynamic current goal: computed macros for today. Null for static goals. */
  resolvedMacros: ResolvedMacros | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

export type UseCurrentNutritionGoalResult =
  | UseCurrentNutritionGoalResultCurrent
  | UseCurrentNutritionGoalResultHistory;

// Function overloads for proper type narrowing
export function useCurrentNutritionGoal(
  params?: UseCurrentNutritionGoalParams & { mode?: 'current' }
): UseCurrentNutritionGoalResultCurrent;

export function useCurrentNutritionGoal(
  params: UseCurrentNutritionGoalParams & { mode: 'history' }
): UseCurrentNutritionGoalResultHistory;

export function useCurrentNutritionGoal({
  mode = 'current',
  date,
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
  enableReactivity = true,
  visible = true,
}: UseCurrentNutritionGoalParams = {}): UseCurrentNutritionGoalResult {
  // State for current mode
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [resolvedMacros, setResolvedMacros] = useState<ResolvedMacros | null>(null);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const displayDateRef = useRef<Date>(localCalendarDayDate(date ?? new Date()));

  // State for history mode
  const [goals, setGoals] = useState<NutritionGoal[]>([]);
  const [currentGoal, setCurrentGoal] = useState<NutritionGoal | null>(null);
  const [currentGoalResolvedMacros, setCurrentGoalResolvedMacros] = useState<ResolvedMacros | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Load initial batch of goals (history mode)
  const loadInitialGoals = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setHasMore(true);

    try {
      // Fetch initial batch
      const goalHistory = await NutritionGoalService.getGoalsHistory(initialLimit);

      if (goalHistory.length === 0) {
        setGoals([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      setGoals(goalHistory);
      setCurrentOffset(initialLimit);

      // Get current goal (effective_until IS NULL)
      const current = await NutritionGoalService.getCurrent();
      setCurrentGoal(current);

      // Resolve macros for the current goal if it is dynamic
      if (current?.isDynamic) {
        resolveDailyMacros(current, new Date())
          .then(setCurrentGoalResolvedMacros)
          .catch(() => setCurrentGoalResolvedMacros(null));
      } else {
        setCurrentGoalResolvedMacros(null);
      }

      // Check if there are more goals
      if (goalHistory.length < initialLimit) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await NutritionGoalService.getGoalsHistory(1, initialLimit);
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading nutrition goals history:', err);
      setGoals([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit]);

  // Load more goals (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible) {
      return;
    }

    setIsLoadingMore(true);

    try {
      // Fetch next batch
      const goalHistory = await NutritionGoalService.getGoalsHistory(batchSize, currentOffset);

      if (goalHistory.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing goals
      setGoals((prev) => [...prev, ...goalHistory]);

      const newOffset = currentOffset + goalHistory.length;
      setCurrentOffset(newOffset);

      // Check if there are more goals
      if (goalHistory.length < batchSize) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await NutritionGoalService.getGoalsHistory(1, newOffset);
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading more nutrition goals:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize]);

  // Current mode: resolve goal for display date, subscribe to changes when enableReactivity is true
  useEffect(() => {
    if (mode !== 'current') {
      return;
    }

    displayDateRef.current = localCalendarDayDate(date ?? new Date());

    const fetchGoalForDate = () => {
      NutritionGoalService.getGoalForDate(displayDateRef.current)
        .then((g) => {
          setGoal(g);
          setIsLoadingCurrent(false);
        })
        .catch(() => {
          setGoal(null);
          setIsLoadingCurrent(false);
        });
    };

    setIsLoadingCurrent(true);
    fetchGoalForDate();

    if (!enableReactivity) {
      return;
    }

    const query = database
      .get<NutritionGoal>('nutrition_goals')
      .query(Q.where('deleted_at', Q.eq(null)));

    const subscription = query.observe().subscribe({
      next: () => fetchGoalForDate(),
      error: () => {
        setGoal(null);
        setIsLoadingCurrent(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [date, mode, enableReactivity]);

  // Current mode: resolve dynamic macros whenever the goal or date changes
  useEffect(() => {
    if (mode !== 'current') {
      return;
    }

    if (!goal?.isDynamic) {
      setResolvedMacros(null);
      return;
    }

    resolveDailyMacros(goal, displayDateRef.current)
      .then(setResolvedMacros)
      .catch(() => {
        setResolvedMacros(null);
      });
  }, [goal, date, mode]);

  // History mode: Observe for new goals to trigger reload (reactivity)
  useEffect(() => {
    if (mode !== 'history') {
      return;
    }

    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialGoals();
      }
      return;
    }

    // Observe nutrition goals to detect when new ones are added
    const query = database.get<NutritionGoal>('nutrition_goals').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    const subscription = query.observe().subscribe({
      next: () => {
        // When a new goal is created/updated, reload the initial batch
        loadInitialGoals();
      },
      error: (err) => {
        console.error('Error observing nutrition goals:', err);
      },
    });

    // Load initial data
    loadInitialGoals();

    return () => subscription.unsubscribe();
  }, [mode, enableReactivity, visible, loadInitialGoals]);

  // Current mode result
  const currentResult = useMemo(
    () => ({
      goal,
      resolvedMacros,
      isLoading: isLoadingCurrent,
    }),
    [goal, resolvedMacros, isLoadingCurrent]
  );

  // History mode result
  const historyResult = useMemo(
    () => ({
      goals,
      current: currentGoal,
      resolvedMacros: currentGoalResolvedMacros,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      refresh: loadInitialGoals,
    }),
    [
      goals,
      currentGoal,
      currentGoalResolvedMacros,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
      loadInitialGoals,
    ]
  );

  // Return appropriate type based on mode
  return (mode === 'history' ? historyResult : currentResult) as UseCurrentNutritionGoalResult;
}
