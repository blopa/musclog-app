import { useCallback, useEffect, useMemo, useState } from 'react';

import Exercise from '@/database/models/Exercise';
import { WorkoutService } from '@/database/services';
import { captureException } from '@/utils/sentry';
import {
  getEffectiveOrder,
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

import { type EnrichedWorkoutLogSet, useWorkoutSessionState } from './useWorkoutSessionState';

export type CurrentSetData = {
  set: EnrichedWorkoutLogSet;
  exercise: Exercise;
  setNumber: number;
  totalSetsInExercise: number;
  exerciseNumber: number;
  notes?: string;
  previousSet?: {
    weight: number;
    reps: number;
    exerciseId: string;
  };
  nextSet?: {
    set: EnrichedWorkoutLogSet;
    exercise: Exercise;
  };
};

export type WorkoutProgress = {
  totalSets: number;
  completedSets: number;
  currentSetOrder: number | null;
  isComplete: boolean;
};

export function useActiveWorkout(workoutLogId?: string) {
  const [resolvedLogId, setResolvedLogId] = useState<string | null | undefined>(undefined);
  const [targetExerciseId, setTargetExerciseId] = useState<string | null>(null);
  const [noActiveError, setNoActiveError] = useState<string | null>(null);

  const effectiveLogId = workoutLogId ?? resolvedLogId ?? undefined;
  const sessionState = useWorkoutSessionState(effectiveLogId);

  const {
    workoutLog,
    sets,
    exercises,
    currentSet: sessionCurrentSet,
    nextSet: sessionNextSet,
    previousSet: sessionPreviousSet,
    progress: sessionProgress,
    isLoading: sessionLoading,
    error: sessionError,
    refresh,
  } = sessionState;

  // Resolve active workout when no workoutLogId provided
  useEffect(() => {
    if (workoutLogId) {
      setResolvedLogId(workoutLogId);
      setNoActiveError(null);
      return;
    }

    setNoActiveError(null);
    WorkoutService.getActiveWorkout()
      .then((active) => {
        setResolvedLogId(active?.id ?? null);
        if (!active) {
          setNoActiveError('No active workout found');
        }
      })
      .catch((err) => {
        console.error('Error getting active workout:', err);
        captureException(err);
        setResolvedLogId(null);
        setNoActiveError(err instanceof Error ? err.message : 'Failed to get active workout');
      });
  }, [workoutLogId]);

  const isLoading =
    workoutLogId !== undefined
      ? sessionLoading
      : resolvedLogId === undefined
        ? true
        : sessionLoading;
  const error = sessionError ?? noActiveError;

  const currentSetData = useMemo((): CurrentSetData | null => {
    if (!sets.length || !exercises.length) {
      return null;
    }

    const effectiveOrder = getEffectiveOrder(sets);
    let currentSet: EnrichedWorkoutLogSet | null = null;

    if (targetExerciseId) {
      currentSet =
        effectiveOrder.find(
          (s) =>
            s.exerciseId === targetExerciseId &&
            (s.difficultyLevel ?? 0) === 0 &&
            !(s.isSkipped ?? false)
        ) ?? null;
    }
    if (!currentSet) {
      currentSet = getFirstUnloggedInEffectiveOrder(sets);
    }

    if (!currentSet) {
      return null;
    }

    const exerciseMap = new Map<string, Exercise>();
    exercises.forEach((ex) => exerciseMap.set(ex.id, ex));
    const currentExercise = exerciseMap.get(currentSet.exerciseId ?? '');
    if (!currentExercise) {
      return null;
    }

    const exerciseGroups = new Map<string, EnrichedWorkoutLogSet[]>();
    sets.forEach((s) => {
      const eid = s.exerciseId ?? '';
      if (!exerciseGroups.has(eid)) {
        exerciseGroups.set(eid, []);
      }
      exerciseGroups.get(eid)!.push(s);
    });
    exerciseGroups.forEach((exerciseSets) => {
      exerciseSets.sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));
    });

    const currentExerciseSets = exerciseGroups.get(currentSet.exerciseId ?? '') ?? [];
    const setNumber = currentExerciseSets.findIndex((s) => s.id === currentSet!.id) + 1 || 1;
    const totalSetsInExercise = currentExerciseSets.length;

    const exerciseOrder = [...new Set(effectiveOrder.map((s) => s.exerciseId).filter(Boolean))];
    const exerciseNumber =
      exerciseOrder.indexOf(currentSet.exerciseId ?? '') >= 0
        ? exerciseOrder.indexOf(currentSet.exerciseId ?? '') + 1
        : 1;

    let nextSetData: CurrentSetData['nextSet'] | undefined;
    const next = getNextSetInEffectiveOrder(sets, currentSet.setOrder ?? 0);
    if (next) {
      const nextExercise = exerciseMap.get(next.exerciseId ?? '');
      if (nextExercise) {
        nextSetData = { set: next, exercise: nextExercise };
      }
    }

    return {
      set: currentSet,
      exercise: currentExercise,
      setNumber,
      totalSetsInExercise,
      exerciseNumber,
      notes: currentSet.notes,
      previousSet: sessionPreviousSet ?? undefined,
      nextSet: nextSetData,
    };
  }, [sets, exercises, targetExerciseId, sessionPreviousSet]);

  const progress: WorkoutProgress = useMemo(
    () => ({
      totalSets: sessionProgress.totalSets,
      completedSets: sessionProgress.completedSets,
      currentSetOrder: sessionProgress.currentSetOrder,
      isComplete: sessionProgress.isComplete,
    }),
    [sessionProgress]
  );

  const getCurrentSet = useCallback((): CurrentSetData | null => currentSetData, [currentSetData]);
  const getNextSet = useCallback(
    (): CurrentSetData['nextSet'] | null => currentSetData?.nextSet ?? null,
    [currentSetData]
  );
  const isWorkoutComplete = useCallback(() => progress.isComplete, [progress.isComplete]);
  const setCurrentExercise = useCallback((exerciseId: string | null) => {
    setTargetExerciseId(exerciseId);
  }, []);
  const getExerciseSets = useCallback(
    (exerciseId: string): EnrichedWorkoutLogSet[] =>
      sets.filter((s) => s.exerciseId === exerciseId),
    [sets]
  );

  return {
    workoutLog: workoutLog ?? null,
    sets,
    exercises,
    currentSetData,
    progress,
    isLoading,
    error,
    getCurrentSet,
    getNextSet,
    isWorkoutComplete,
    getExerciseSets,
    setCurrentExercise,
    refresh,
  };
}
