import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogExercise from '../database/models/WorkoutLogExercise';
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

export type EnrichedWorkoutLogSet = WorkoutLogSet & {
  exerciseId: string;
  groupId?: string;
  notes?: string;
};

/**
 * Centralized hook for workout session state: loads log, exercises, sets,
 * observes sets for live updates, and derives current / next / previous set
 * in superset-effective order.
 */
export function useWorkoutSessionState(workoutLogId: string | undefined) {
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [logExercises, setLogExercises] = useState<WorkoutLogExercise[]>([]);
  const [sets, setSets] = useState<EnrichedWorkoutLogSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentSet, setCurrentSet] = useState<EnrichedWorkoutLogSet | null>(null);
  const [nextSet, setNextSet] = useState<EnrichedWorkoutLogSet | null>(null);
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

      const workoutLogExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(
          Q.where('workout_log_id', logId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('exercise_order', Q.asc)
        )
        .fetch();

      setLogExercises(workoutLogExercises);

      const logExerciseIds = workoutLogExercises.map((le) => le.id);
      const workoutSets =
        logExerciseIds.length > 0
          ? await database
              .get<WorkoutLogSet>('workout_log_sets')
              .query(
                Q.where('log_exercise_id', Q.oneOf(logExerciseIds)),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('set_order', Q.asc)
              )
              .fetch()
          : [];

      const logExerciseMap = new Map<
        string,
        { exerciseId: string; groupId?: string; notes?: string }
      >();
      workoutLogExercises.forEach((le) => {
        logExerciseMap.set(le.id, {
          exerciseId: le.exerciseId,
          groupId: le.groupId,
          notes: le.notes,
        });
      });

      // Build plain enriched objects from stored data using _raw so we always read actual DB values
      const enrichedSets: EnrichedWorkoutLogSet[] = workoutSets.map((set) => {
        const logExercise = logExerciseMap.get(set.logExerciseId);
        const r = (set as unknown as { _raw: Record<string, unknown> })._raw;
        return {
          id: set.id,
          logExerciseId: (r.log_exercise_id as string) ?? set.logExerciseId,
          reps: (r.reps as number) ?? 0,
          weight: (r.weight as number) ?? 0,
          partials: (r.partials as number | undefined) ?? set.partials,
          restTimeAfter: (r.rest_time_after as number) ?? 0,
          repsInReserve: (r.reps_in_reserve as number) ?? 0,
          isSkipped: (r.is_skipped as boolean | undefined) ?? set.isSkipped,
          difficultyLevel: (r.difficulty_level as number) ?? 0,
          isDropSet: (r.is_drop_set as boolean) ?? false,
          setOrder: (r.set_order as number) ?? 0,
          createdAt: (r.created_at as number) ?? 0,
          updatedAt: (r.updated_at as number) ?? 0,
          deletedAt: (r.deleted_at as number | undefined) ?? set.deletedAt,
          exerciseId: logExercise?.exerciseId ?? '',
          groupId: logExercise?.groupId,
          notes: logExercise?.notes,
        } as EnrichedWorkoutLogSet;
      });

      setSets(enrichedSets);

      const exerciseIds = [
        ...new Set(workoutLogExercises.map((le) => le.exerciseId).filter(Boolean)),
      ];
      const exerciseList =
        exerciseIds.length > 0
          ? await database
              .get<Exercise>('exercises')
              .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
              .fetch()
          : [];

      setExercises(exerciseList);

      const completedSets = enrichedSets.filter((s) => (s.difficultyLevel ?? 0) > 0).length;
      const skippedSets = enrichedSets.filter((s) => s.isSkipped).length;
      const totalSets = enrichedSets.length;
      const isComplete = completedSets + skippedSets === totalSets && totalSets > 0;

      const current = getFirstUnloggedInEffectiveOrder(enrichedSets);
      const next = current ? getNextSetInEffectiveOrder(enrichedSets, current.setOrder ?? 0) : null;

      let prev: PreviousSetInfo | null = null;
      if (current) {
        const effectiveOrder = getEffectiveOrder(enrichedSets);
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
      setLogExercises([]);
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

  // Stable key so we only re-subscribe when the set of log exercise IDs actually changes,
  // not when loadWorkoutData updates state with a new array reference (which would cause an infinite loop).
  const logExerciseIdsKey = useMemo(
    () =>
      logExercises
        .map((le) => le.id)
        .sort()
        .join(','),
    [logExercises]
  );

  const loadWorkoutDataRef = useRef(loadWorkoutData);
  loadWorkoutDataRef.current = loadWorkoutData;

  useEffect(() => {
    if (!workoutLog?.id || !logExerciseIdsKey) {
      return;
    }

    const logId = workoutLog.id;
    // Derive IDs from the stable key so we don't depend on logExercises (which would cause an infinite loop when loadWorkoutData updates it)
    const logExerciseIds = logExerciseIdsKey.split(',').filter(Boolean);
    const query = database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('log_exercise_id', Q.oneOf(logExerciseIds)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      );

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 350;

    const subscription = query.observe().subscribe({
      next: () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          loadWorkoutDataRef.current(logId);
        }, DEBOUNCE_MS);
      },
      error: (err) => {
        console.error('Error observing workout sets:', err);
      },
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [workoutLog?.id, logExerciseIdsKey]);

  const refresh = useCallback(() => {
    if (workoutLogId) {
      loadWorkoutData(workoutLogId);
    }
  }, [workoutLogId, loadWorkoutData]);

  return {
    workoutLog,
    logExercises,
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
