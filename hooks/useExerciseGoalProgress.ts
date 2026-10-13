import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { WorkoutAnalytics } from '@/database/services/WorkoutAnalytics';
import { WorkoutService } from '@/database/services/WorkoutService';
import type { ProjectionResult } from '@/utils/exerciseGoalProjection';

interface UseExerciseGoalProgressResult {
  projection: ProjectionResult | null;
  isLoading: boolean;
  dataPoints: ProgressiveOverloadDataPoint[];
  sessionsThisWeek: number;
  currentBaseline1rm: number | null;
  recentAverage1RM: number | null;
  refresh: () => Promise<void>;
  recalculateBaseline: () => Promise<void>;
}

export function useExerciseGoalProgress(goal: ExerciseGoal): UseExerciseGoalProgressResult {
  const [dataPoints, setDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [loadMultiplier, setLoadMultiplier] = useState(1.0);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>('other');
  const [hasPerformed1RMDate, setHasPerformed1RMDate] = useState<number | null>(null);
  const [recentAverage1RM, setRecentAverage1RM] = useState<number | null>(null);
  const [currentBaseline1rm, setCurrentBaseline1rm] = useState<number | null>(
    () => goal.baseline1rm
  );
  const [isLoading, setIsLoading] = useState(true);

  // Sync local baseline state when the goal instance changes (e.g. modal opens)
  useEffect(() => {
    const syncBaseline = () => {
      setCurrentBaseline1rm(goal.baseline1rm ?? null);
    };

    syncBaseline();
  }, [goal.id, goal.baseline1rm]);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      if (goal.goalType === '1rm' && goal.exerciseId) {
        const inputs = await ExerciseGoalService.load1rmGoalInputs(goal);
        if (inputs) {
          setDataPoints(inputs.dataPoints);
          setHasPerformed1RMDate(inputs.hasPerformed1RMDate);
          setRecentAverage1RM(inputs.recentAverage1RM);
          setBodyWeight(inputs.bodyWeight);
          setLoadMultiplier(inputs.loadMultiplier);
          setUserGender(inputs.userGender);
        }
      } else if (goal.goalType === 'consistency') {
        const count = await WorkoutService.getRollingWeeklyCompletedWorkoutCount();
        setSessionsThisWeek(count);
      }
    } catch (err) {
      console.error('Error loading exercise goal progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [goal]);

  // Initial load
  useEffect(() => {
    const run = () => {
      void loadData();
    };

    run();
  }, [loadData]);

  // Reactive subscription: re-run whenever relevant tables change
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let subscription: any = null;

    if (goal.goalType === '1rm' && goal.exerciseId) {
      const query = database
        .get('workout_log_sets')
        .query(Q.where('deleted_at', Q.eq(null)), Q.take(1));

      subscription = query.observe().subscribe({
        next: () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            loadData();
          }, 500);
        },
        error: (err: Error) => console.error('useExerciseGoalProgress subscription error:', err),
      });
    } else if (goal.goalType === 'consistency') {
      const query = database
        .get('workout_logs')
        .query(Q.where('deleted_at', Q.eq(null)), Q.take(1));

      subscription = query.observe().subscribe({
        next: () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            loadData();
          }, 500);
        },
        error: (err: Error) => console.error('useExerciseGoalProgress subscription error:', err),
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [goal.exerciseId, goal.goalType, loadData]);

  const projection = useMemo<ProjectionResult | null>(() => {
    return ExerciseGoalService.project1rmGoal(
      goal,
      {
        dataPoints,
        hasPerformed1RMDate,
        recentAverage1RM,
        bodyWeight,
        loadMultiplier,
        userGender,
      },
      currentBaseline1rm
    );
  }, [
    dataPoints,
    goal,
    currentBaseline1rm,
    bodyWeight,
    loadMultiplier,
    userGender,
    hasPerformed1RMDate,
    recentAverage1RM,
  ]);

  const recalculateBaseline = useCallback(async () => {
    if (goal.goalType !== '1rm' || !goal.exerciseId) {
      return;
    }

    setIsLoading(true);
    try {
      const recentAverage = await WorkoutAnalytics.getRecentFirstSetAverage1RM(goal.exerciseId);
      if (recentAverage != null) {
        await ExerciseGoalService.updateBaseline1rm(goal.id, recentAverage.average1RM);
        setCurrentBaseline1rm(recentAverage.average1RM);
      }

      await loadData();
    } catch (err) {
      console.error('Error recalculating baseline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [goal.id, goal.exerciseId, goal.goalType, loadData]);

  return {
    projection,
    isLoading,
    dataPoints,
    sessionsThisWeek,
    currentBaseline1rm,
    recentAverage1RM,
    refresh: loadData,
    recalculateBaseline,
  };
}
