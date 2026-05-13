import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ProgressionMode } from '@/constants/settings';
import { database } from '@/database';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { SettingsService, UserMetricService, WorkoutService } from '@/database/services';
import {
  calculateAverage1RM,
  calculateRepsForTargetRIR,
  calculateWeightForTargetRIR,
} from '@/utils/workoutCalculator';
import {
  getEffectiveOrder,
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

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
  isAutoAdjusted?: boolean;
};

/**
 * Centralized hook for workout session state: observes log, exercises, sets
 * via a single reactive pipeline, derives enriched sets and current/next/previous
 * in superset-effective order. No refetch, no debounce.
 */
type WorkoutSessionState = {
  workoutLog: WorkoutLog | null;
  logExercises: WorkoutLogExercise[];
  sets: EnrichedWorkoutLogSet[];
  exercises: Exercise[];
};

export function useWorkoutSessionState(workoutLogId: string | undefined) {
  const [state, setState] = useState<WorkoutSessionState>({
    workoutLog: null,
    logExercises: [],
    sets: [],
    exercises: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bodyWeightKg, setBodyWeightKg] = useState(0);
  const [progressionMode, setProgressionMode] = useState<ProgressionMode>('reps_first');

  useEffect(() => {
    Promise.all([
      UserMetricService.getUserBodyWeightKgForVolume(),
      SettingsService.getProgressionMode(),
    ]).then(([weight, mode]) => {
      setBodyWeightKg(weight);
      setProgressionMode(mode);
    });
  }, []);

  useEffect(() => {
    if (!workoutLogId) {
      setState({ workoutLog: null, logExercises: [], sets: [], exercises: [] });
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
            throw new Error('Workout has been deleted');
          }
          const leMap = logExs.map((le) => ({
            id: le.id,
            exerciseId: le.exerciseId,
            groupId: le.groupId,
            notes: le.notes,
          }));

          const enrichedSets = WorkoutService.buildEnrichedSetsFromRecords(leMap, rawSets);

          return {
            workoutLog: log,
            logExercises: logExs,
            sets: enrichedSets,
            exercises: exerciseList,
          };
        })
      )
      .subscribe({
        next: (payload) => {
          if (payload === null) {
            setState({ workoutLog: null, logExercises: [], sets: [], exercises: [] });
          } else {
            setState(payload);
          }
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

  const { workoutLog, logExercises, sets, exercises } = state;

  const derivedData = useMemo(() => {
    if (!workoutLog || sets.length === 0) {
      return {
        enrichedSets: sets,
        currentSet: null,
        nextSet: null,
        previousSet: null,
        progress: { totalSets: 0, completedSets: 0, currentSetOrder: null, isComplete: false },
      };
    }

    // Intra-session RIR adjustment
    const originalCurrentActive = getFirstUnloggedInEffectiveOrder(sets);
    let enrichedSets = sets;
    let currentActive = originalCurrentActive;

    if (originalCurrentActive) {
      const effectiveOrder = getEffectiveOrder(sets);
      const currentIdx = effectiveOrder.findIndex((s) => s.id === originalCurrentActive.id);
      if (currentIdx > 0) {
        const lastSet = effectiveOrder[currentIdx - 1];
        if (
          (lastSet.difficultyLevel ?? 0) > 0 &&
          !(lastSet.isSkipped ?? false) &&
          lastSet.exerciseId === originalCurrentActive.exerciseId
        ) {
          // Clone the active set to avoid mutation
          const adjustedActive = { ...originalCurrentActive };
          let changed = false;

          // Adjust current set based on lastSet
          const exercise = exercises.find((e) => e.id === lastSet.exerciseId);
          const equipmentType = exercise?.equipmentType;
          const isBodyweight = equipmentType?.toLowerCase().includes('bodyweight');
          const oneRM = calculateAverage1RM(
            lastSet.weight + (isBodyweight ? bodyWeightKg : 0),
            lastSet.reps,
            lastSet.repsInReserve ?? 0
          );

          const targetRIR = adjustedActive.repsInReserve ?? 2;

          // Carry over weight from last set if it differs from current planned weight
          const lastWeight = lastSet.weight ?? 0;
          const currentPlannedWeight = adjustedActive.weight ?? 0;
          if (
            lastWeight > 0 &&
            currentPlannedWeight > 0 &&
            Math.abs(lastWeight - currentPlannedWeight) >= 0.1
          ) {
            adjustedActive.weight = lastWeight;
            changed = true;
          }

          if (progressionMode === 'weight_first') {
            const adjustedWeight = calculateWeightForTargetRIR(
              oneRM,
              adjustedActive.reps,
              targetRIR
            );
            const roundedWeight = Math.round(adjustedWeight);
            if (Math.abs(roundedWeight - (adjustedActive.weight ?? 0)) >= 1) {
              adjustedActive.weight = roundedWeight;
              adjustedActive.isAutoAdjusted = true;
              changed = true;
            }
          } else {
            const adjustedReps = calculateRepsForTargetRIR(
              oneRM,
              isBodyweight
                ? (adjustedActive.weight ?? 0) + bodyWeightKg
                : (adjustedActive.weight ?? 0),
              targetRIR
            );
            if (Math.abs(adjustedReps - (adjustedActive.reps ?? 0)) >= 1) {
              adjustedActive.reps = adjustedReps;
              adjustedActive.isAutoAdjusted = true;
              changed = true;
            }
          }

          if (changed) {
            currentActive = Object.assign(
              Object.create(Object.getPrototypeOf(originalCurrentActive)),
              originalCurrentActive,
              adjustedActive
            );
            enrichedSets = sets.map((s) => (s.id === currentActive!.id ? currentActive! : s));
          }
        }
      }
    }

    const totalSets = enrichedSets.length;
    const completedSets = enrichedSets.filter(
      (s) => (s.difficultyLevel ?? 0) > 0 || (s.isSkipped ?? false)
    ).length;
    const isComplete = totalSets > 0 && completedSets === totalSets;
    const current = currentActive;
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

    return {
      enrichedSets,
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
  }, [workoutLog, sets, exercises, bodyWeightKg, progressionMode]);

  const refresh = useCallback(() => {
    if (!workoutLogId) {
      return;
    }
    WorkoutService.getWorkoutWithDetails(workoutLogId).then(
      ({ workoutLog: log, sets: s, exercises: ex, logExercises: le }) => {
        setState({ workoutLog: log, logExercises: le, sets: s, exercises: ex });
      },
      (err) => {
        console.error('Error refreshing workout:', err);
      }
    );
  }, [workoutLogId]);

  return {
    workoutLog,
    logExercises,
    sets: derivedData.enrichedSets,
    exercises,
    currentSet: derivedData.currentSet,
    nextSet: derivedData.nextSet,
    previousSet: derivedData.previousSet,
    progress: derivedData.progress,
    isLoading,
    error,
    refresh,
  };
}
