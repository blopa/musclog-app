import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { database } from '../database';
import WorkoutLogExercise from '../database/models/WorkoutLogExercise';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { WorkoutService } from '../database/services';
import { transformWorkoutToDetailData, type WorkoutDetailData } from '../utils/workoutDetail';
import { useSettings } from './useSettings';

export interface UsePastWorkoutDetailParams {
  visible: boolean;
  workoutId?: string;
}

export function usePastWorkoutDetail({ visible, workoutId }: UsePastWorkoutDetailParams) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [workout, setWorkout] = useState<WorkoutDetailData | null>(null);
  const [rawSets, setRawSets] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadWorkoutData = useCallback(async () => {
    if (!workoutId) {
      return;
    }

    setIsLoading(true);
    try {
      const { workoutLog, sets, exercises } = await WorkoutService.getWorkoutWithDetails(workoutId);
      setRawSets(sets as any[]);
      const transformedData = await transformWorkoutToDetailData(
        workoutLog,
        sets,
        exercises,
        t,
        units
      );
      setWorkout(transformedData);
    } catch (error) {
      console.error('Error loading workout details:', error);
      setWorkout(null);
    } finally {
      setIsLoading(false);
    }
  }, [workoutId, t, units]);

  // Stable key from rawSets log exercise IDs so we can subscribe to set changes
  const logExerciseIdsKey = useMemo(
    () =>
      rawSets?.length
        ? [
            ...new Set(
              rawSets.map((s: { logExerciseId?: string }) => s.logExerciseId).filter(Boolean)
            ),
          ]
            .sort()
            .join(',')
        : '',
    [rawSets]
  );

  // Observe workout_log_exercises and workout_log_sets so we reload when structure or set data changes
  useEffect(() => {
    if (!visible || !workoutId) {
      setWorkout(null);
      setRawSets(null);
      return;
    }

    const query = database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', workoutId), Q.where('deleted_at', Q.eq(null)));

    const subExercises = query.observe().subscribe({
      next: async () => {
        try {
          await loadWorkoutData();
        } catch (err) {
          console.error('Error handling log exercises subscription update:', err);
        }
      },
      error: (err) => {
        console.error('Workout log exercises subscription error:', err);
      },
    });

    loadWorkoutData();

    return () => subExercises.unsubscribe();
  }, [visible, workoutId, loadWorkoutData]);

  // After we have rawSets, also observe set rows so edits/completions trigger reload
  useEffect(() => {
    if (!visible || !workoutId || !logExerciseIdsKey) {
      return;
    }

    const logExerciseIds = logExerciseIdsKey.split(',').filter(Boolean);
    if (logExerciseIds.length === 0) {
      return;
    }

    const setsQuery = database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('log_exercise_id', Q.oneOf(logExerciseIds)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      );

    const subSets = setsQuery.observe().subscribe({
      next: async () => {
        try {
          await loadWorkoutData();
        } catch (err) {
          console.error('Error handling sets subscription update:', err);
        }
      },
      error: (err) => {
        console.error('Workout sets subscription error:', err);
      },
    });

    return () => subSets.unsubscribe();
  }, [visible, workoutId, logExerciseIdsKey, loadWorkoutData]);

  return {
    workout,
    isLoading,
    isMenuVisible,
    setIsMenuVisible,
    rawSets,
    reload: loadWorkoutData,
  };
}
