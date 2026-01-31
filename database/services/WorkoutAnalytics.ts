import { Q } from '@nozbe/watermelondb';

import { database } from '../index';
import Exercise from '../models/Exercise';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogSet from '../models/WorkoutLogSet';

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
    if (reps === 0) return 0;
    return weight * (1 + reps / 30);
  }

  /**
   * Detect personal records in a completed workout log
   */
  static async detectPersonalRecords(workoutLog: WorkoutLog): Promise<PersonalRecord[]> {
    const records: PersonalRecord[] = [];
    const sets = await workoutLog.logSets.fetch();

    // Group sets by exercise
    const exerciseSets = new Map<string, WorkoutLogSet[]>();
    for (const set of sets) {
      const exerciseId = set.exerciseId;
      if (!exerciseSets.has(exerciseId)) {
        exerciseSets.set(exerciseId, []);
      }
      exerciseSets.get(exerciseId)!.push(set);
    }

    // Check for PRs in each exercise
    for (const [exerciseId, logSets] of exerciseSets.entries()) {
      // Get the best set from current workout (highest weight × reps)
      const bestSet = logSets.reduce((best, current) => {
        const currentVolume = current.weight * current.reps;
        const bestVolume = best.weight * best.reps;
        return currentVolume > bestVolume ? current : best;
      });

      // Get all historical sets for this exercise (excluding current workout and deleted sets)
      const historicalSets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('exercise_id', exerciseId),
          Q.where('workout_log_id', Q.notEq(workoutLog.id)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch();

      // Get historical sets only from completed workouts
      const completedWorkoutIds = new Set(
        (
          await database
            .get<WorkoutLog>('workout_logs')
            .query(
              Q.where('completed_at', Q.notEq(null)),
              Q.where('id', Q.oneOf(historicalSets.map((s) => s.workoutLogId)))
            )
            .fetch()
        ).map((log) => log.id)
      );

      const validHistoricalSets = historicalSets.filter((s) =>
        completedWorkoutIds.has(s.workoutLogId)
      );

      if (validHistoricalSets.length === 0) {
        // First time doing this exercise - it's a PR by default
        try {
          const exercise = await database.get<Exercise>('exercises').find(exerciseId);
          records.push({
            exerciseId,
            exerciseName: exercise.name,
            previousBest: {
              weight: 0,
              reps: 0,
              volume: 0,
              date: 0,
            },
            newRecord: {
              weight: bestSet.weight,
              reps: bestSet.reps,
              volume: bestSet.weight * bestSet.reps,
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
        const currentVolume = current.weight * current.reps;
        const bestVolume = best.weight * best.reps;
        return currentVolume > bestVolume ? current : best;
      });

      const bestHistoricalVolume = bestHistorical.weight * bestHistorical.reps;
      const bestHistoricalWeight = Math.max(...validHistoricalSets.map((s) => s.weight));
      const bestHistoricalReps = Math.max(...validHistoricalSets.map((s) => s.reps));
      const bestHistorical1RM = Math.max(
        ...validHistoricalSets.map((s) => this.calculateEstimated1RM(s.weight, s.reps))
      );

      const currentVolume = bestSet.weight * bestSet.reps;
      const current1RM = this.calculateEstimated1RM(bestSet.weight, bestSet.reps);

      // Get the workout date for the best historical
      try {
        const historicalWorkout = await database
          .get<WorkoutLog>('workout_logs')
          .find(bestHistorical.workoutLogId);
        const exercise = await database.get<Exercise>('exercises').find(exerciseId);

        // Check for volume PR
        if (currentVolume > bestHistoricalVolume) {
          records.push({
            exerciseId,
            exerciseName: exercise.name,
            previousBest: {
              weight: bestHistorical.weight,
              reps: bestHistorical.reps,
              volume: bestHistoricalVolume,
              date: historicalWorkout.startedAt,
            },
            newRecord: {
              weight: bestSet.weight,
              reps: bestSet.reps,
              volume: currentVolume,
            },
            type: 'volume',
          });
        }

        // Check for weight PR
        if (bestSet.weight > bestHistoricalWeight) {
          records.push({
            exerciseId,
            exerciseName: exercise.name,
            previousBest: {
              weight: bestHistoricalWeight,
              reps: 0,
              volume: 0,
              date: historicalWorkout.startedAt,
            },
            newRecord: {
              weight: bestSet.weight,
              reps: bestSet.reps,
              volume: currentVolume,
            },
            type: 'weight',
          });
        }

        // Check for reps PR
        if (bestSet.reps > bestHistoricalReps) {
          records.push({
            exerciseId,
            exerciseName: exercise.name,
            previousBest: {
              weight: 0,
              reps: bestHistoricalReps,
              volume: 0,
              date: historicalWorkout.startedAt,
            },
            newRecord: {
              weight: bestSet.weight,
              reps: bestSet.reps,
              volume: currentVolume,
            },
            type: 'reps',
          });
        }

        // Check for estimated 1RM PR
        if (current1RM > bestHistorical1RM) {
          records.push({
            exerciseId,
            exerciseName: exercise.name,
            previousBest: {
              weight: 0,
              reps: 0,
              volume: 0,
              date: historicalWorkout.startedAt,
            },
            newRecord: {
              weight: bestSet.weight,
              reps: bestSet.reps,
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
    let query = database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('exercise_id', exerciseId), Q.where('deleted_at', Q.eq(null)));

    const sets = await query.fetch();

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
      validSets = sets.filter((s) => workoutIds.has(s.workoutLogId));
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
      validSets = sets.filter((s) => completedWorkoutIds.has(s.workoutLogId));
    }

    // Group by workout and get best set per workout
    const workoutData = new Map<string, WorkoutLogSet>();

    for (const set of validSets) {
      const existing = workoutData.get(set.workoutLogId);
      if (!existing || set.weight * set.reps > existing.weight * existing.reps) {
        workoutData.set(set.workoutLogId, set);
      }
    }

    // Convert to data points with dates
    const dataPoints: ProgressiveOverloadDataPoint[] = [];

    for (const [workoutId, set] of workoutData.entries()) {
      try {
        const workout = await database.get<WorkoutLog>('workout_logs').find(workoutId);
        dataPoints.push({
          date: workout.startedAt,
          weight: set.weight,
          reps: set.reps,
          volume: set.weight * set.reps,
          estimated1RM: this.calculateEstimated1RM(set.weight, set.reps),
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
        (log) => log.startedAt >= timeframe.startDate && log.startedAt <= timeframe.endDate
      );
    }

    // Process each workout
    for (const workout of validWorkouts) {
      const sets = await workout.logSets.fetch();

      for (const set of sets) {
        try {
          const exercise = await database.get<Exercise>('exercises').find(set.exerciseId);
          const volume = set.reps * set.weight;
          const muscleGroup = exercise.muscleGroup;

          if (!muscleGroupVolume.has(muscleGroup)) {
            muscleGroupVolume.set(muscleGroup, { volume: 0, exercises: new Set() });
          }

          const groupData = muscleGroupVolume.get(muscleGroup)!;
          groupData.volume += volume;
          groupData.exercises.add(set.exerciseId);
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
}
