import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/index';
import Exercise from '@/database/models/Exercise';
import Schedule from '@/database/models/Schedule';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { writeWorkoutToHealthConnect } from '@/services/healthConnectWorkout';
import {
  clearActiveWorkoutLogId,
  getActiveWorkoutLogId,
  setActiveWorkoutLogId,
} from '@/utils/activeWorkoutStorage';
import { calculateWorkoutKcal, type MWEMInput } from '@/utils/workoutEnergyCalculator';
import {
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';
import { UserService } from './UserService';
import { WorkoutAnalytics } from './WorkoutAnalytics';

export type EnrichedWorkoutLogSet = WorkoutLogSet & {
  exerciseId: string;
  groupId?: string;
  notes?: string;
};

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
  static async startFreeWorkout(
    workoutName: string = 'Free Training',
    externalId?: string
  ): Promise<WorkoutLog> {
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
          log.externalId = externalId;
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
   * Get completed workout logs by workout name (e.g. for AI context: past occurrences of the same workout).
   * Ordered by started_at desc (most recent first).
   */
  static async getWorkoutLogsByWorkoutName(
    workoutName: string,
    limit?: number
  ): Promise<WorkoutLog[]> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('workout_name', workoutName),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );

    if (limit !== undefined && limit > 0) {
      query = query.extend(Q.take(limit));
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

      // Calculate calories burned using MWEM (best-effort, never blocks completion)
      try {
        const [user, weightMetric, heightMetric] = await Promise.all([
          UserService.getCurrentUser(),
          UserMetricService.getLatest('weight'),
          UserMetricService.getLatest('height'),
        ]);

        if (user && weightMetric && heightMetric) {
          const [{ value: weightKg }, { value: heightCm }] = await Promise.all([
            weightMetric.getDecrypted(),
            heightMetric.getDecrypted(),
          ]);

          if (weightKg > 0 && heightCm > 0) {
            const { sets, exercises } = await this.getWorkoutWithDetails(workoutLogId);
            const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
            const setsByExercise = new Map<string, WorkoutLogSet[]>();
            for (const set of sets) {
              const eid = set.exerciseId ?? '';
              if (!setsByExercise.has(eid)) {
                setsByExercise.set(eid, []);
              }
              setsByExercise.get(eid)!.push(set);
            }

            const mwemInputs: MWEMInput[] = Array.from(setsByExercise.entries()).flatMap(
              ([exerciseId, exerciseSets]) => {
                const exercise = exerciseMap.get(exerciseId);
                if (!exercise) {
                  return [];
                }

                return [
                  {
                    user: { weightKg, heightCm, gender: user.gender },
                    exercise: {
                      mechanicType: exercise.mechanicType,
                      muscleGroup: exercise.muscleGroup,
                      equipmentType: exercise.equipmentType,
                      loadMultiplier: exercise.loadMultiplier ?? 1,
                    },
                    sets: exerciseSets.map((s) => ({ weight: s.weight ?? 0, reps: s.reps ?? 0 })),
                  },
                ];
              }
            );

            const totalKcal = calculateWorkoutKcal(mwemInputs);
            if (totalKcal > 0) {
              await database.write(async () => {
                await completedWorkout.update((log) => {
                  log.caloriesBurned = Math.round(totalKcal);
                });
              });
            }
          }
        }
      } catch (err) {
        console.warn('MWEM calorie calculation failed:', err);
      }

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

        const hcRecordId = await writeWorkoutToHealthConnect({
          workoutName: completedWorkout.workoutName,
          startedAt: completedWorkout.startedAt,
          completedAt: completedWorkout.completedAt!,
          totalVolume: completedWorkout.totalVolume,
          caloriesBurned: completedWorkout.caloriesBurned ?? undefined,
          workoutType: completedWorkout.type ?? undefined,
          units,
          segmentItems,
        });

        if (hcRecordId) {
          await database.write(async () => {
            await completedWorkout.update((log) => {
              log.externalId = hcRecordId;
            });
          });
        }
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
   * Pure helper: build enriched set objects from log exercises and raw set records.
   * Uses _raw on set records so we always read actual DB values.
   * Shared by getWorkoutWithDetails and reactive observable pipelines.
   */
  static buildEnrichedSetsFromRecords(
    logExercises: { id: string; exerciseId: string; groupId?: string; notes?: string }[],
    rawSets: (
      | WorkoutLogSet
      | { id: string; logExerciseId: string; _raw: Record<string, unknown> }
    )[]
  ): EnrichedWorkoutLogSet[] {
    const logExerciseMap = new Map<
      string,
      { exerciseId: string; groupId?: string; notes?: string }
    >();
    logExercises.forEach((le) => {
      logExerciseMap.set(le.id, {
        exerciseId: le.exerciseId,
        groupId: le.groupId,
        notes: le.notes,
      });
    });
    return rawSets.map((set) => {
      const logExercise = logExerciseMap.get(set.logExerciseId);
      const r = (set as unknown as { _raw: Record<string, unknown> })._raw;
      return {
        id: set.id,
        logExerciseId: (r.log_exercise_id as string) ?? set.logExerciseId,
        reps: (r.reps as number) ?? 0,
        weight: (r.weight as number) ?? 0,
        partials: (r.partials as number | undefined) ?? (set as WorkoutLogSet).partials,
        restTimeAfter: (r.rest_time_after as number) ?? 0,
        repsInReserve: (r.reps_in_reserve as number) ?? 0,
        isSkipped: (r.is_skipped as boolean | undefined) ?? (set as WorkoutLogSet).isSkipped,
        difficultyLevel: (r.difficulty_level as number) ?? 0,
        isDropSet: (r.is_drop_set as boolean) ?? false,
        setOrder: (r.set_order as number) ?? 0,
        createdAt: (r.created_at as number) ?? 0,
        updatedAt: (r.updated_at as number) ?? 0,
        deletedAt: (r.deleted_at as number | undefined) ?? (set as WorkoutLogSet).deletedAt,
        exerciseId: logExercise?.exerciseId ?? '',
        groupId: logExercise?.groupId,
        notes: logExercise?.notes,
      } as EnrichedWorkoutLogSet;
    });
  }

  /**
   * Get workout log with all sets and exercise details.
   * Returns enriched sets with exerciseId, groupId, and notes denormalized from WorkoutLogExercise.
   */
  static async getWorkoutWithDetails(workoutLogId: string): Promise<{
    workoutLog: WorkoutLog;
    sets: EnrichedWorkoutLogSet[];
    exercises: Exercise[];
    logExercises: WorkoutLogExercise[];
  }> {
    const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

    if (workoutLog.deletedAt) {
      throw new Error('Workout log has been deleted');
    }

    const logExercises = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('workout_log_id', workoutLogId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('exercise_order', Q.asc)
      )
      .fetch();

    const logExerciseIds = logExercises.map((le) => le.id);
    const rawSets =
      logExerciseIds.length > 0
        ? await database
            .get<WorkoutLogSet>('workout_log_sets')
            .query(
              Q.where('log_exercise_id', Q.oneOf(logExerciseIds)),
              Q.where('deleted_at', Q.eq(null)),
              Q.sortBy('set_order', Q.asc)
            )
            .fetch()
        : [];

    const sets = WorkoutService.buildEnrichedSetsFromRecords(
      logExercises.map((le) => ({
        id: le.id,
        exerciseId: le.exerciseId,
        groupId: le.groupId,
        notes: le.notes,
      })),
      rawSets
    );

    const exerciseIds = [...new Set(logExercises.map((le) => le.exerciseId))].filter(Boolean);
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
      logExercises,
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
      const logExercisesCollection = database.get<WorkoutLogExercise>('workout_log_exercises');

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

        // Get existing log exercises for this workout
        const existingLogExercises = await logExercisesCollection
          .query(Q.where('workout_log_id', workoutLogId), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        // Create a map of exerciseId -> logExerciseId for quick lookup
        const exerciseToLogExerciseMap = new Map<string, string>();
        existingLogExercises.forEach((le) => {
          exerciseToLogExerciseMap.set(le.exerciseId, le.id);
        });

        // Track max exercise order for creating new log exercises
        let maxExerciseOrder = existingLogExercises.reduce(
          (max, le) => Math.max(max, le.exerciseOrder ?? 0),
          0
        );

        for (const update of updates) {
          try {
            if (update.isNew && update.exerciseId) {
              // For new sets, find or create the log exercise block
              let logExerciseId = exerciseToLogExerciseMap.get(update.exerciseId);

              if (!logExerciseId) {
                // Create a new log exercise block for this exercise
                maxExerciseOrder++;
                const newLogExercise = await logExercisesCollection.create((le) => {
                  le.workoutLogId = workoutLogId;
                  le.exerciseId = update.exerciseId!;
                  le.exerciseOrder = maxExerciseOrder;
                  le.groupId = update.groupId;
                  le.createdAt = Date.now();
                  le.updatedAt = Date.now();
                });
                logExerciseId = newLogExercise.id;
                exerciseToLogExerciseMap.set(update.exerciseId, logExerciseId);
              } else if (update.groupId !== undefined) {
                // Update groupId on existing log exercise if provided
                const existingLE = existingLogExercises.find((le) => le.id === logExerciseId);
                if (existingLE && existingLE.groupId !== update.groupId) {
                  await existingLE.update((le) => {
                    le.groupId = update.groupId;
                    le.updatedAt = Date.now();
                  });
                }
              }

              // Create a new set linked to the log exercise
              await logSetsCollection.create((logSet) => {
                logSet.logExerciseId = logExerciseId!;
                logSet.reps = update.reps ?? 0;
                logSet.weight = update.weight ?? 0;
                logSet.partials = update.partials ?? 0;
                logSet.restTimeAfter = update.restTimeAfter ?? 0;
                logSet.repsInReserve = update.repsInReserve ?? 0;
                logSet.difficultyLevel = update.difficultyLevel ?? 0;
                logSet.isSkipped = update.isSkipped ?? false;
                logSet.isDropSet = update.isDropSet ?? false;
                logSet.setOrder = update.setOrder ?? 0;
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
   * Get the current set (first unlogged set in superset-effective order) for a workout.
   * Returns enriched set with exerciseId denormalized.
   */
  static async getCurrentSet(workoutLogId: string): Promise<{
    set: EnrichedWorkoutLogSet;
    exercise: Exercise;
  } | null> {
    const { sets } = await this.getWorkoutWithDetails(workoutLogId);

    const currentSet = getFirstUnloggedInEffectiveOrder(sets);
    if (!currentSet) {
      return null;
    }

    const exercise = await database.get<Exercise>('exercises').find(currentSet.exerciseId ?? '');
    return { set: currentSet, exercise };
  }

  /**
   * Get the next set (in superset-effective order) after the set with the given set_order.
   * Returns enriched set with exerciseId denormalized.
   */
  static async getNextSet(
    workoutLogId: string,
    currentSetOrder: number
  ): Promise<{
    set: EnrichedWorkoutLogSet;
    exercise: Exercise;
  } | null> {
    const { sets } = await this.getWorkoutWithDetails(workoutLogId);

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
    const { sets } = await this.getWorkoutWithDetails(workoutLogId);

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

      // Also soft-delete all associated log exercises and their sets
      const logExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(Q.where('workout_log_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const logExercise of logExercises) {
        const sets = await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(Q.where('log_exercise_id', logExercise.id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        for (const set of sets) {
          await writer.callWriter(() => set.markAsDeleted());
        }

        await writer.callWriter(() => logExercise.markAsDeleted());
      }
    });
  }

  /**
   * Duplicate workout log (create a copy with all exercise blocks and sets, marked as not completed)
   */
  static async duplicateWorkoutLog(id: string): Promise<WorkoutLog> {
    return await database.write(async () => {
      const originalLog = await database.get<WorkoutLog>('workout_logs').find(id);

      if (originalLog.deletedAt) {
        throw new Error('Cannot duplicate deleted workout log');
      }

      const now = Date.now();

      // Get all log exercises from the original workout
      const originalLogExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(
          Q.where('workout_log_id', id),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('exercise_order', Q.asc)
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

      // Copy all log exercises and their sets
      for (const originalLogExercise of originalLogExercises) {
        const newLogExercise = await database
          .get<WorkoutLogExercise>('workout_log_exercises')
          .create((le) => {
            le.workoutLogId = newLog.id;
            le.exerciseId = originalLogExercise.exerciseId;
            le.exerciseOrder = originalLogExercise.exerciseOrder;
            le.groupId = originalLogExercise.groupId;
            le.notes = originalLogExercise.notes;
            le.createdAt = now;
            le.updatedAt = now;
          });

        // Get and copy all sets for this log exercise
        const originalSets = await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('log_exercise_id', originalLogExercise.id),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .fetch();

        for (const originalSet of originalSets) {
          await database.get<WorkoutLogSet>('workout_log_sets').create((set) => {
            set.logExerciseId = newLogExercise.id;
            set.setOrder = originalSet.setOrder;
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
      }

      return newLog;
    });
  }

  /**
   * Backfill totalVolume for all completed workout logs that have a NULL volume.
   * This runs after the v3 migration which wiped old reps×weight values so they
   * can be replaced with the accurate average-1RM formula.
   */
  static async backfillNullTotalVolumes(): Promise<void> {
    const logs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('total_volume', Q.eq(null)),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    if (logs.length === 0) {
      return;
    }

    const entries = await Promise.all(
      logs.map(async (log) => ({ log, volume: await log.calculateVolume() }))
    );

    const now = Date.now();
    await database.write(async () => {
      await database.batch(
        ...entries.map(({ log, volume }) =>
          log.prepareUpdate((l) => {
            l.totalVolume = volume;
            l.updatedAt = now;
          })
        )
      );
    });
  }
}
