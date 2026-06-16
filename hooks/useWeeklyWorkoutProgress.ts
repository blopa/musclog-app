import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import type Schedule from '@/database/models/Schedule';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { ExerciseGoalService, WorkoutService, WorkoutTemplateService } from '@/database/services';
import { handleError } from '@/utils/handleError';

type WeeklyWorkoutProgress = {
  workoutsThisWeek: number;
  weeklyGoal: number;
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
    weeklyGoal: 0,
    isLoading: true,
  });

  const dateTime = date.getTime();

  const loadProgress = useCallback(async () => {
    try {
      const progressDate = new Date(dateTime);
      const [workoutsThisWeek, consistencyGoal, scheduledSessionsPerWeek] = await Promise.all([
        WorkoutService.getRollingWeeklyCompletedWorkoutCount(progressDate),
        ExerciseGoalService.getActiveConsistencyGoal(),
        WorkoutTemplateService.getScheduledSessionsPerWeek(),
      ]);

      setProgress({
        workoutsThisWeek,
        weeklyGoal: consistencyGoal?.targetSessionsPerWeek ?? scheduledSessionsPerWeek,
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
      database
        .get<WorkoutTemplate>('workout_templates')
        .query(Q.where('deleted_at', Q.eq(null)))
        .observe()
        .subscribe({
          next: scheduleReload,
          error: (err: Error) => console.error('useWeeklyWorkoutProgress templates error:', err),
        }),
      database
        .get<Schedule>('schedules')
        .query(Q.where('deleted_at', Q.eq(null)))
        .observe()
        .subscribe({
          next: scheduleReload,
          error: (err: Error) => console.error('useWeeklyWorkoutProgress schedules error:', err),
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
