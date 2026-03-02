import { Q } from '@nozbe/watermelondb';

import { writeWorkoutToHealthConnect } from '../../services/healthConnectWorkout';
import {
  clearActiveWorkoutLogId,
  getActiveWorkoutLogId,
  setActiveWorkoutLogId,
} from '../../utils/activeWorkoutStorage';
import {
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '../../utils/workoutSupersetOrder';
import { database } from '../index';
import Exercise from '../models/Exercise';
import Schedule from '../models/Schedule';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutLogSet from '../models/WorkoutLogSet';
import WorkoutTemplate from '../models/WorkoutTemplate';
import { SettingsService } from './SettingsService';
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
   * Start a free training session (no template). Creates an empty WorkoutLog
   * and sets it as the active workout.
   */
  static async startFreeWorkout(workoutName: string = 'Free Training'): Promise<WorkoutLog> {
    try {
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId) {
        try {
          const activeWorkout = await database
            .get<WorkoutLog>('workout_logs')
            .find(activeWorkoutLogId);
          if (!activeWorkout.deletedAt && !activeWorkout.completedAt) {
            throw new Error('There is already an active workout. Please complete it first.');
          } else {
            await clearActiveWorkoutLogId();
          }
        } catch (error) {
          await clearActiveWorkoutLogId();
        }
      }

      const now = Date.now();
      const workoutLog = await database.write(async () => {
        const workoutLogsCollection = database.get<WorkoutLog>('workout_logs');
        return await workoutLogsCollection.create((log) => {
          log.workoutName = workoutName;
          log.templateId = undefined;
          log.type = 'free';
          log.startedAt = now;
          log.completedAt = undefined;
          log.totalVolume = undefined;
          log.exhaustionLevel = undefined;
          log.workoutScore = undefined;
          log.createdAt = now;
          log.updatedAt = now;
        });
      });

      await setActiveWorkoutLogId(workoutLog.id);
      return workoutLog;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to start free workout: ${error.message}`);
      }
      throw new Error('Failed to start free workout: Unknown error');
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

    const templateIds = [...new Set(schedules.map((s) => s.templateId ?? ''))].filter(Boolean);

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

      // Write to Health Connect if permission granted (best-effort, never fails workout completion)
      try {
        const units = await SettingsService.getUnits();
        const { sets, exercises } = await this.getWorkoutWithDetails(workoutLogId);
        const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
        const byExercise = new Map<string, WorkoutLogSet[]>();
        for (const set of sets) {
          const eid = set.exerciseId ?? '';
          if (!byExercise.has(eid)) {
            byExercise.set(eid, []);
          }
          byExercise.get(eid)!.push(set);
        }
        const segmentItems = Array.from(byExercise.entries()).map(([exerciseId, exerciseSets]) => {
          const exercise = exerciseMap.get(exerciseId);
          const totalReps = exerciseSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
          const setsData = exerciseSets.map((s) => ({
            reps: s.reps ?? 0,
            weight: s.weight ?? 0,
          }));
          return {
            exerciseName: exercise?.name ?? 'Exercise',
            totalReps,
            sets: setsData,
          };
        });
        await writeWorkoutToHealthConnect({
          workoutName: completedWorkout.workoutName,
          startedAt: completedWorkout.startedAt,
          completedAt: completedWorkout.completedAt!,
          totalVolume: completedWorkout.totalVolume,
          workoutType: completedWorkout.type ?? undefined,
          units,
          segmentItems,
        });
      } catch (err) {
        console.warn('Health Connect workout write failed:', err);
      }

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
   * Update workout log feedback (exhaustion level and workout score). Call after user submits session feedback.
   */
  static async updateWorkoutLogFeedback(
    workoutLogId: string,
    feedback: { exhaustionLevel?: number; workoutScore?: number }
  ): Promise<void> {
    const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
    await workoutLog.updateFeedback(feedback);
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

    const exerciseIds = [...new Set(sets.map((set) => set.exerciseId ?? ''))].filter(Boolean);
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
   * Update multiple workout log sets (existing or new) and recompute parent workout totals
   * Separates new sets (create) from existing sets (update) based on isNew flag
   * Also handles deletion of removed sets
   */
  static async updateWorkoutSets(
    workoutLogId: string,
    updates: {
      setId: string;
      exerciseId?: string; // Required for new sets
      reps?: number;
      weight?: number;
      partials?: number;
      restTimeAfter?: number;
      repsInReserve?: number;
      difficultyLevel?: number;
      isSkipped?: boolean;
      isDropSet?: boolean;
      groupId?: string;
      isNew?: boolean; // Flag to indicate if this is a new set
      setOrder?: number; // Optional: explicit ordering for the set
    }[],
    deletedSetIds?: string[] // IDs of sets to delete
  ): Promise<{ workoutLogId: string; totalVolume: number }> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.deletedAt) {
        throw new Error('Workout log has been deleted');
      }

      const logSetsCollection = database.get<WorkoutLogSet>('workout_log_sets');

      // Perform direct writes so we can edit sets even if the workout is marked completed.
      // This intentionally bypasses WorkoutLog.updateSet which prevents edits on completed workouts.
      await database.write(async () => {
        // Delete removed sets
        if (deletedSetIds && deletedSetIds.length > 0) {
          for (const deletedId of deletedSetIds) {
            try {
              const setToDelete = await logSetsCollection.find(deletedId);
              await setToDelete.markAsDeleted();
            } catch (err) {
              console.warn(`Failed to delete set ${deletedId}:`, err);
            }
          }
        }

        for (const update of updates) {
          try {
            if (update.isNew && update.exerciseId) {
              // Create a new set
              await logSetsCollection.create((logSet) => {
                logSet.workoutLogId = workoutLogId;
                logSet.exerciseId = update.exerciseId!;
                logSet.reps = update.reps ?? 0;
                logSet.weight = update.weight ?? 0;
                logSet.partials = update.partials ?? 0;
                logSet.restTimeAfter = update.restTimeAfter ?? 0;
                logSet.repsInReserve = update.repsInReserve ?? 0;
                logSet.difficultyLevel = update.difficultyLevel ?? 0;
                logSet.isSkipped = update.isSkipped ?? false;
                logSet.isDropSet = update.isDropSet ?? false;
                logSet.groupId = update.groupId;
                logSet.setOrder = update.setOrder ?? 0; // Caller can provide order
                logSet.createdAt = Date.now();
                logSet.updatedAt = Date.now();
              });
            } else {
              // Update an existing set
              const setModel = await logSetsCollection.find(update.setId);
              await setModel.update((s: WorkoutLogSet) => {
                if (update.reps !== undefined) {
                  s.reps = update.reps;
                }
                if (update.weight !== undefined) {
                  s.weight = update.weight;
                }
                if (update.partials !== undefined) {
                  s.partials = update.partials;
                }
                if (update.restTimeAfter !== undefined) {
                  s.restTimeAfter = update.restTimeAfter;
                }
                if (update.repsInReserve !== undefined) {
                  s.repsInReserve = update.repsInReserve;
                }
                if (update.difficultyLevel !== undefined) {
                  s.difficultyLevel = update.difficultyLevel;
                }
                if (update.isSkipped !== undefined) {
                  s.isSkipped = update.isSkipped;
                }
                if (update.isDropSet !== undefined) {
                  s.isDropSet = update.isDropSet;
                }
                if (update.groupId !== undefined) {
                  s.groupId = update.groupId;
                }
                if (update.setOrder !== undefined) {
                  s.setOrder = update.setOrder;
                }
                s.updatedAt = Date.now();
              });
            }
          } catch (err) {
            console.warn(`Failed to update set ${update.setId}:`, err);
          }
        }

        // Recalculate total volume and update parent workout log
        const sets = await logSetsCollection
          .query(Q.where('workout_log_id', workoutLogId), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        const totalVolume = sets.reduce(
          (sum: number, s: WorkoutLogSet) => sum + ((s.reps ?? 0) * (s.weight ?? 0) || 0),
          0
        );

        await workoutLog.update((log) => {
          log.totalVolume = totalVolume;
          log.updatedAt = Date.now();
        });
      });

      const finalTotal = await workoutLog.calculateVolume();
      return { workoutLogId, totalVolume: finalTotal };
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
   * Get the current set (first unlogged set in superset-effective order) for a workout
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

    const currentSet = getFirstUnloggedInEffectiveOrder(sets);
    if (!currentSet) {
      return null;
    }

    const exercise = await database.get<Exercise>('exercises').find(currentSet.exerciseId ?? '');
    return { set: currentSet, exercise };
  }

  /**
   * Get the next set (in superset-effective order) after the set with the given set_order
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

    const nextSet = getNextSetInEffectiveOrder(sets, currentSetOrder);
    if (!nextSet) {
      return null;
    }

    const exercise = await database.get<Exercise>('exercises').find(nextSet.exerciseId ?? '');
    return { set: nextSet, exercise };
  }

  /**
   * Get workout progress metadata (current set = first unlogged in superset-effective order)
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
    const completedSets = sets.filter((set) => (set.difficultyLevel ?? 0) > 0).length;
    const currentSet = getFirstUnloggedInEffectiveOrder(sets);
    const currentSetOrder = currentSet?.setOrder ?? null;

    // Group sets by exercise
    const exerciseGrouping = new Map<string, number[]>();
    sets.forEach((set) => {
      const exerciseId = set.exerciseId ?? '';
      if (!exerciseGrouping.has(exerciseId)) {
        exerciseGrouping.set(exerciseId, []);
      }
      exerciseGrouping.get(exerciseId)!.push(set.setOrder ?? 0);
    });

    return {
      totalSets,
      completedSets,
      currentSetOrder,
      exerciseGrouping,
    };
  }

  /**
   * Delete workout log (soft delete)
   */
  static async deleteWorkoutLog(id: string): Promise<void> {
    return await database.write(async (writer) => {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(id);
      // Use callWriter to avoid nested writes since markAsDeleted is a @writer method
      await writer.callWriter(() => workoutLog.markAsDeleted());

      // Also soft-delete all associated sets
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('workout_log_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const set of sets) {
        await writer.callWriter(() => set.markAsDeleted());
      }
    });
  }

  /**
   * Duplicate workout log (create a copy with all sets, marked as not completed)
   */
  static async duplicateWorkoutLog(id: string): Promise<WorkoutLog> {
    return await database.write(async () => {
      const originalLog = await database.get<WorkoutLog>('workout_logs').find(id);

      if (originalLog.deletedAt) {
        throw new Error('Cannot duplicate deleted workout log');
      }

      const now = Date.now();

      // Get all sets from the original workout
      const originalSets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(
          Q.where('workout_log_id', id),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('set_order', Q.asc)
        )
        .fetch();

      // Create new workout log with "(Copy)" suffix
      const newLog = await database.get<WorkoutLog>('workout_logs').create((log) => {
        log.templateId = originalLog.templateId;
        log.workoutName = `${originalLog.workoutName} (Copy)`;
        log.type = originalLog.type;
        log.icon = originalLog.icon ?? undefined;
        log.startedAt = now;
        log.completedAt = undefined; // Not completed yet
        log.totalVolume = 0;
        log.exhaustionLevel = undefined;
        log.workoutScore = undefined;
        log.createdAt = now;
        log.updatedAt = now;
      });

      // Copy all sets (reset to unlogged state)
      for (const originalSet of originalSets) {
        await database.get<WorkoutLogSet>('workout_log_sets').create((set) => {
          set.workoutLogId = newLog.id;
          set.exerciseId = originalSet.exerciseId;
          set.setOrder = originalSet.setOrder;
          set.groupId = originalSet.groupId;
          set.reps = 0; // Reset actual values
          set.weight = 0;
          set.partials = 0;
          set.restTimeAfter = originalSet.restTimeAfter;
          set.repsInReserve = 0;
          set.difficultyLevel = 0; // Unlogged
          set.isSkipped = false;
          set.isDropSet = originalSet.isDropSet;
          set.createdAt = now;
          set.updatedAt = now;
        });
      }

      return newLog;
    });
  }
}
