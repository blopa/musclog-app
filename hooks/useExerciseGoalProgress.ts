import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import Exercise from '@/database/models/Exercise';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import WorkoutLog from '@/database/models/WorkoutLog';
import { UserMetricService, UserService, WorkoutAnalytics } from '@/database/services';
import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { localDayStartMs } from '@/utils/calendarDate';
import { projectGoal, type ProjectionResult } from '@/utils/exerciseGoalProjection';

interface UseExerciseGoalProgressResult {
  projection: ProjectionResult | null;
  isLoading: boolean;
  dataPoints: ProgressiveOverloadDataPoint[];
  sessionsThisWeek: number;
  refresh: () => Promise<void>;
}

export function useExerciseGoalProgress(goal: ExerciseGoal): UseExerciseGoalProgressResult {
  const [dataPoints, setDataPoints] = useState<ProgressiveOverloadDataPoint[]>([]);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [loadMultiplier, setLoadMultiplier] = useState(1.0);
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>('male');
  const [hasPerformed1RMDate, setHasPerformed1RMDate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      if (goal.goalType === '1rm' && goal.exerciseId) {
        const goalCreatedAt = goal.createdAt.getTime();
        const [filteredData, performed1RMDate, bw, exercise, user] = await Promise.all([
          WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId, {
            startDate: goalCreatedAt,
            endDate: Date.now(),
          }),
          goal.targetWeight != null
            ? WorkoutAnalytics.getPerformed1RMDate(
                goal.exerciseId,
                goal.targetWeight,
                goalCreatedAt
              )
            : Promise.resolve(null),
          UserMetricService.getUserBodyWeightKgForVolume(),
          database.get<Exercise>('exercises').find(goal.exerciseId),
          UserService.getCurrentUser(),
        ]);

        setDataPoints(filteredData);
        setHasPerformed1RMDate(performed1RMDate);
        setBodyWeight(bw);
        setLoadMultiplier(exercise.loadMultiplier ?? 1.0);
        setUserGender(user?.gender ?? 'male');
      } else if (goal.goalType === 'consistency') {
        const now = new Date();
        const weekStartMs = localDayStartMs(now) - 6 * 86_400_000;

        const count = await database
          .get<WorkoutLog>('workout_logs')
          .query(Q.where('completed_at', Q.gte(weekStartMs)), Q.where('deleted_at', Q.eq(null)))
          .fetchCount();

        setSessionsThisWeek(count);
      }
    } catch (err) {
      console.error('Error loading exercise goal progress:', err);
    } finally {
      setIsLoading(false);
    }
  }, [goal.exerciseId, goal.goalType, goal.createdAt, goal.targetWeight]);

  // Initial load
  useEffect(() => {
    loadData();
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
    if (goal.goalType !== '1rm') {
      return null;
    }
    if (goal.targetWeight === null) {
      return null;
    }

    const effectiveBaseline =
      goal.baseline1rm ?? (dataPoints.length > 0 ? dataPoints[0].estimated1RM : null);

    if (effectiveBaseline === null) {
      return null;
    }

    return projectGoal({
      dataPoints,
      baseline1rm: effectiveBaseline,
      targetWeight: goal.targetWeight,
      bodyWeight,
      loadMultiplier,
      userGender,
      hasPerformed1RMDate,
    });
  }, [
    dataPoints,
    goal.goalType,
    goal.targetWeight,
    goal.baseline1rm,
    bodyWeight,
    loadMultiplier,
    userGender,
    hasPerformed1RMDate,
  ]);

  return {
    projection,
    isLoading,
    dataPoints,
    sessionsThisWeek,
    refresh: loadData,
  };
}
