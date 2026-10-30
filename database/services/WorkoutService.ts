import { type Model, Q } from '@nozbe/watermelondb';

import { REPAIR_DESCRIPTORS } from '@/constants/database';
import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { loadWorkoutEnergyProfile } from '@/database/services/workoutEnergyProfile';
import {
  toWorkoutLogSetSnapshot,
  type WorkoutLogSetSnapshot,
} from '@/database/workoutLogSetSnapshot';
import { writeWorkoutToHealthConnect } from '@/services/healthConnectWorkout';
import {
  clearActiveWorkoutLogId,
  getActiveWorkoutLogId,
  setActiveWorkoutLogId,
} from '@/utils/activeWorkoutStorage';
import { deleteBleDataPointsFiles } from '@/utils/bleWorkoutDataStorage';
import { handleError } from '@/utils/handleError';
import { parseStartAdjustment, type SetAdjustment } from '@/utils/setAdjustment';
import { writeSetEffort } from '@/utils/setEffort';
import { parseSetPrescription } from '@/utils/setPrescription';
import { getCurrentTimezone } from '@/utils/timezone';
import { jsDayToWeekdayIndex } from '@/utils/weekdays';
import { getRollingWeeklyWorkoutRange } from '@/utils/weeklyWorkoutProgress';
import { calculateExerciseVolume } from '@/utils/workoutCalculator';
import {
  estimateWorkoutKcalFromSets,
  type WorkoutEnergyProfile,
} from '@/utils/workoutKcalEstimate';
import {
  assertValidWorkoutSetDifficultyLevel,
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isWorkingSet,
  isWorkoutSetCompletionStatus,
  type WorkoutSetCompletionStatus,
} from '@/utils/workoutSetCompletion';
import {
  getFirstUnloggedInEffectiveOrder,
  getNextSetInEffectiveOrder,
} from '@/utils/workoutSupersetOrder';

import { DatabaseRepairService } from './DatabaseRepairService';
import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';
import { WorkoutAnalytics } from './WorkoutAnalytics';
import { WorkoutProgressionService } from './WorkoutProgressionService';

export type EnrichedWorkoutLogSet = WorkoutLogSetSnapshot & {
  supersetSlotId?: string;
  progressionJson?: string;
  exerciseId: string;
  groupId?: string;
  notes?: string;
  /** Set by the live session when it re-targets the planned set — see `computeIntraSessionAdjustment`. */
  adjustment?: SetAdjustment;
  isSkipped: boolean;
};

type CompletedLogsQuery = {
  timeframe?: { startDate: number; endDate: number };
  limit?: number;
  offset?: number;
  templateId?: string;
};

type WorkoutSetUpdateFields = {
  setId: string;
  reps?: number;
  weight?: number;
  partials?: number;
  restTimeAfter?: number;
  /** A number rates the set's effort; `null` clears the rating (unrated). */
  repsInReserve?: number | null;
  difficultyLevel?: number | null;
  completionStatus?: WorkoutSetCompletionStatus;
  setType?: string;
  groupId?: string;
  setOrder?: number;
};

export type WorkoutSetUpdate =
  | (WorkoutSetUpdateFields & {
      isNew: true;
      exerciseId: string;
    })
  | (WorkoutSetUpdateFields & {
      isNew?: false;
      exerciseId?: never;
    });

/**
 * Starting a workout while another one is still open. This is an expected user-state refusal,
 * not a failure: callers should point the user at the open session rather than report it.
 */
export class ActiveWorkoutExistsError extends Error {
  constructor() {
    super('There is already an active workout. Please complete it first.');
    this.name = 'ActiveWorkoutExistsError';
  }
}

export class WorkoutService {
  private static async retryAfterWorkoutRepair<T>(
    error: unknown,
    retry: () => Promise<T>
  ): Promise<T | null> {
    const repair = await DatabaseRepairService.repairIfNeeded(
      error,
      REPAIR_DESCRIPTORS.workoutLogs
    );

    if (!repair.attempted || (!repair.reindexed && repair.deletedRootIds.length === 0)) {
      return null;
    }

    if (repair.deletedRootIds.length > 0) {
      const activeId = await getActiveWorkoutLogId();
      if (activeId && repair.deletedRootIds.includes(activeId)) {
        await clearActiveWorkoutLogId();
      }
    }

    try {
      return await retry();
    } catch (retryError) {
      handleError(retryError, 'WorkoutService.retryAfterWorkoutRepair');
      return null;
    }
  }

  /**
   * Start a workout from a template (deep copy operation)
   */
  static async startWorkoutFromTemplate(templateId: string, planId?: string): Promise<WorkoutLog> {
    return this.startWorkoutFromTemplateInternal(templateId, planId);
  }

  private static async startWorkoutFromTemplateInternal(
    templateId: string,
    planId?: string,
    repairAttempted = false
  ): Promise<WorkoutLog> {
    try {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);

      if (template.deletedAt) {
        throw new Error('Cannot start workout from a deleted template');
      }

      // Check if there's already an active workout in AsyncStorage
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId) {
        // Verify the workout still exists. Only the lookup is guarded: the
        // "already active" check below must stay outside the try, or its own catch
        // swallows the guard and silently starts a second workout.
        let activeWorkout: null | WorkoutLog = null;
        try {
          activeWorkout = await database.get<WorkoutLog>('workout_logs').find(activeWorkoutLogId);
        } catch {
          // Workout doesn't exist, clear it from storage
          await clearActiveWorkoutLogId();
        }

        if (activeWorkout) {
          if (!activeWorkout.deletedAt && !activeWorkout.completedAt) {
            throw new ActiveWorkoutExistsError();
          }

          // Workout was completed or deleted, clear it from storage
          await clearActiveWorkoutLogId();
        }
      }

      const workoutLog = await template.startWorkout(planId);

      // Progress the numbers from the last session when the user asked for suggestions. Best
      // effort: a failure here must never stop a workout from starting — it just keeps the plan's
      // own numbers.
      try {
        await WorkoutProgressionService.applyStartProgression(workoutLog.id);
      } catch (progressionError) {
        handleError(progressionError, 'WorkoutProgressionService.applyStartProgression');
      }

      // Store the active workout log ID in AsyncStorage
      await setActiveWorkoutLogId(workoutLog.id);

      return workoutLog;
    } catch (error) {
      if (error instanceof ActiveWorkoutExistsError) {
        throw error;
      }

      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.startWorkoutFromTemplateInternal(templateId, planId, true)
        );

        if (repaired) {
          return repaired;
        }
      }

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
    return this.startFreeWorkoutInternal(workoutName, externalId);
  }

  private static async startFreeWorkoutInternal(
    workoutName: string = 'Free Training',
    externalId?: string,
    repairAttempted = false
  ): Promise<WorkoutLog> {
    try {
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId) {
        // Only the lookup is guarded, as in startWorkoutFromTemplateInternal: a throw inside this
        // try would be swallowed by its own catch and silently start a second workout.
        let activeWorkout: null | WorkoutLog = null;
        try {
          activeWorkout = await database.get<WorkoutLog>('workout_logs').find(activeWorkoutLogId);
        } catch {
          await clearActiveWorkoutLogId();
        }

        if (activeWorkout) {
          if (!activeWorkout.deletedAt && !activeWorkout.completedAt) {
            throw new ActiveWorkoutExistsError();
          }

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
          log.timezone = getCurrentTimezone();
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
      if (error instanceof ActiveWorkoutExistsError) {
        throw error;
      }

      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.startFreeWorkoutInternal(workoutName, externalId, true)
        );

        if (repaired) {
          return repaired;
        }
      }

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
    return this.getActiveWorkoutInternal();
  }

  private static async getActiveWorkoutInternal(
    repairAttempted = false
  ): Promise<WorkoutLog | null> {
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
      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.getActiveWorkoutInternal(true)
        );

        if (repaired !== null) {
          return repaired;
        }
      }

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
    return this.fetchCompletedLogs({ timeframe, limit, offset });
  }

  static async getCompletedWorkoutCount(timeframe?: {
    startDate: number;
    endDate: number;
  }): Promise<number> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(Q.where('completed_at', Q.notEq(null)), Q.where('deleted_at', Q.eq(null)));

    if (timeframe) {
      query = query.extend(
        Q.where('completed_at', Q.gte(timeframe.startDate)),
        Q.where('completed_at', Q.lte(timeframe.endDate))
      );
    }

    return await query.fetchCount();
  }

  static async getRollingWeeklyCompletedWorkoutCount(date: Date = new Date()): Promise<number> {
    return await this.getCompletedWorkoutCount(getRollingWeeklyWorkoutRange(date));
  }

  /**
   * Estimated energy for a finished workout (MWEM, performed sets only), rounded to whole kcal.
   * Returns 0 when it cannot be estimated (no user or weight on file, no usable sets). Shared by
   * completing a live workout and by the Musclog 1.x conversion, which stored no calories at all
   * and passes the `profile` it loaded once rather than having it re-read for every workout.
   */
  static async estimateWorkoutKcal(
    workoutLogId: string,
    profile?: WorkoutEnergyProfile
  ): Promise<number> {
    const resolvedProfile = profile ?? (await loadWorkoutEnergyProfile());
    if (!resolvedProfile) {
      return 0;
    }

    const { sets, exercises } = await this.getWorkoutWithDetails(workoutLogId);
    return estimateWorkoutKcalFromSets(resolvedProfile, sets, exercises);
  }

  /**
   * The one definition of "completed, not deleted, newest first", with the optional filters every
   * caller composes: a date window, a page and a workout template.
   */
  private static async fetchCompletedLogs(query: CompletedLogsQuery): Promise<WorkoutLog[]> {
    const build = () => {
      const { timeframe, limit, offset, templateId } = query;
      let logs = database
        .get<WorkoutLog>('workout_logs')
        .query(
          Q.where('completed_at', Q.notEq(null)),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('started_at', Q.desc)
        );

      if (timeframe) {
        logs = logs.extend(
          Q.where('started_at', Q.gte(timeframe.startDate)),
          Q.where('started_at', Q.lte(timeframe.endDate))
        );
      }

      if (templateId) {
        logs = logs.extend(Q.where('template_id', templateId));
      }

      // WatermelonDB requires Q.take() when using Q.skip(), and skip must come before take.
      if (limit) {
        logs = logs.extend(...(offset ? [Q.skip(offset)] : []), Q.take(limit));
      }

      return logs;
    };

    try {
      return await build().fetch();
    } catch (error) {
      const repaired = await this.retryAfterWorkoutRepair(error, () => build().fetch());
      if (repaired) {
        return repaired;
      }

      throw error;
    }
  }

  /**
   * Get completed workout logs by workout name (e.g. for AI context: past occurrences of the same workout).
   * Ordered by started_at desc (most recent first).
   */
  static async getWorkoutLogsByWorkoutName(
    workoutName: string,
    limit?: number
  ): Promise<WorkoutLog[]> {
    return this.getWorkoutLogsByWorkoutNameInternal(workoutName, limit);
  }

  private static async getWorkoutLogsByWorkoutNameInternal(
    workoutName: string,
    limit?: number,
    repairAttempted = false
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

    try {
      return await query.fetch();
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.getWorkoutLogsByWorkoutNameInternal(workoutName, limit, true)
        );

        if (repaired) {
          return repaired;
        }
      }

      throw error;
    }
  }

  /**
   * Get upcoming scheduled workouts for a specific date
   */
  static async getUpcomingScheduledWorkouts(date: Date): Promise<WorkoutTemplate[]> {
    const dayIndex = jsDayToWeekdayIndex(date.getDay());
    const resolved = await WorkoutPlanRepository.getResolvedSchedules();
    const templateIds = [
      ...new Set(
        resolved
          .filter((schedule) => schedule.dayIndex === dayIndex)
          .map((schedule) => schedule.templateId)
      ),
    ];

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
    return await this.completeWorkoutInternal(workoutLogId);
  }

  private static async completeWorkoutInternal(
    workoutLogId: string,
    repairAttempted = false
  ): Promise<{
    workoutLog: WorkoutLog;
    personalRecords: Awaited<ReturnType<typeof WorkoutAnalytics.detectPersonalRecords>>;
  }> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.completedAt) {
        throw new Error('Workout is already completed');
      }

      // Complete the workout (this calculates volume)
      const bodyWeightKg = await UserMetricService.getUserBodyWeightKgForVolume();
      await workoutLog.completeWorkout(bodyWeightKg);

      // Clear active workout from AsyncStorage
      const activeWorkoutLogId = await getActiveWorkoutLogId();
      if (activeWorkoutLogId === workoutLogId) {
        await clearActiveWorkoutLogId();
      }

      // Reload to get updated values
      const completedWorkout = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      // Calculate calories burned using MWEM (best-effort, never blocks completion)
      try {
        const totalKcal = await this.estimateWorkoutKcal(workoutLogId);
        if (totalKcal > 0) {
          await database.write(async () => {
            await completedWorkout.update((log) => {
              log.caloriesBurned = totalKcal;
            });
          });
        }
      } catch (err) {
        console.warn('MWEM calorie calculation failed:', err);
        handleError(err, 'WorkoutService.calculateMwemCalories');
      }

      // Detect personal records
      const personalRecords = await WorkoutAnalytics.detectPersonalRecords(completedWorkout);

      // Write to Health Connect if permission granted (best-effort, never fails workout completion)
      try {
        const units = await SettingsService.getUnits();
        const { sets, exercises } = await this.getWorkoutWithDetails(workoutLogId);
        const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
        const byExercise = new Map<string, EnrichedWorkoutLogSet[]>();
        for (const set of sets.filter(isPerformedWorkoutSet)) {
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
        handleError(err, 'WorkoutService.writeWorkoutToHealthConnect');
      }

      return {
        workoutLog: completedWorkout,
        personalRecords,
      };
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.completeWorkoutInternal(workoutLogId, true)
        );

        if (repaired) {
          return repaired;
        }
      }

      if (error instanceof Error) {
        throw new Error(`Failed to complete workout: ${error.message}`);
      }

      throw new Error('Failed to complete workout: Unknown error');
    }
  }

  /**
   * Update workout log feedback (exhaustion level, workout score and the session note). Call after user submits session feedback.
   */
  static async updateWorkoutLogFeedback(
    workoutLogId: string,
    feedback: { exhaustionLevel?: number; workoutScore?: number; notes?: string | null }
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
   * Uses the canonical snapshot adapter so every consumer sees the same DB projection.
   * Shared by getWorkoutWithDetails and reactive observable pipelines.
   */
  static buildEnrichedSetsFromRecords(
    logExercises: {
      id: string;
      exerciseId: string;
      supersetSlotId?: string;
      groupId?: string;
      notes?: string;
      progressionJson?: string;
    }[],
    rawSets: WorkoutLogSet[]
  ): EnrichedWorkoutLogSet[] {
    const logExerciseMap = new Map<
      string,
      {
        exerciseId: string;
        supersetSlotId?: string;
        groupId?: string;
        notes?: string;
        progressionJson?: string;
      }
    >();

    logExercises.forEach((le) => {
      logExerciseMap.set(le.id, {
        exerciseId: le.exerciseId,
        supersetSlotId: le.supersetSlotId,
        groupId: le.groupId,
        notes: le.notes,
        progressionJson: le.progressionJson,
      });
    });

    return rawSets.map((set) => {
      const snapshot = toWorkoutLogSetSnapshot(set);
      const logExercise = logExerciseMap.get(snapshot.logExerciseId);

      return {
        ...snapshot,
        isSkipped: snapshot.completionStatus === 'skipped',
        exerciseId: logExercise?.exerciseId ?? '',
        supersetSlotId: logExercise?.supersetSlotId,
        groupId: logExercise?.groupId,
        notes: logExercise?.notes,
        progressionJson: logExercise?.progressionJson,
        // Only a set still to be done carries its start explanation; once performed it is history.
        adjustment:
          (isPlannedWorkoutSet(snapshot)
            ? (parseSetPrescription(snapshot.prescriptionJson)?.intraAdjustment ??
              parseStartAdjustment(snapshot.adjustmentJson))
            : null) ?? undefined,
      };
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
    return this.getWorkoutWithDetailsInternal(workoutLogId);
  }

  private static async getWorkoutWithDetailsInternal(
    workoutLogId: string,
    repairAttempted = false
  ): Promise<{
    workoutLog: WorkoutLog;
    sets: EnrichedWorkoutLogSet[];
    exercises: Exercise[];
    logExercises: WorkoutLogExercise[];
  }> {
    try {
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
          supersetSlotId: le.supersetSlotId,
          groupId: le.groupId,
          notes: le.notes,
          // The session's rule copy: without it every refresh after a set read the exercise as
          // automatic and dropped the rule's badge and between-sets behaviour.
          progressionJson: le.progressionJson,
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
    } catch (error) {
      if (!repairAttempted) {
        const repaired = await this.retryAfterWorkoutRepair(error, () =>
          this.getWorkoutWithDetailsInternal(workoutLogId, true)
        );

        if (repaired) {
          return repaired;
        }
      }

      throw error;
    }
  }

  /**
   * Update multiple workout log sets (existing or new) and recompute parent workout totals
   * Separates new sets (create) from existing sets (update) based on isNew flag
   * Also handles deletion of removed sets
   */
  static async updateWorkoutSets(
    workoutLogId: string,
    updates: WorkoutSetUpdate[],
    deletedSetIds?: string[] // IDs of sets to delete
  ): Promise<{ workoutLogId: string; totalVolume: number }> {
    try {
      const deletionIds = [...new Set(deletedSetIds ?? [])];
      const existingUpdateIds = new Set<string>();
      const desiredGroupIdByExerciseId = new Map<string, string>();

      for (const update of updates) {
        assertValidWorkoutSetDifficultyLevel(update.difficultyLevel);
        if (
          update.completionStatus !== undefined &&
          !isWorkoutSetCompletionStatus(update.completionStatus)
        ) {
          throw new Error(`Invalid workout set completion status: ${update.completionStatus}`);
        }

        if (update.isNew && update.exerciseId.length === 0) {
          throw new Error('New workout sets require an exercise id');
        }

        if (!update.isNew) {
          if (existingUpdateIds.has(update.setId)) {
            throw new Error(`Workout set ${update.setId} appears more than once`);
          }

          existingUpdateIds.add(update.setId);
        } else if (update.groupId !== undefined) {
          const previousGroupId = desiredGroupIdByExerciseId.get(update.exerciseId);
          if (
            desiredGroupIdByExerciseId.has(update.exerciseId) &&
            previousGroupId !== update.groupId
          ) {
            throw new Error(`Conflicting group ids for exercise ${update.exerciseId}`);
          }

          desiredGroupIdByExerciseId.set(update.exerciseId, update.groupId);
        }
      }

      const overlappingSetId = deletionIds.find((setId) => existingUpdateIds.has(setId));
      if (overlappingSetId) {
        throw new Error(`Workout set ${overlappingSetId} cannot be updated and deleted together`);
      }

      const logSetsCollection = database.get<WorkoutLogSet>('workout_log_sets');
      const logExercisesCollection = database.get<WorkoutLogExercise>('workout_log_exercises');

      // Perform direct writes so we can edit sets even if the workout is marked completed.
      // This intentionally bypasses WorkoutLog.updateSet which prevents edits on completed workouts.
      const workoutLog = await database.write(async () => {
        const log = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
        if (log.deletedAt) {
          throw new Error('Workout log has been deleted');
        }

        const existingLogExercises = await logExercisesCollection
          .query(Q.where('workout_log_id', workoutLogId), Q.where('deleted_at', Q.eq(null)))
          .fetch();
        const logExerciseByExerciseId = new Map<string, WorkoutLogExercise>();
        existingLogExercises.forEach((le) => {
          logExerciseByExerciseId.set(le.exerciseId, le);
        });
        const logExerciseIds = new Set(existingLogExercises.map((record) => record.id));
        const setsToDelete: WorkoutLogSet[] = [];
        const existingSetById = new Map<string, WorkoutLogSet>();

        // Resolve every fallible lookup before preparing any model changes. A missing or
        // cross-workout id therefore aborts without leaving a model in prepared state.
        const updateSetIds = updates.filter((u) => !u.isNew).map((u) => u.setId);
        const setById = await fetchMapByIds<WorkoutLogSet>('workout_log_sets', 'id', [
          ...deletionIds,
          ...updateSetIds,
        ]);

        const requireSetInWorkout = (setId: string): WorkoutLogSet => {
          const set = setById.get(setId);
          if (!set) {
            throw new Error(`Workout set ${setId} not found`);
          }

          if (!logExerciseIds.has(set.logExerciseId)) {
            throw new Error(`Workout set ${setId} does not belong to workout ${workoutLogId}`);
          }

          return set;
        };

        for (const deletedId of deletionIds) {
          setsToDelete.push(requireSetInWorkout(deletedId));
        }

        for (const setId of updateSetIds) {
          existingSetById.set(setId, requireSetInWorkout(setId));
        }

        const now = Date.now();
        let maxExerciseOrder = existingLogExercises.reduce(
          (max, record) => Math.max(max, record.exerciseOrder ?? 0),
          0
        );
        const operations: Model[] = [];

        for (const setToDelete of setsToDelete) {
          operations.push(prepareSoftDelete(setToDelete, now));
        }

        for (const [exerciseId, groupId] of desiredGroupIdByExerciseId) {
          const logExercise = logExerciseByExerciseId.get(exerciseId);
          if (logExercise && logExercise.groupId !== groupId) {
            operations.push(
              logExercise.prepareUpdate((record) => {
                record.groupId = groupId;
                record.updatedAt = now;
              })
            );
          }
        }

        for (const update of updates) {
          if (update.isNew) {
            let logExercise = logExerciseByExerciseId.get(update.exerciseId);

            if (!logExercise) {
              maxExerciseOrder += 1;
              logExercise = logExercisesCollection.prepareCreate((record) => {
                record.workoutLogId = workoutLogId;
                record.exerciseId = update.exerciseId;
                record.exerciseOrder = maxExerciseOrder;
                record.groupId = desiredGroupIdByExerciseId.get(update.exerciseId);
                record.createdAt = now;
                record.updatedAt = now;
              });
              operations.push(logExercise);
              logExerciseByExerciseId.set(update.exerciseId, logExercise);
            }

            operations.push(
              logSetsCollection.prepareCreate((record) => {
                record.logExerciseId = logExercise.id;
                record.reps = update.reps ?? 0;
                record.weight = update.weight ?? 0;
                record.partials = update.partials ?? 0;
                record.restTimeAfter = update.restTimeAfter ?? 0;
                writeSetEffort(record, update.repsInReserve);
                record.difficultyLevel = update.difficultyLevel ?? undefined;
                record.completionStatus = update.completionStatus ?? 'performed';
                record.setType = update.setType ?? 'normal';
                record.setOrder = update.setOrder ?? 0;
                record.createdAt = now;
                record.updatedAt = now;
              })
            );
            continue;
          }

          const setModel = existingSetById.get(update.setId)!;
          operations.push(
            setModel.prepareUpdate((record) => {
              if (update.reps !== undefined) {
                record.reps = update.reps;
              }

              if (update.weight !== undefined) {
                record.weight = update.weight;
              }

              if (update.partials !== undefined) {
                record.partials = update.partials;
              }

              if (update.restTimeAfter !== undefined) {
                record.restTimeAfter = update.restTimeAfter;
              }

              if (update.repsInReserve !== undefined) {
                writeSetEffort(record, update.repsInReserve);
              }

              if (update.difficultyLevel !== undefined) {
                record.difficultyLevel = update.difficultyLevel ?? undefined;
              }

              if (update.completionStatus !== undefined) {
                record.completionStatus = update.completionStatus;
              }

              if (update.setType !== undefined) {
                record.setType = update.setType;
              }

              if (update.setOrder !== undefined) {
                record.setOrder = update.setOrder;
              }

              record.updatedAt = now;
            })
          );
        }

        if (operations.length > 0) {
          await database.batch(...operations);
        }

        return log;
      });

      if (deletionIds.length > 0) {
        void deleteBleDataPointsFiles(deletionIds).catch(() => {});
      }

      const bodyWeightKg = await UserMetricService.getUserBodyWeightKgForVolume();
      const finalTotal = await workoutLog.calculateVolume(bodyWeightKg);
      return { workoutLogId, totalVolume: finalTotal };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update workout sets: ${error.message}`);
      }

      throw new Error('Failed to update workout sets: Unknown error');
    }
  }

  /**
   * Update workout metadata (startedAt, completedAt)
   */
  static async updateWorkoutMetadata(
    workoutLogId: string,
    data: { startedAt?: number; completedAt?: number; timezone?: string }
  ): Promise<void> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.deletedAt) {
        throw new Error('Workout log has been deleted');
      }

      await database.write(async () => {
        await workoutLog.update((log) => {
          if (data.startedAt !== undefined) {
            log.startedAt = data.startedAt;
          }

          if (data.completedAt !== undefined) {
            log.completedAt = data.completedAt;
          }

          if (data.timezone !== undefined) {
            log.timezone = data.timezone;
          }

          log.updatedAt = Date.now();
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update workout metadata: ${error.message}`);
      }

      throw new Error('Failed to update workout metadata: Unknown error');
    }
  }

  /**
   * Reorder workout log exercises and update set_order for all sets.
   */
  static async reorderWorkoutLogExercises(
    workoutLogId: string,
    orderedLogExercises: { id: string; groupId?: string }[]
  ): Promise<void> {
    try {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);

      if (workoutLog.deletedAt) {
        throw new Error('Workout log has been deleted');
      }

      await database.write(async () => {
        const preparedUpdates: (WorkoutLogExercise | WorkoutLogSet)[] = [];

        const now = Date.now();

        const orderedIds = orderedLogExercises.map((e) => e.id);

        // Resolve every lookup before preparing any change: a caller naming an unknown
        // exercise must abort, not silently reorder the remaining ones and renumber their
        // sets against a list nobody asked for — and not leave half the list in prepared
        // state either, which is why the whole order is resolved before the first update.
        const logExercisesMap = await fetchMapByIds<WorkoutLogExercise>(
          'workout_log_exercises',
          'id',
          orderedIds
        );
        const resolvedOrder = orderedLogExercises.map(({ id, groupId }) => {
          const logEx = logExercisesMap.get(id);
          if (!logEx) {
            throw new Error(`Workout log exercise ${id} not found`);
          }

          return { groupId, logEx };
        });

        // Update WorkoutLogExercise orders
        resolvedOrder.forEach(({ groupId, logEx }, index) => {
          preparedUpdates.push(
            logEx.prepareUpdate((record) => {
              record.exerciseOrder = index + 1;
              record.groupId = groupId;
              record.updatedAt = now;
            })
          );
        });

        // Fetch all related sets in one batch, then group and sort them in memory.
        const allSets = await fetchByIds<WorkoutLogSet>(
          'workout_log_sets',
          'log_exercise_id',
          orderedIds,
          Q.where('deleted_at', Q.eq(null))
        );

        const setsByLogExId = new Map<string, WorkoutLogSet[]>();
        for (const set of allSets) {
          const sets = setsByLogExId.get(set.logExerciseId);
          if (sets) {
            sets.push(set);
          } else {
            setsByLogExId.set(set.logExerciseId, [set]);
          }
        }

        // Ensure sets are ordered by their original set_order asc
        for (const sets of setsByLogExId.values()) {
          sets.sort((a, b) => a.setOrder - b.setOrder);
        }

        // Update all WorkoutLogSet orders to match the new exercise order
        // assigning them sequentially
        let currentSetOrder = 1;
        for (const { id } of orderedLogExercises) {
          const sets = setsByLogExId.get(id) || [];
          for (const set of sets) {
            preparedUpdates.push(
              set.prepareUpdate((record) => {
                record.setOrder = currentSetOrder++;
                record.updatedAt = now;
              })
            );
          }
        }

        if (preparedUpdates.length > 0) {
          await database.batch(...preparedUpdates);
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to reorder workout log exercises: ${error.message}`);
      }

      throw new Error('Failed to reorder workout log exercises: Unknown error');
    }
  }

  /**
   * Volume of one exercise in each of the last `limit` sessions of the same workout up to and
   * including `workoutLogId`, oldest first. Only performed working sets count, like workout
   * volume. Empty when the log was not started from a template.
   */
  static async getExerciseVolumeHistory(
    workoutLogId: string,
    exerciseId: string,
    limit = 10
  ): Promise<{ id: string; date: number; volume: number }[]> {
    const current = await database.get<WorkoutLog>('workout_logs').find(workoutLogId);
    if (!current.templateId) {
      return [];
    }

    const logs = await this.getWorkoutLogsByTemplate(current.templateId, {
      timeframe: { startDate: 0, endDate: current.startedAt },
      limit,
    });

    const logExercises = await fetchByIds<WorkoutLogExercise>(
      'workout_log_exercises',
      'workout_log_id',
      logs.map((log) => log.id),
      Q.where('exercise_id', exerciseId),
      Q.where('deleted_at', Q.eq(null))
    );
    if (logExercises.length === 0) {
      return [];
    }

    const [sets, exercise, bodyWeightKg] = await Promise.all([
      fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        logExercises.map((le) => le.id),
        Q.where('deleted_at', Q.eq(null))
      ),
      database.get<Exercise>('exercises').find(exerciseId),
      UserMetricService.getUserBodyWeightKgForVolume(),
    ]);

    const logIdByLogExercise = new Map(logExercises.map((le) => [le.id, le.workoutLogId]));
    const setsByLog = new Map<string, WorkoutLogSet[]>();
    for (const set of sets.filter(isWorkingSet)) {
      const logId = logIdByLogExercise.get(set.logExerciseId);
      if (logId) {
        const logSets = setsByLog.get(logId) ?? [];
        logSets.push(set);
        setsByLog.set(logId, logSets);
      }
    }

    return logs
      .filter((log) => setsByLog.has(log.id))
      .map((log) => ({
        id: log.id,
        date: log.startedAt || log.completedAt || 0,
        volume: calculateExerciseVolume(setsByLog.get(log.id)!, exercise, bodyWeightKg),
      }));
  }

  /**
   * Completed sessions of a workout template, newest first. Takes the same date window and page
   * as `getWorkoutHistory`.
   */
  static async getWorkoutLogsByTemplate(
    templateId: string,
    options: Omit<CompletedLogsQuery, 'templateId'> = {}
  ): Promise<WorkoutLog[]> {
    return this.fetchCompletedLogs({ ...options, templateId });
  }

  /** Whether the template has been completed at least once. */
  static async hasCompletedSessions(templateId: string): Promise<boolean> {
    return (await this.getWorkoutLogsByTemplate(templateId, { limit: 1 })).length > 0;
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
    const deletedSetIds: string[] = [];

    await database.write(async (writer) => {
      const workoutLog = await database.get<WorkoutLog>('workout_logs').find(id);
      // Use callWriter to avoid nested writes since markAsDeleted is a @writer method
      await writer.callWriter(() => workoutLog.markAsDeleted());

      // Also soft-delete all associated log exercises and their sets
      const logExercises = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .query(Q.where('workout_log_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      const sets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        logExercises.map((logExercise) => logExercise.id),
        Q.where('deleted_at', Q.eq(null))
      );

      for (const set of sets) {
        deletedSetIds.push(set.id);
        await writer.callWriter(() => set.markAsDeleted());
      }

      for (const logExercise of logExercises) {
        await writer.callWriter(() => logExercise.markAsDeleted());
      }
    });

    void deleteBleDataPointsFiles(deletedSetIds).catch(() => {});
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
      const operations: Model[] = [];
      const originalSets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        originalLogExercises.map((row) => row.id),
        Q.where('deleted_at', Q.eq(null))
      );
      // fetchByIds chunks its queries, so order across the whole result here.
      originalSets.sort((a, b) => a.setOrder - b.setOrder);
      const setsByLogExerciseId = new Map<string, WorkoutLogSet[]>();
      for (const originalSet of originalSets) {
        const sets = setsByLogExerciseId.get(originalSet.logExerciseId);
        if (sets) {
          sets.push(originalSet);
        } else {
          setsByLogExerciseId.set(originalSet.logExerciseId, [originalSet]);
        }
      }

      const newLog = database.get<WorkoutLog>('workout_logs').prepareCreate((log) => {
        log.templateId = originalLog.templateId;
        log.workoutName = `${originalLog.workoutName} (Copy)`;
        log.type = originalLog.type;
        log.icon = originalLog.icon ?? undefined;
        log.startedAt = now;
        log.timezone = getCurrentTimezone();
        log.completedAt = undefined; // Not completed yet
        log.totalVolume = 0;
        log.exhaustionLevel = undefined;
        log.workoutScore = undefined;
        log.createdAt = now;
        log.updatedAt = now;
      });

      operations.push(newLog);
      // Copy all log exercises and their sets
      for (const originalLogExercise of originalLogExercises) {
        const newLogExercise = database
          .get<WorkoutLogExercise>('workout_log_exercises')
          .prepareCreate((le) => {
            le.workoutLogId = newLog.id;
            le.exerciseId = originalLogExercise.exerciseId;
            le.exerciseOrder = originalLogExercise.exerciseOrder;
            le.groupId = originalLogExercise.groupId;
            le.notes = originalLogExercise.notes;
            le.templateExerciseId = originalLogExercise.templateExerciseId;
            le.progressionJson = originalLogExercise.progressionJson;
            le.createdAt = now;
            le.updatedAt = now;
          });

        operations.push(newLogExercise);

        for (const originalSet of setsByLogExerciseId.get(originalLogExercise.id) ?? []) {
          operations.push(
            database.get<WorkoutLogSet>('workout_log_sets').prepareCreate((set) => {
              set.logExerciseId = newLogExercise.id;
              set.setOrder = originalSet.setOrder;
              set.reps = originalSet.reps;
              set.weight = originalSet.weight;
              set.partials = 0;
              set.restTimeAfter = originalSet.restTimeAfter;
              writeSetEffort(set, null);
              set.difficultyLevel = undefined;
              set.completionStatus = 'planned';
              set.setType = originalSet.setType ?? 'normal';
              set.createdAt = now;
              set.updatedAt = now;
            })
          );
        }
      }

      await database.batch(...operations);
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

    const bodyWeightKg = await UserMetricService.getUserBodyWeightKgForVolume();
    const entries = await Promise.all(
      logs.map(async (log) => ({ log, volume: await log.calculateVolume(bodyWeightKg) }))
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
