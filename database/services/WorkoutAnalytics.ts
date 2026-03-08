import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Exercise from '../models/Exercise';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogExercise from '../models/WorkoutLogExercise';
import WorkoutLogSet from '../models/WorkoutLogSet';

type EnrichedSet = WorkoutLogSet & {
  exerciseId: string;
  workoutLogId: string;
};

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  previousBest: {
    weight: number;
    reps: number;
    volume: number;
    date: number;
  };
  newRecord: {
    weight: number;
    reps: number;
    volume: number;
  };
  type: 'weight' | 'reps' | 'volume' | 'estimated1RM';
}

export interface ProgressiveOverloadDataPoint {
  date: number;
  weight: number;
  reps: number;
  volume: number;
  estimated1RM: number;
}

export interface MuscleGroupVolume {
  muscleGroup: string;
  totalVolume: number;
  exerciseCount: number;
}

export class WorkoutAnalytics {
  /**
   * Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
   */
  static calculateEstimated1RM(weight: number, reps: number): number {
    if (reps === 0) {
      return 0;
    }
    return weight * (1 + reps / 30);
  }

  /**
   * Get enriched sets for a workout log (sets with exerciseId and workoutLogId denormalized)
   */
  private static async getEnrichedSetsForWorkout(workoutLog: WorkoutLog): Promise<EnrichedSet[]> {
    const logExercises = await workoutLog.logExercises.fetch();
    const activeExercises = logExercises.filter((le) => !le.deletedAt);

    if (activeExercises.length === 0) {
      return [];
    }

    const logExerciseIds = activeExercises.map((le) => le.id);
    const rawSets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(logExerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const logExerciseMap = new Map<string, { exerciseId: string; workoutLogId: string }>();
    activeExercises.forEach((le) => {
      logExerciseMap.set(le.id, { exerciseId: le.exerciseId, workoutLogId: le.workoutLogId });
    });

    // Build plain objects from _raw so we always read actual DB values
    return rawSets.map((set) => {
      const data = logExerciseMap.get(set.logExerciseId);
      const r = (set as unknown as { _raw: Record<string, unknown> })._raw;
      return {
        id: set.id,
        logExerciseId: (r.log_exercise_id as string) ?? set.logExerciseId,
        reps: (r.reps as number) ?? 0,
        weight: (r.weight as number) ?? 0,
        partials: r.partials as number | undefined,
        restTimeAfter: (r.rest_time_after as number) ?? 0,
        repsInReserve: (r.reps_in_reserve as number) ?? 0,
        isSkipped: r.is_skipped as boolean | undefined,
        difficultyLevel: (r.difficulty_level as number) ?? 0,
        isDropSet: (r.is_drop_set as boolean) ?? false,
        setOrder: (r.set_order as number) ?? 0,
        createdAt: (r.created_at as number) ?? 0,
        updatedAt: (r.updated_at as number) ?? 0,
        deletedAt: r.deleted_at as number | undefined,
        exerciseId: data?.exerciseId ?? '',
        workoutLogId: data?.workoutLogId ?? '',
      } as EnrichedSet;
    });
  }

  /**
   * Get all historical enriched sets for an exercise (excluding a specific workout)
   */
  private static async getHistoricalSetsForExercise(
    exerciseId: string,
    excludeWorkoutId: string
  ): Promise<EnrichedSet[]> {
    const logExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('workout_log_id', Q.notEq(excludeWorkoutId)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    if (logExercises.length === 0) {
      return [];
    }

    const logExerciseIds = logExercises.map((le) => le.id);
    const rawSets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(logExerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const logExerciseMap = new Map<string, { exerciseId: string; workoutLogId: string }>();
    logExercises.forEach((le) => {
      logExerciseMap.set(le.id, { exerciseId: le.exerciseId, workoutLogId: le.workoutLogId });
    });

    // Build plain objects from _raw so we always read actual DB values
    return rawSets.map((set) => {
      const data = logExerciseMap.get(set.logExerciseId);
      const r = (set as unknown as { _raw: Record<string, unknown> })._raw;
      return {
        id: set.id,
        logExerciseId: (r.log_exercise_id as string) ?? set.logExerciseId,
        reps: (r.reps as number) ?? 0,
        weight: (r.weight as number) ?? 0,
        partials: r.partials as number | undefined,
        restTimeAfter: (r.rest_time_after as number) ?? 0,
        repsInReserve: (r.reps_in_reserve as number) ?? 0,
        isSkipped: r.is_skipped as boolean | undefined,
        difficultyLevel: (r.difficulty_level as number) ?? 0,
        isDropSet: (r.is_drop_set as boolean) ?? false,
        setOrder: (r.set_order as number) ?? 0,
        createdAt: (r.created_at as number) ?? 0,
        updatedAt: (r.updated_at as number) ?? 0,
        deletedAt: r.deleted_at as number | undefined,
        exerciseId: data?.exerciseId ?? '',
        workoutLogId: data?.workoutLogId ?? '',
      } as EnrichedSet;
    });
  }

  /**
   * Detect personal records in a completed workout log
   */
  static async detectPersonalRecords(workoutLog: WorkoutLog): Promise<PersonalRecord[]> {
    const records: PersonalRecord[] = [];
    const sets = await this.getEnrichedSetsForWorkout(workoutLog);

    // Group sets by exercise
    const exerciseSets = new Map<string, EnrichedSet[]>();
    for (const set of sets) {
      const exerciseId = set.exerciseId ?? '';
      if (!exerciseSets.has(exerciseId)) {
        exerciseSets.set(exerciseId, []);
      }
      exerciseSets.get(exerciseId)!.push(set);
    }

    // Check for PRs in each exercise
    for (const [exerciseId, logSets] of exerciseSets.entries()) {
      // Get the best set from current workout (highest weight × reps)
      const bestSet = logSets.reduce((best, current) => {
        const currentVolume = (current.weight ?? 0) * (current.reps ?? 0);
        const bestVolume = (best.weight ?? 0) * (best.reps ?? 0);
        return currentVolume > bestVolume ? current : best;
      });

      // Get all historical sets for this exercise (excluding current workout)
      const historicalSets = await this.getHistoricalSetsForExercise(exerciseId, workoutLog.id);

      // Get historical sets only from completed workouts
      const uniqueWorkoutIds = [...new Set(historicalSets.map((s) => s.workoutLogId ?? ''))].filter(
        Boolean
      );
      const completedWorkoutIds = new Set(
        uniqueWorkoutIds.length > 0
          ? (
              await database
                .get<WorkoutLog>('workout_logs')
                .query(
                  Q.where('completed_at', Q.notEq(null)),
                  Q.where('id', Q.oneOf(uniqueWorkoutIds))
                )
                .fetch()
            ).map((log) => log.id)
          : []
      );

      const validHistoricalSets = historicalSets.filter((s) =>
        completedWorkoutIds.has(s.workoutLogId ?? '')
      );

      if (validHistoricalSets.length === 0) {
        // First time doing this exercise - it's a PR by default
        try {
          const exercise = await database.get<Exercise>('exercises').find(exerciseId);
          records.push({
            exerciseId,
            exerciseName: exercise.name ?? '',
            previousBest: {
              weight: 0,
              reps: 0,
              volume: 0,
              date: 0,
            },
            newRecord: {
              weight: bestSet.weight ?? 0,
              reps: bestSet.reps ?? 0,
              volume: (bestSet.weight ?? 0) * (bestSet.reps ?? 0),
            },
            type: 'volume',
          });
        } catch (error) {
          // Exercise not found, skip
          continue;
        }
        continue;
      }

      // Find best historical performance
      const bestHistorical = validHistoricalSets.reduce((best, current) => {
        const currentVolume = (current.weight ?? 0) * (current.reps ?? 0);
        const bestVolume = (best.weight ?? 0) * (best.reps ?? 0);
        return currentVolume > bestVolume ? current : best;
      });

      const bestHistoricalVolume = (bestHistorical.weight ?? 0) * (bestHistorical.reps ?? 0);
      const bestHistoricalWeight = Math.max(...validHistoricalSets.map((s) => s.weight ?? 0));
      const bestHistoricalReps = Math.max(...validHistoricalSets.map((s) => s.reps ?? 0));
      const bestHistorical1RM = Math.max(
        ...validHistoricalSets.map((s) => this.calculateEstimated1RM(s.weight ?? 0, s.reps ?? 0))
      );

      const currentVolume = (bestSet.weight ?? 0) * (bestSet.reps ?? 0);
      const current1RM = this.calculateEstimated1RM(bestSet.weight ?? 0, bestSet.reps ?? 0);

      // Get the workout date for the best historical
      try {
        const historicalWorkout = await database
          .get<WorkoutLog>('workout_logs')
          .find(bestHistorical.workoutLogId ?? '');
        const exercise = await database.get<Exercise>('exercises').find(exerciseId);

        // Check for volume PR
        if (currentVolume > bestHistoricalVolume) {
          records.push({
            exerciseId,
            exerciseName: exercise.name ?? '',
            previousBest: {
              weight: bestHistorical.weight ?? 0,
              reps: bestHistorical.reps ?? 0,
              volume: bestHistoricalVolume,
              date: historicalWorkout.startedAt ?? 0,
            },
            newRecord: {
              weight: bestSet.weight ?? 0,
              reps: bestSet.reps ?? 0,
              volume: currentVolume,
            },
            type: 'volume',
          });
        }

        // Check for weight PR
        if ((bestSet.weight ?? 0) > bestHistoricalWeight) {
          records.push({
            exerciseId,
            exerciseName: exercise.name ?? '',
            previousBest: {
              weight: bestHistoricalWeight,
              reps: 0,
              volume: 0,
              date: historicalWorkout.startedAt ?? 0,
            },
            newRecord: {
              weight: bestSet.weight ?? 0,
              reps: bestSet.reps ?? 0,
              volume: currentVolume,
            },
            type: 'weight',
          });
        }

        // Check for reps PR
        if ((bestSet.reps ?? 0) > bestHistoricalReps) {
          records.push({
            exerciseId,
            exerciseName: exercise.name ?? '',
            previousBest: {
              weight: 0,
              reps: bestHistoricalReps,
              volume: 0,
              date: historicalWorkout.startedAt ?? 0,
            },
            newRecord: {
              weight: bestSet.weight ?? 0,
              reps: bestSet.reps ?? 0,
              volume: currentVolume,
            },
            type: 'reps',
          });
        }

        // Check for estimated 1RM PR
        if (current1RM > bestHistorical1RM) {
          records.push({
            exerciseId,
            exerciseName: exercise.name ?? '',
            previousBest: {
              weight: 0,
              reps: 0,
              volume: 0,
              date: historicalWorkout.startedAt ?? 0,
            },
            newRecord: {
              weight: bestSet.weight ?? 0,
              reps: bestSet.reps ?? 0,
              volume: currentVolume,
            },
            type: 'estimated1RM',
          });
        }
      } catch (error) {
        // Skip if workout or exercise not found
        continue;
      }
    }

    return records;
  }

  /**
   * Get progressive overload data for an exercise over time
   */
  static async getProgressiveOverloadData(
    exerciseId: string,
    timeframe?: { startDate: number; endDate: number }
  ): Promise<ProgressiveOverloadDataPoint[]> {
    // First get all log exercises for this exercise
    const logExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (logExercises.length === 0) {
      return [];
    }

    // Get all sets for these log exercises
    const logExerciseIds = logExercises.map((le) => le.id);
    const rawSets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(logExerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Create a map to get workoutLogId from logExerciseId
    const logExerciseMap = new Map<string, string>();
    logExercises.forEach((le) => {
      logExerciseMap.set(le.id, le.workoutLogId);
    });

    // Build plain objects from _raw so we always read actual DB values
    const sets = rawSets.map((set) => {
      const r = (set as unknown as { _raw: Record<string, unknown> })._raw;
      return {
        id: set.id,
        logExerciseId: (r.log_exercise_id as string) ?? set.logExerciseId,
        reps: (r.reps as number) ?? 0,
        weight: (r.weight as number) ?? 0,
        partials: r.partials as number | undefined,
        restTimeAfter: (r.rest_time_after as number) ?? 0,
        repsInReserve: (r.reps_in_reserve as number) ?? 0,
        isSkipped: r.is_skipped as boolean | undefined,
        difficultyLevel: (r.difficulty_level as number) ?? 0,
        isDropSet: (r.is_drop_set as boolean) ?? false,
        setOrder: (r.set_order as number) ?? 0,
        createdAt: (r.created_at as number) ?? 0,
        updatedAt: (r.updated_at as number) ?? 0,
        deletedAt: r.deleted_at as number | undefined,
        workoutLogId: logExerciseMap.get(set.logExerciseId) ?? '',
      };
    });

    // Filter by timeframe if provided
    let validSets = sets;
    if (timeframe) {
      const workoutIds = new Set(
        (
          await database
            .get<WorkoutLog>('workout_logs')
            .query(
              Q.where('started_at', Q.gte(timeframe.startDate)),
              Q.where('started_at', Q.lte(timeframe.endDate)),
              Q.where('completed_at', Q.notEq(null))
            )
            .fetch()
        ).map((log) => log.id)
      );
      validSets = sets.filter((s) => workoutIds.has(s.workoutLogId ?? ''));
    } else {
      // Only include sets from completed workouts
      const completedWorkoutIds = new Set(
        (
          await database
            .get<WorkoutLog>('workout_logs')
            .query(Q.where('completed_at', Q.notEq(null)))
            .fetch()
        ).map((log) => log.id)
      );
      validSets = sets.filter((s) => completedWorkoutIds.has(s.workoutLogId ?? ''));
    }

    // Group by workout and get best set per workout
    const workoutData = new Map<string, (typeof sets)[0]>();

    for (const set of validSets) {
      const workoutLogId = set.workoutLogId ?? '';
      const existing = workoutData.get(workoutLogId);
      if (
        !existing ||
        (set.weight ?? 0) * (set.reps ?? 0) > (existing.weight ?? 0) * (existing.reps ?? 0)
      ) {
        workoutData.set(workoutLogId, set);
      }
    }

    // Convert to data points with dates
    const dataPoints: ProgressiveOverloadDataPoint[] = [];

    for (const [workoutId, set] of workoutData.entries()) {
      try {
        const workout = await database.get<WorkoutLog>('workout_logs').find(workoutId);
        dataPoints.push({
          date: workout.startedAt ?? 0,
          weight: set.weight ?? 0,
          reps: set.reps ?? 0,
          volume: (set.weight ?? 0) * (set.reps ?? 0),
          estimated1RM: this.calculateEstimated1RM(set.weight ?? 0, set.reps ?? 0),
        });
      } catch (error) {
        // Skip if workout not found
        continue;
      }
    }

    // Sort by date
    return dataPoints.sort((a, b) => a.date - b.date);
  }

  /**
   * Calculate total volume per muscle group for a set of workouts
   */
  static async calculateMuscleGroupVolume(
    workoutLogs: WorkoutLog[],
    timeframe?: { startDate: number; endDate: number }
  ): Promise<MuscleGroupVolume[]> {
    const muscleGroupVolume = new Map<string, { volume: number; exercises: Set<string> }>();

    // Filter workouts by timeframe if provided
    let validWorkouts = workoutLogs;
    if (timeframe) {
      validWorkouts = workoutLogs.filter(
        (log) =>
          (log.startedAt ?? 0) >= timeframe.startDate && (log.startedAt ?? 0) <= timeframe.endDate
      );
    }

    // Process each workout
    for (const workout of validWorkouts) {
      const sets = await this.getEnrichedSetsForWorkout(workout);

      for (const set of sets) {
        try {
          const exercise = await database.get<Exercise>('exercises').find(set.exerciseId ?? '');
          const volume = (set.reps ?? 0) * (set.weight ?? 0);
          const muscleGroup = exercise.muscleGroup ?? '';

          if (!muscleGroupVolume.has(muscleGroup)) {
            muscleGroupVolume.set(muscleGroup, { volume: 0, exercises: new Set() });
          }

          const groupData = muscleGroupVolume.get(muscleGroup)!;
          groupData.volume += volume;
          groupData.exercises.add(set.exerciseId ?? '');
        } catch (error) {
          // Skip if exercise not found
          continue;
        }
      }
    }

    // Convert to array
    return Array.from(muscleGroupVolume.entries()).map(([muscleGroup, data]) => ({
      muscleGroup,
      totalVolume: data.volume,
      exerciseCount: data.exercises.size,
    }));
  }

  /**
   * Get personal best weight for an exercise (from completed workout logs).
   * Returns the highest weight ever logged for that exercise, or null if none.
   */
  static async getPersonalBestForExercise(
    exerciseId: string
  ): Promise<{ weight: number; unit: string } | null> {
    const dataPoints = await this.getProgressiveOverloadData(exerciseId);
    if (dataPoints.length === 0) {
      return null;
    }

    const best = dataPoints.reduce((max, dp) => (dp.weight > max.weight ? dp : max), dataPoints[0]);
    return { weight: Math.round(best.weight * 10) / 10, unit: 'KG' }; // TODO: use i18n and get units from settings
  }

  /**
   * Get average frequency (times per week) an exercise was performed over the last N weeks.
   */
  static async getAverageFrequencyPerWeek(
    exerciseId: string,
    weeks: number = 12
  ): Promise<{ value: number; unit: string }> {
    const logExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    if (logExercises.length === 0) {
      return { value: 0, unit: 'x / wk' }; // TODO: use i18n
    }

    const workoutLogIds = [...new Set(logExercises.map((le) => le.workoutLogId))];
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;

    const completedLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('id', Q.oneOf(workoutLogIds)),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('completed_at', Q.gte(cutoff))
      )
      .fetch();

    const uniqueWorkoutsPerWeek = new Map<number, Set<string>>();
    for (const log of completedLogs) {
      const completedAt = log.completedAt ?? 0;
      const weekStart =
        Math.floor(completedAt / (7 * 24 * 60 * 60 * 1000)) * (7 * 24 * 60 * 60 * 1000);
      if (!uniqueWorkoutsPerWeek.has(weekStart)) {
        uniqueWorkoutsPerWeek.set(weekStart, new Set());
      }
      uniqueWorkoutsPerWeek.get(weekStart)!.add(log.id);
    }

    const totalWeeks = Math.max(1, weeks);
    const totalOccurrences = Array.from(uniqueWorkoutsPerWeek.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );

    const value = Math.round((totalOccurrences / totalWeeks) * 10) / 10;
    return { value, unit: 'x / wk' }; // TODO: use i18n
  }
}
