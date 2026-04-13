import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { database } from '@/database';
import Exercise from '@/database/models/Exercise';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import WorkoutLog from '@/database/models/WorkoutLog';
import { UserMetricService, WorkoutAnalytics } from '@/database/services';
import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';
import { localDayStartMs } from '@/utils/calendarDate';
import {
  type ExerciseType,
  projectGoal,
  type ProjectionResult,
} from '@/utils/exerciseGoalProjection';

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
  const [exerciseType, setExerciseType] = useState<ExerciseType>('other');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    if (goal.goalType === '1rm' && goal.exerciseId) {
      try {
        const goalCreatedAt = goal.createdAt.getTime();
        const [filteredData, bw, exercise] = await Promise.all([
          WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId, {
            startDate: goalCreatedAt,
            endDate: Date.now(),
          }),
          UserMetricService.getUserBodyWeightKgForVolume(),
          database.get<Exercise>('exercises').find(goal.exerciseId),
        ]);

        setDataPoints(filteredData);
        setBodyWeight(bw);

        if (exercise.name.toLowerCase().includes('deadlift')) setExerciseType('deadlift');
        else if (exercise.name.toLowerCase().includes('squat')) setExerciseType('squat');
        else if (exercise.name.toLowerCase().includes('bench')) setExerciseType('bench');
        else if (
          exercise.name.toLowerCase().includes('overhead') ||
          exercise.name.toLowerCase().includes('military')
        )
          setExerciseType('overhead_press');
        else setExerciseType('other');
      } catch (err) {
        console.error('Error loading exercise goal progress:', err);
        setDataPoints([]);
      }
    } else if (goal.goalType === 'consistency') {
      try {
        const now = new Date();
        const weekStartMs = localDayStartMs(now) - 6 * 86_400_000;

        const count = await database
          .get<WorkoutLog>('workout_logs')
          .query(Q.where('completed_at', Q.gte(weekStartMs)), Q.where('deleted_at', Q.eq(null)))
          .fetchCount();

        setSessionsThisWeek(count);
      } catch (err) {
        console.error('Error loading consistency goal progress:', err);
        setSessionsThisWeek(0);
      }
    }

    setIsLoading(true);
    try {
      const goalCreatedAt = goal.createdAt.getTime();
      const filteredData = await WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId, {
        startDate: goalCreatedAt,
        endDate: Date.now(),
      });

      setDataPoints(filteredData);
    } catch (err) {
      console.error('Error loading exercise goal progress:', err);
      setDataPoints([]);
    } finally {
      setIsLoading(false);
    }
  }, [goal.exerciseId, goal.goalType, goal.createdAt]);

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
          if (debounceTimer) clearTimeout(debounceTimer);
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
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadData();
        }, 500);
      },
      error: (err: Error) => console.error('useExerciseGoalProgress subscription error:', err),
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [goal.exerciseId, goal.goalType, loadData]);

  const projection = useMemo<ProjectionResult | null>(() => {
    if (goal.goalType !== '1rm') return null;
    if (goal.targetWeight === null || goal.baseline1rm === null) return null;

    return projectGoal({
      dataPoints,
      baseline1rm: goal.baseline1rm,
      targetWeight: goal.targetWeight,
      bodyWeight,
      exerciseType,
    });
  }, [dataPoints, goal.goalType, goal.targetWeight, goal.baseline1rm, bodyWeight, exerciseType]);

  return {
    projection,
    isLoading,
    dataPoints,
    sessionsThisWeek,
    refresh: loadData,
  };
}
