import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

  useEffect(() => {
    if (visible && workoutId) {
      loadWorkoutData();
    } else {
      setWorkout(null);
    }
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
