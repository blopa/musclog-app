import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { database } from '../database';
import { WorkoutService } from '../database/services/WorkoutService';
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
    if (!workoutId) return;

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

  // Observe workout_log_sets for reactive updates while modal is visible.
  useEffect(() => {
    if (!visible || !workoutId) {
      setWorkout(null);
      return;
    }

    // Query sets for this workout
    const query = database
      .get('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      );

    const subscription = query.observe().subscribe({
      next: async (sets: any[]) => {
        try {
          setRawSets(sets as any[]);
          // Re-load and transform workout details when sets change
          await loadWorkoutData();
        } catch (err) {
          console.error('Error handling sets subscription update:', err);
        }
      },
      error: (err) => {
        console.error('Workout sets subscription error:', err);
      },
    });

    // Trigger an initial load
    loadWorkoutData();

    return () => subscription.unsubscribe();
  }, [visible, workoutId, loadWorkoutData]);

  return {
    workout,
    isLoading,
    isMenuVisible,
    setIsMenuVisible,
    rawSets,
    reload: loadWorkoutData,
  };
}
