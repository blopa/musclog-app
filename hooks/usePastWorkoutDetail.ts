import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { combineLatest, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { database } from '../database';
import Exercise from '../database/models/Exercise';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogExercise from '../database/models/WorkoutLogExercise';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import { EnrichedWorkoutLogSet, WorkoutService } from '../database/services';
import { transformWorkoutToDetailData, type WorkoutDetailData } from '../utils/workoutDetail';
import { useSettings } from './useSettings';

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

export interface UsePastWorkoutDetailParams {
  visible: boolean;
  workoutId?: string;
}

export function usePastWorkoutDetail({ visible, workoutId }: UsePastWorkoutDetailParams) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [workout, setWorkout] = useState<WorkoutDetailData | null>(null);
  const [rawSets, setRawSets] = useState<EnrichedWorkoutLogSet[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!visible || !workoutId) {
      setWorkout(null);
      setRawSets(null);
      setIsLoading(false);
      return;
    }

    const id = workoutId;
    setIsLoading(true);

    const logQuery = database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('id', id), Q.where('deleted_at', Q.eq(null)));

    const logExercisesQuery = database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('workout_log_id', id),
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
        switchMap(([log, logExs, rawSetsArr, exercises]) => {
          if (!log || log.deletedAt) {
            return of({ transformed: null, rawSets: null });
          }
          const leMap = logExs.map((le) => ({
            id: le.id,
            exerciseId: le.exerciseId,
            groupId: le.groupId,
            notes: le.notes,
          }));
          const enrichedSets = WorkoutService.buildEnrichedSetsFromRecords(leMap, rawSetsArr);
          return from(transformWorkoutToDetailData(log, enrichedSets, exercises, t, units)).pipe(
            map((transformed) => ({ transformed, rawSets: enrichedSets })),
            catchError((err) => {
              console.error('Error transforming workout detail:', err);
              return of({ transformed: null, rawSets: null });
            })
          );
        })
      )
      .subscribe({
        next: ({ transformed, rawSets: sets }) => {
          setWorkout(transformed);
          setRawSets(sets);
          setIsLoading(false);
        },
        error: (err) => {
          console.error('Past workout detail pipeline error:', err);
          setWorkout(null);
          setRawSets(null);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, [visible, workoutId, t, units]);

  const reload = () => {
    if (!workoutId) {
      return;
    }

    setWorkout(null);
    setRawSets(null);
    setIsLoading(true);
    WorkoutService.getWorkoutWithDetails(workoutId)
      .then(({ workoutLog: log, sets: s, exercises: ex }) => {
        setRawSets(s);
        return transformWorkoutToDetailData(log, s, ex, t, units);
      })
      .then(setWorkout)
      .catch((err) => {
        console.error('Error reloading workout details:', err);
        setWorkout(null);
      })
      .finally(() => setIsLoading(false));
  };

  return {
    workout,
    isLoading,
    isMenuVisible,
    setIsMenuVisible,
    rawSets,
    reload,
  };
}
