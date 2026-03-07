import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useState } from 'react';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogExercise from '../database/models/WorkoutLogExercise';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { WorkoutService } from '../database/services';
import {
  getEffectiveOrder,
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '../utils/workoutSupersetOrder';

const WORKOUT_LOG_SET_COLUMNS = [
  'reps',
  'weight',
  'partials',
  'rest_time_after',
  'reps_in_reserve',
  'difficulty_level',
  'is_skipped',
  'is_drop_set',
  'set_order',
  'deleted_at',
] as const;

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
 * Centralized hook for workout session state: observes log, exercises, sets
 * via a single reactive pipeline, derives enriched sets and current/next/previous
 * in superset-effective order. No refetch, no debounce.
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

    const logId = workoutLogId;
    setError(null);
    setIsLoading(true);

    const logQuery = database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('id', logId), Q.where('deleted_at', Q.eq(null)));

    const logExercisesQuery = database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('workout_log_id', logId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('exercise_order', Q.asc)
      );

    const logObs = logQuery.observe().pipe(map((rows) => (rows.length > 0 ? rows[0] : null)));
    const logExercisesObs = logExercisesQuery.observe();
    const setsObs = logExercisesObs.pipe(
      switchMap((les) => {
        const ids = les.map((le) => le.id);
        if (ids.length === 0) {
          return of([]);
        }
        return database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('log_exercise_id', Q.oneOf(ids)),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .observeWithColumns([...WORKOUT_LOG_SET_COLUMNS]);
      })
    );

    const exercisesObs = logExercisesObs.pipe(
      switchMap((les) => {
        const ids = [...new Set(les.map((le) => le.exerciseId).filter(Boolean))];
        if (ids.length === 0) {
          return of([]);
        }
        return database
          .get<Exercise>('exercises')
          .query(Q.where('id', Q.oneOf(ids)), Q.where('deleted_at', Q.eq(null)))
          .observe();
      })
    );

    const subscription = combineLatest([logObs, logExercisesObs, setsObs, exercisesObs])
      .pipe(
        map(([log, logExs, rawSets, exerciseList]) => {
          if (!log) {
            return null;
          }
          if (log.deletedAt) {
            return { error: 'Workout has been deleted' as const };
          }
          const leMap = logExs.map((le) => ({
            id: le.id,
            exerciseId: le.exerciseId,
            groupId: le.groupId,
            notes: le.notes,
          }));

          const enrichedSets = WorkoutService.buildEnrichedSetsFromRecords(leMap, rawSets);
          const completedSets = enrichedSets.filter((s) => (s.difficultyLevel ?? 0) > 0).length;
          const skippedSets = enrichedSets.filter((s) => s.isSkipped).length;
          const totalSets = enrichedSets.length;
          const isComplete = completedSets + skippedSets === totalSets && totalSets > 0;
          const current = getFirstUnloggedInEffectiveOrder(enrichedSets);
          const next = current
            ? getNextSetInEffectiveOrder(enrichedSets, current.setOrder ?? 0)
            : null;
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

          return {
            log,
            logExercises: logExs,
            sets: enrichedSets,
            exercises: exerciseList,
            currentSet: current,
            nextSet: next,
            previousSet: prev,
            progress: {
              totalSets,
              completedSets,
              currentSetOrder: current?.setOrder ?? null,
              isComplete,
            },
          };
        })
      )
      .subscribe({
        next: (payload) => {
          if (payload === null) {
            setWorkoutLog(null);
            setLogExercises([]);
            setSets([]);
            setExercises([]);
            setCurrentSet(null);
            setNextSet(null);
            setPreviousSet(null);
            setProgress({
              totalSets: 0,
              completedSets: 0,
              currentSetOrder: null,
              isComplete: false,
            });
            setIsLoading(false);
            return;
          }

          if ('error' in payload) {
            setError(payload.error || '');
            setIsLoading(false);
            return;
          }

          setWorkoutLog(payload.log);
          setLogExercises(payload.logExercises);
          setSets(payload.sets);
          setExercises(payload.exercises);
          setCurrentSet(payload.currentSet);
          setNextSet(payload.nextSet);
          setPreviousSet(payload.previousSet);
          setProgress(payload.progress);
          setError(null);
          setIsLoading(false);
        },
        error: (err) => {
          console.error('Error in workout session pipeline:', err);
          setError(err instanceof Error ? err.message : 'Failed to load workout data');
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [workoutLogId]);

  const refresh = useCallback(() => {
    if (!workoutLogId) {
      return;
    }
    WorkoutService.getWorkoutWithDetails(workoutLogId).then(
      ({ workoutLog: log, sets: s, exercises: ex, logExercises: le }) => {
        setWorkoutLog(log);
        setLogExercises(le);
        setSets(s);
        setExercises(ex);
        const completedSets = s.filter((x) => (x.difficultyLevel ?? 0) > 0).length;
        const skippedSets = s.filter((x) => x.isSkipped).length;
        const totalSets = s.length;
        const isComplete = completedSets + skippedSets === totalSets && totalSets > 0;
        const current = getFirstUnloggedInEffectiveOrder(s);
        const next = current ? getNextSetInEffectiveOrder(s, current.setOrder ?? 0) : null;
        let prev: PreviousSetInfo | null = null;
        if (current) {
          const effectiveOrder = getEffectiveOrder(s);
          const currentIdx = effectiveOrder.findIndex((x) => x.id === current.id);
          if (currentIdx > 0) {
            for (let i = currentIdx - 1; i >= 0; i--) {
              const set = effectiveOrder[i];
              if ((set.difficultyLevel ?? 0) > 0) {
                prev = {
                  weight: set.weight ?? 0,
                  reps: set.reps ?? 0,
                  exerciseId: set.exerciseId ?? '',
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
      },
      (err) => {
        console.error('Error refreshing workout:', err);
      }
    );
  }, [workoutLogId]);

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
