import { database } from '../index';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogSet from '../models/WorkoutLogSet';
import Exercise from '../models/Exercise';
import Schedule from '../models/Schedule';
import { Q } from '@nozbe/watermelondb';
import { WorkoutAnalytics } from './WorkoutAnalytics';

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

      // Check if there's already an active workout
      const activeWorkout = await this.getActiveWorkout();
      if (activeWorkout) {
        throw new Error('There is already an active workout. Please complete it first.');
      }

      return await template.startWorkout();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to start workout: ${error.message}`);
      }
      throw new Error('Failed to start workout: Unknown error');
    }
  }

  /**
   * Get the currently active workout (not completed)
   */
  static async getActiveWorkout(): Promise<WorkoutLog | null> {
    const activeWorkouts = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      )
      .fetch();

    return activeWorkouts.length > 0 ? activeWorkouts[0] : null;
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
}
