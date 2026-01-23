import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import WorkoutLog from '../database/models/WorkoutLog';
import WorkoutLogSet from '../database/models/WorkoutLogSet';
import Exercise from '../database/models/Exercise';
import { WorkoutService } from '../database/services/WorkoutService';

export type CurrentSetData = {
  set: WorkoutLogSet;
  exercise: Exercise;
  setNumber: number; // Set number within exercise (1, 2, 3...)
  totalSetsInExercise: number;
  exerciseNumber: number; // Exercise number in workout (1, 2, 3...)
  previousSet?: {
    weight: number;
    reps: number;
    exerciseId: string;
  };
  nextSet?: {
    set: WorkoutLogSet;
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
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [sets, setSets] = useState<WorkoutLogSet[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentSetData, setCurrentSetData] = useState<CurrentSetData | null>(null);
  const [progress, setProgress] = useState<WorkoutProgress>({
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

      // Load workout log
      const log = await database.get<WorkoutLog>('workout_logs').find(logId);
      if (log.deletedAt) {
        throw new Error('Workout has been deleted');
      }
      setWorkoutLog(log);

      // Load all sets ordered by set_order
      const workoutSets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('workout_log_id', logId),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('set_order', Q.asc)
        )
        .fetch();

      setSets(workoutSets);

      // Load exercise details
      const exerciseIds = [...new Set(workoutSets.map((set) => set.exerciseId))];
      const exerciseList =
        exerciseIds.length > 0
          ? await database
              .get<Exercise>('exercises')
              .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
              .fetch()
          : [];

      setExercises(exerciseList);

      // Create exercise map for quick lookup
      const exerciseMap = new Map<string, Exercise>();
      exerciseList.forEach((ex) => exerciseMap.set(ex.id, ex));

      // Find current set (first set with difficultyLevel === 0)
      const currentSet = workoutSets.find((set) => set.difficultyLevel === 0);

      // Calculate progress
      const completedSets = workoutSets.filter((set) => set.difficultyLevel > 0).length;
      const totalSets = workoutSets.length;
      const isComplete = currentSet === undefined && totalSets > 0;

      setProgress({
        totalSets,
        completedSets,
        currentSetOrder: currentSet?.setOrder ?? null,
        isComplete,
      });

      // If no current set and workout is complete, set currentSetData to null
      if (!currentSet) {
        setCurrentSetData(null);
        setIsLoading(false);
        return;
      }

      // Group sets by exercise to calculate set numbers
      const exerciseGroups = new Map<string, WorkoutLogSet[]>();
      workoutSets.forEach((set) => {
        if (!exerciseGroups.has(set.exerciseId)) {
          exerciseGroups.set(set.exerciseId, []);
        }
        exerciseGroups.get(set.exerciseId)!.push(set);
      });

      // Sort sets within each exercise by set_order
      exerciseGroups.forEach((exerciseSets) => {
        exerciseSets.sort((a, b) => a.setOrder - b.setOrder);
      });

      // Find current exercise and calculate set number
      const currentExercise = exerciseMap.get(currentSet.exerciseId);
      if (!currentExercise) {
        throw new Error(`Exercise not found for set: ${currentSet.exerciseId}`);
      }

      const currentExerciseSets = exerciseGroups.get(currentSet.exerciseId) || [];
      const setNumber = currentExerciseSets.findIndex((s) => s.id === currentSet.id) + 1;
      const totalSetsInExercise = currentExerciseSets.length;

      // Calculate exercise number (order of first appearance in workout)
      const exerciseOrder = Array.from(exerciseGroups.keys());
      const exerciseNumber = exerciseOrder.indexOf(currentSet.exerciseId) + 1;

      // Find previous set (last completed set before current set)
      let previousSet: CurrentSetData['previousSet'] | undefined;
      const previousSets = workoutSets.filter(
        (set) => set.setOrder < currentSet.setOrder && set.difficultyLevel > 0
      );
      if (previousSets.length > 0) {
        const lastPreviousSet = previousSets[previousSets.length - 1];
        previousSet = {
          weight: lastPreviousSet.weight,
          reps: lastPreviousSet.reps,
          exerciseId: lastPreviousSet.exerciseId,
        };
      }

      // Find next set
      const nextSet = workoutSets.find(
        (set) => set.setOrder > currentSet.setOrder && set.difficultyLevel === 0
      );
      let nextSetData: CurrentSetData['nextSet'] | undefined;
      if (nextSet) {
        const nextExercise = exerciseMap.get(nextSet.exerciseId);
        if (nextExercise) {
          nextSetData = {
            set: nextSet,
            exercise: nextExercise,
          };
        }
      }

      setCurrentSetData({
        set: currentSet,
        exercise: currentExercise,
        setNumber,
        totalSetsInExercise,
        exerciseNumber,
        previousSet,
        nextSet: nextSetData,
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading workout data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workout data');
      setIsLoading(false);
    }
  }, []);

  // Load workout on mount or when workoutLogId changes
  useEffect(() => {
    if (workoutLogId) {
      loadWorkoutData(workoutLogId);
    } else {
      // Try to get active workout
      WorkoutService.getActiveWorkout()
        .then((activeWorkout) => {
          if (activeWorkout) {
            loadWorkoutData(activeWorkout.id);
          } else {
            setError('No active workout found');
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.error('Error getting active workout:', err);
          setError(err instanceof Error ? err.message : 'Failed to get active workout');
          setIsLoading(false);
        });
    }
  }, [workoutLogId, loadWorkoutData]);

  // Observe sets for real-time updates
  useEffect(() => {
    if (!workoutLog?.id) return;

    const query = database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLog.id),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      );

    const subscription = query.observe().subscribe({
      next: async (updatedSets) => {
        setSets(updatedSets);
        // Reload current set data when sets change
        await loadWorkoutData(workoutLog.id);
      },
      error: (err) => {
        console.error('Error observing sets:', err);
      },
    });

    return () => subscription.unsubscribe();
  }, [workoutLog?.id, loadWorkoutData]);

  const getCurrentSet = useCallback((): CurrentSetData | null => {
    return currentSetData;
  }, [currentSetData]);

  const getNextSet = useCallback((): CurrentSetData['nextSet'] | null => {
    return currentSetData?.nextSet ?? null;
  }, [currentSetData]);

  const isWorkoutComplete = useCallback((): boolean => {
    return progress.isComplete;
  }, [progress.isComplete]);

  const getExerciseSets = useCallback(
    (exerciseId: string): WorkoutLogSet[] => {
      return sets.filter((set) => set.exerciseId === exerciseId);
    },
    [sets]
  );

  const refresh = useCallback(() => {
    if (workoutLog) {
      loadWorkoutData(workoutLog.id);
    }
  }, [workoutLog, loadWorkoutData]);

  return {
    workoutLog,
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
    refresh,
  };
}
