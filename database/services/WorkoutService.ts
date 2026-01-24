import { database } from '../index';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogSet from '../models/WorkoutLogSet';
import Exercise from '../models/Exercise';
import Schedule from '../models/Schedule';
import { Q } from '@nozbe/watermelondb';
import { WorkoutAnalytics } from './WorkoutAnalytics';
import {
  getActiveWorkoutLogId,
  setActiveWorkoutLogId,
  clearActiveWorkoutLogId,
} from '../../utils/activeWorkoutStorage';

export class WorkoutService {
  /**
   * Start a workout from a template (deep copy operation)
   */
  static async startWorkoutFromTemplate(templateId: string): Promise<WorkoutLog> {
    try {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);

      if (template.deletedAt) {
        throw new Error('Cannot start workout from a deleted template');
      }

      // Check if there's already an active workout in AsyncStorage
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId) {
        // Verify the workout still exists and is not completed
        try {
          const activeWorkout = await database
            .get<WorkoutLog>('workout_logs')
            .find(activeWorkoutLogId);
          if (!activeWorkout.deletedAt && !activeWorkout.completedAt) {
            throw new Error('There is already an active workout. Please complete it first.');
          } else {
            // Workout was completed or deleted, clear it from storage
            await clearActiveWorkoutLogId();
          }
        } catch (error) {
          // Workout doesn't exist, clear it from storage
          await clearActiveWorkoutLogId();
        }
      }

      const workoutLog = await template.startWorkout();

      // Store the active workout log ID in AsyncStorage
      await setActiveWorkoutLogId(workoutLog.id);

      return workoutLog;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to start workout: ${error.message}`);
      }
      throw new Error('Failed to start workout: Unknown error');
    }
  }

  /**
   * Get the currently active workout (not completed)
   * Uses AsyncStorage to track the active workout
   */
  static async getActiveWorkout(): Promise<WorkoutLog | null> {
    const activeWorkoutLogId = await getActiveWorkoutLogId();
    if (!activeWorkoutLogId) {
      return null;
    }

    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(activeWorkoutLogId);

      // Verify the workout is still active (not completed or deleted)
      if (workoutLog.completedAt || workoutLog.deletedAt) {
        // Clear from storage if it's no longer active
        await clearActiveWorkoutLogId();
        return null;
      }

      return workoutLog;
    } catch (error) {
      // Workout doesn't exist, clear from storage
      await clearActiveWorkoutLogId();
      return null;
    }
  }

  /**
   * Get workout history with optional timeframe and pagination
   */
  static async getWorkoutHistory(
    timeframe?: { startDate: number; endDate: number },
    limit?: number,
    offset?: number
  ): Promise<WorkoutLog[]> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );

    if (timeframe) {
      query = query.extend(
        Q.where('started_at', Q.gte(timeframe.startDate)),
        Q.where('started_at', Q.lte(timeframe.endDate))
      );
    }

    // WatermelonDB requires Q.take() when using Q.skip()
    // Apply skip before take (if offset > 0), then always apply take
    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        // Apply both skip and take together - skip must come before take
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    return await query.fetch();
  }

  /**
   * Get upcoming scheduled workouts for a specific date
   */
  static async getUpcomingScheduledWorkouts(date: Date): Promise<WorkoutTemplate[]> {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

    const schedules = await database
      .get<Schedule>('schedules')
      .query(Q.where('day_of_week', dayOfWeek), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const templateIds = [...new Set(schedules.map((s) => s.templateId))];

    if (templateIds.length === 0) {
      return [];
    }

    const templates = await database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('id', Q.oneOf(templateIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return templates;
  }

  /**
   * Complete a workout and run analytics
   */
  static async completeWorkout(workoutLogId: string): Promise<{
    workoutLog: WorkoutLog;
    personalRecords: Awaited<ReturnType<typeof WorkoutAnalytics.detectPersonalRecords>>;
  }> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.completedAt) {
        throw new Error('Workout is already completed');
      }

      // Complete the workout (this calculates volume)
      await workoutLog.completeWorkout();

      // Clear active workout from AsyncStorage
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId === workoutLogId) {
        await clearActiveWorkoutLogId();
      }

      // Reload to get updated values
      const completedWorkout = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      // Detect personal records
      const personalRecords = await WorkoutAnalytics.detectPersonalRecords(completedWorkout);

      return {
        workoutLog: completedWorkout,
        personalRecords,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to complete workout: ${error.message}`);
      }
      throw new Error('Failed to complete workout: Unknown error');
    }
  }

  /**
   * Get workout statistics for a timeframe
   */
  static async getWorkoutStatistics(timeframe: { startDate: number; endDate: number }): Promise<{
    totalWorkouts: number;
    totalVolume: number;
    averageVolumePerWorkout: number;
    muscleGroupVolume: Awaited<ReturnType<typeof WorkoutAnalytics.calculateMuscleGroupVolume>>;
  }> {
    const workouts = await this.getWorkoutHistory(timeframe);

    const totalWorkouts = workouts.length;
    const totalVolume = workouts.reduce((sum, workout) => {
      return sum + (workout.totalVolume || 0);
    }, 0);
    const averageVolumePerWorkout = totalWorkouts > 0 ? totalVolume / totalWorkouts : 0;

    const muscleGroupVolume = await WorkoutAnalytics.calculateMuscleGroupVolume(
      workouts,
      timeframe
    );

    return {
      totalWorkouts,
      totalVolume,
      averageVolumePerWorkout,
      muscleGroupVolume,
    };
  }

  /**
   * Get workout log with all sets and exercise details
   */
  static async getWorkoutWithDetails(workoutLogId: string): Promise<{
    workoutLog: WorkoutLog;
    sets: WorkoutLogSet[];
    exercises: Exercise[];
  }> {
    const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

    if (workoutLog.deletedAt) {
      throw new Error('Workout log has been deleted');
    }

    const sets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLogId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      )
      .fetch();

    const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))];
    const exercises =
      exerciseIds.length > 0
        ? await database
            .get<Exercise>('exercises')
            .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
            .fetch()
        : [];

    return {
      workoutLog,
      sets,
      exercises,
    };
  }

  /**
   * Update multiple workout log sets and recompute parent workout totals
   */
  static async updateWorkoutSets(
    workoutLogId: string,
    updates: {
      setId: string;
      reps?: number;
      weight?: number;
      partials?: number;
      restTimeAfter?: number;
      difficultyLevel?: number;
      isSkipped?: boolean;
      isDropSet?: boolean;
    }[]
  ): Promise<{ workoutLogId: string; totalVolume: number }> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.deletedAt) {
        throw new Error('Workout log has been deleted');
      }

      // Apply updates using the model writer method
      for (const update of updates) {
        await workoutLog.updateSet(update.setId, {
          reps: update.reps,
          weight: update.weight,
          partials: update.partials,
          restTimeAfter: update.restTimeAfter,
          difficultyLevel: update.difficultyLevel,
          isSkipped: update.isSkipped,
          isDropSet: update.isDropSet,
        });
      }

      // Recalculate total volume and persist on parent log
      const totalVolume = await workoutLog.calculateVolume();
      await workoutLog.update((log) => {
        log.totalVolume = totalVolume;
        log.updatedAt = Date.now();
      });

      return { workoutLogId, totalVolume };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update workout sets: ${error.message}`);
      }
      throw new Error('Failed to update workout sets: Unknown error');
    }
  }

  /**
   * Get workout logs by template_id, ordered by date (newest first)
   */
  static async getWorkoutLogsByTemplate(templateId: string, limit?: number): Promise<WorkoutLog[]> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('template_id', templateId),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );

    if (limit) {
      query = query.extend(Q.take(limit));
    }

    return await query.fetch();
  }

  /**
   * Get the current set (first unlogged set) for a workout
   */
  static async getCurrentSet(workoutLogId: string): Promise<{
    set: WorkoutLogSet;
    exercise: Exercise;
  } | null> {
    const sets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLogId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      )
      .fetch();

    // Find first set with difficultyLevel === 0 (unlogged)
    const currentSet = sets.find((set) => set.difficultyLevel === 0);
    if (!currentSet) {
      return null;
    }

    const exercise = await database.get<Exercise>('exercises').find(currentSet.exerciseId);
    return { set: currentSet, exercise };
  }

  /**
   * Get the next set after the current set order
   */
  static async getNextSet(
    workoutLogId: string,
    currentSetOrder: number
  ): Promise<{
    set: WorkoutLogSet;
    exercise: Exercise;
  } | null> {
    const sets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLogId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      )
      .fetch();

    // Find next unlogged set after current set order
    const nextSet = sets.find((set) => set.setOrder > currentSetOrder && set.difficultyLevel === 0);
    if (!nextSet) {
      return null;
    }

    const exercise = await database.get<Exercise>('exercises').find(nextSet.exerciseId);
    return { set: nextSet, exercise };
  }

  /**
   * Get workout progress metadata
   */
  static async getWorkoutProgress(workoutLogId: string): Promise<{
    totalSets: number;
    completedSets: number;
    currentSetOrder: number | null;
    exerciseGrouping: Map<string, number[]>; // exerciseId -> set_order[]
  }> {
    const sets = await database
      .get<WorkoutLogSet>('workout_log_sets')
      .query(
        Q.where('workout_log_id', workoutLogId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      )
      .fetch();

    const totalSets = sets.length;
    const completedSets = sets.filter((set) => set.difficultyLevel > 0).length;
    const currentSet = sets.find((set) => set.difficultyLevel === 0);
    const currentSetOrder = currentSet?.setOrder ?? null;

    // Group sets by exercise
    const exerciseGrouping = new Map<string, number[]>();
    sets.forEach((set) => {
      if (!exerciseGrouping.has(set.exerciseId)) {
        exerciseGrouping.set(set.exerciseId, []);
      }
      exerciseGrouping.get(set.exerciseId)!.push(set.setOrder);
    });

    return {
      totalSets,
      completedSets,
      currentSetOrder,
      exerciseGrouping,
    };
  }
}
