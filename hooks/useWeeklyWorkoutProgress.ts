import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { ExerciseGoalService, WorkoutService } from '@/database/services';
import { handleError } from '@/utils/handleError';

type WeeklyWorkoutProgress = {
  workoutsThisWeek: number;
  weeklyGoal: number | null;
  isLoading: boolean;
};

type UseWeeklyWorkoutProgressParams = {
  date?: Date;
  visible?: boolean;
};

export function useWeeklyWorkoutProgress({
  date = new Date(),
  visible = true,
}: UseWeeklyWorkoutProgressParams = {}): WeeklyWorkoutProgress {
  const [progress, setProgress] = useState<WeeklyWorkoutProgress>({
    workoutsThisWeek: 0,
    weeklyGoal: null,
    isLoading: true,
  });

  const dateTime = date.getTime();

  const loadProgress = useCallback(async () => {
    try {
      const progressDate = new Date(dateTime);
      const [workoutsThisWeek, consistencyGoal] = await Promise.all([
        WorkoutService.getRollingWeeklyCompletedWorkoutCount(progressDate),
        ExerciseGoalService.getActiveConsistencyGoal(),
      ]);

      setProgress({
        workoutsThisWeek,
        weeklyGoal: consistencyGoal?.targetSessionsPerWeek ?? null,
        isLoading: false,
      });
    } catch (error) {
      void handleError(error, 'useWeeklyWorkoutProgress.loadProgress');
      console.error('Error loading weekly workout progress:', error);
      setProgress((prev) => ({ ...prev, isLoading: false }));
    }
  }, [dateTime]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => {
      void loadProgress();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadProgress, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void loadProgress();
      }, 250);
    };

    const subscriptions = [
      database
        .get<WorkoutLog>('workout_logs')
        .query(Q.where('completed_at', Q.notEq(null)), Q.where('deleted_at', Q.eq(null)))
        .observe()
        .subscribe({
          next: scheduleReload,
          error: (err: Error) => console.error('useWeeklyWorkoutProgress workouts error:', err),
        }),
      database
        .get<ExerciseGoal>('exercise_goals')
        .query(Q.where('goal_type', 'consistency'), Q.where('deleted_at', Q.eq(null)))
        .observe()
        .subscribe({
          next: scheduleReload,
          error: (err: Error) => console.error('useWeeklyWorkoutProgress goals error:', err),
        }),
    ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [loadProgress, visible]);

  return useMemo(() => progress, [progress]);
}
