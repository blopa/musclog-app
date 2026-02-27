import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useState } from 'react';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import {
  getEffectiveOrder,
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '../utils/workoutSupersetOrder';

export type WorkoutSessionProgress = {
  totalSets: number;
  completedSets: number;
  currentSetOrder: number | null;
  isComplete: boolean;
};

export type PreviousSetInfo = {
  weight: number;
  reps: number;
  exerciseId: string;
};

/**
 * Centralized hook for workout session state: loads log, sets, exercises,
 * observes sets for live updates, and derives current / next / previous set
 * in superset-effective order.
 *
 * Use this when you need a single source of truth for "what set is next"
 * (e.g. session screen, rest timer). WorkoutService remains for one-off
 * or non-React callers.
 */
export function useWorkoutSessionState(workoutLogId: string | undefined) {
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState<WorkoutLogSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentSet, setCurrentSet] = useState<WorkoutLogSet | null>(null);
  const [nextSet, setNextSet] = useState<WorkoutLogSet | null>(null);
  const [previousSet, setPreviousSet] = useState<PreviousSetInfo | null>(null);
  const [progress, setProgress] = useState<WorkoutSessionProgress>({
    totalSets: 0,
    completedSets: 0,
    currentSetOrder: null,
    isComplete: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkoutData = useCallback(async (logId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const log = await database.get<WorkoutLog>('workout_logs').find(logId);
      if (log.deletedAt) {
        throw new Error('Workout has been deleted');
      }
      setWorkoutLog(log);

      const workoutSets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('workout_log_id', logId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('set_order', Q.asc)
        )
        .fetch();

      setSets(workoutSets);

      const exerciseIds = [...new Set(workoutSets.map((s) => s.exerciseId).filter(Boolean))];
      const exerciseList =
        exerciseIds.length > 0
          ? await database
              .get<Exercise>('exercises')
              .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
              .fetch()
          : [];

      setExercises(exerciseList);

      const completedSets = workoutSets.filter((s) => (s.difficultyLevel ?? 0) > 0).length;
      const skippedSets = workoutSets.filter((s) => s.isSkipped).length;
      const totalSets = workoutSets.length;
      const isComplete = completedSets + skippedSets === totalSets && totalSets > 0;

      const current = getFirstUnloggedInEffectiveOrder(workoutSets);
      const next = current ? getNextSetInEffectiveOrder(workoutSets, current.setOrder ?? 0) : null;

      let prev: PreviousSetInfo | null = null;
      if (current) {
        const effectiveOrder = getEffectiveOrder(workoutSets);
        const currentIdx = effectiveOrder.findIndex((s) => s.id === current.id);
        if (currentIdx > 0) {
          for (let i = currentIdx - 1; i >= 0; i--) {
            const s = effectiveOrder[i];
            if ((s.difficultyLevel ?? 0) > 0) {
              prev = {
                weight: s.weight ?? 0,
                reps: s.reps ?? 0,
                exerciseId: s.exerciseId ?? '',
              };
              break;
            }
          }
        }
      }

      setCurrentSet(current);
      setNextSet(next);
      setPreviousSet(prev);
      setProgress({
        totalSets,
        completedSets,
        currentSetOrder: current?.setOrder ?? null,
        isComplete,
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading workout session data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workout data');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!workoutLogId) {
      setWorkoutLog(null);
      setSets([]);
      setExercises([]);
      setCurrentSet(null);
      setNextSet(null);
      setPreviousSet(null);
      setProgress({ totalSets: 0, completedSets: 0, currentSetOrder: null, isComplete: false });
      setError(null);
      setIsLoading(false);
      return;
    }
    loadWorkoutData(workoutLogId);
  }, [workoutLogId, loadWorkoutData]);

  useEffect(() => {
    if (!workoutLog?.id) {
      return;
    }

    const query = database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLog.id),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      );

    const subscription = query.observe().subscribe({
      next: () => {
        loadWorkoutData(workoutLog.id);
      },
      error: (err) => {
        console.error('Error observing workout sets:', err);
      },
    });

    return () => subscription.unsubscribe();
  }, [workoutLog?.id, loadWorkoutData]);

  const refresh = useCallback(() => {
    if (workoutLogId) {
      loadWorkoutData(workoutLogId);
    }
  }, [workoutLogId, loadWorkoutData]);

  return {
    workoutLog,
    sets,
    exercises,
    currentSet,
    nextSet,
    previousSet,
    progress,
    isLoading,
    error,
    refresh,
  };
}
