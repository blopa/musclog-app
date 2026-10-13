import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import ExerciseGoal, { type ExerciseGoalType } from '@/database/models/ExerciseGoal';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { projectGoal, type ProjectionResult } from '@/utils/exerciseGoalProjection';
import { getCurrentTimezone } from '@/utils/timezone';

import { UserMetricService } from './UserMetricService';
import { UserService } from './UserService';
import { type ProgressiveOverloadDataPoint, WorkoutAnalytics } from './WorkoutAnalytics';

/** Everything `projectGoal` needs about a 1RM goal that has to be read from the database. */
export interface OneRmGoalInputs {
  dataPoints: ProgressiveOverloadDataPoint[];
  hasPerformed1RMDate: number | null;
  recentAverage1RM: number | null;
  bodyWeight: number;
  loadMultiplier: number;
  userGender: 'male' | 'female' | 'other';
}

/** A span of time whose training should not count as evidence (a deliberately lighter week). */
export type ExcludedWindow = { from: number; until: number };

/** How far back `getRecentFirstSetAverage1RM` looks. Keep in step with its default. */
const RECENT_AVERAGE_WEEKS = 2;

/**
 * Input for creating or updating an ExerciseGoal.
 * Note: All weight values (targetWeight, baseline1rm) must be provided in KILOGRAMS.
 * The UI layer is responsible for converting from/to Imperial units if necessary.
 */
export interface ExerciseGoalInput {
  goalType: ExerciseGoalType;
  exerciseId?: string;
  exerciseNameSnapshot?: string;
  targetWeight?: number; // Always in kg
  baseline1rm?: number; // Always in kg
  targetSessionsPerWeek?: number;
  targetStepsPerDay?: number;
  targetDistanceM?: number;
  targetDurationS?: number;
  targetPaceMsPerM?: number;
  targetDate?: string | null;
  notes?: string;
}

export class ExerciseGoalService {
  /**
   * Reads what the projection of a 1RM goal is built from. Shared by the goal screens and the
   * Weekly Review so the two cannot disagree about whether a lift is on pace.
   *
   * `excludeWindows` leaves deliberately light training out: its data points are dropped, and the
   * "recent average" shortcut is skipped when it would span one (it cannot be filtered by date).
   */
  static async load1rmGoalInputs(
    goal: ExerciseGoal,
    options: { excludeWindows?: readonly ExcludedWindow[] } = {}
  ): Promise<OneRmGoalInputs | null> {
    if (goal.goalType !== '1rm' || !goal.exerciseId) {
      return null;
    }
    const windows = options.excludeWindows ?? [];
    const [dataPoints, performed1RMDate, recentAverage, bodyWeight, exercise, user] =
      await Promise.all([
        WorkoutAnalytics.getProgressiveOverloadData(goal.exerciseId, {
          startDate: goal.createdAt,
          endDate: Date.now(),
        }),
        goal.targetWeight != null
          ? WorkoutAnalytics.getPerformed1RMDate(goal.exerciseId, goal.targetWeight, goal.createdAt)
          : Promise.resolve(null),
        WorkoutAnalytics.getRecentFirstSetAverage1RM(goal.exerciseId, RECENT_AVERAGE_WEEKS),
        UserMetricService.getUserBodyWeightKgForVolume(),
        database.get<Exercise>('exercises').find(goal.exerciseId),
        UserService.getCurrentUser(),
      ]);
    const recentSince = Date.now() - RECENT_AVERAGE_WEEKS * 7 * MS_PER_SOLAR_DAY;
    const recentSpansExcluded = windows.some((window) => window.until > recentSince);
    return {
      dataPoints: dataPoints.filter(
        (point) => !windows.some((window) => point.date >= window.from && point.date < window.until)
      ),
      hasPerformed1RMDate: performed1RMDate,
      recentAverage1RM: recentSpansExcluded ? null : (recentAverage?.average1RM ?? null),
      bodyWeight,
      loadMultiplier: exercise.loadMultiplier ?? 1.0,
      userGender: user?.gender ?? 'other',
    };
  }

  /** The projection of a 1RM goal, or null when it has no target or no baseline to measure from. */
  static project1rmGoal(
    goal: ExerciseGoal,
    inputs: OneRmGoalInputs,
    baseline1rm: number | null = goal.baseline1rm
  ): ProjectionResult | null {
    if (goal.goalType !== '1rm' || goal.targetWeight === null) {
      return null;
    }
    const effectiveBaseline =
      baseline1rm ?? (inputs.dataPoints.length > 0 ? inputs.dataPoints[0].estimated1RM : null);
    if (effectiveBaseline === null) {
      return null;
    }
    return projectGoal({
      dataPoints: inputs.dataPoints,
      baseline1rm: effectiveBaseline,
      targetWeight: goal.targetWeight,
      bodyWeight: inputs.bodyWeight,
      loadMultiplier: inputs.loadMultiplier,
      userGender: inputs.userGender,
      hasPerformed1RMDate: inputs.hasPerformed1RMDate,
      currentEstimated1RM: inputs.recentAverage1RM ?? undefined,
    });
  }

  /** Reads and projects in one go, for callers that have no use for the inputs themselves. */
  static async evaluate1rmGoal(
    goal: ExerciseGoal,
    options: { excludeWindows?: readonly ExcludedWindow[] } = {}
  ): Promise<ProjectionResult | null> {
    const inputs = await this.load1rmGoalInputs(goal, options);
    return inputs ? this.project1rmGoal(goal, inputs) : null;
  }

  /**
   * Get all active goals (effective_until IS NULL and not deleted)
   */
  static async getActiveGoals(): Promise<ExerciseGoal[]> {
    return await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
  }

  /**
   * Get the active workout consistency goal, if the user has one.
   */
  static async getActiveConsistencyGoal(): Promise<ExerciseGoal | null> {
    const goals = await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('goal_type', 'consistency'),
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    return goals[0] ?? null;
  }

  /**
   * Get active goal for a specific exercise + type combination
   */
  static async getActiveGoalForExercise(
    exerciseId: string,
    goalType: ExerciseGoalType
  ): Promise<ExerciseGoal | null> {
    const goals = await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('goal_type', goalType),
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.take(1)
      )
      .fetch();
    return goals[0] ?? null;
  }

  /**
   * Get paginated history (effective_until IS NOT NULL)
   */
  static async getGoalHistory(limit?: number, offset?: number): Promise<ExerciseGoal[]> {
    let query = database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('effective_until', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      );

    if (offset) {
      query = query.extend(Q.skip(offset));
    }
    if (limit) {
      query = query.extend(Q.take(limit));
    }

    return await query.fetch();
  }

  /**
   * Save a new goal. Automatically supersedes any existing active goal
   * for the same (exercise_id, goal_type) pair in a single transaction.
   */
  static async saveGoal(data: ExerciseGoalInput): Promise<ExerciseGoal> {
    const now = Date.now();

    // Read BEFORE entering the write block
    let existingGoalToSupersede: ExerciseGoal | null = null;
    let existingConsistencyGoals: ExerciseGoal[] = [];

    if (data.goalType === '1rm' && data.exerciseId) {
      existingGoalToSupersede = await this.getActiveGoalForExercise(data.exerciseId, '1rm');
    }

    if (data.goalType === 'consistency') {
      existingConsistencyGoals = await database
        .get<ExerciseGoal>('exercise_goals')
        .query(
          Q.where('goal_type', 'consistency'),
          Q.where('effective_until', Q.eq(null)),
          Q.where('deleted_at', Q.eq(null))
        )
        .fetch();
    }

    return await database.write(async () => {
      // Supersede old goals
      if (existingGoalToSupersede) {
        await existingGoalToSupersede.update((record) => {
          record.effectiveUntil = now;
          record.updatedAt = now;
        });
      }

      for (const goal of existingConsistencyGoals) {
        await goal.update((record) => {
          record.effectiveUntil = now;
          record.updatedAt = now;
        });
      }

      // Create new goal
      return await database.get<ExerciseGoal>('exercise_goals').create((record) => {
        record.exerciseId = data.exerciseId ?? null;
        record.exerciseNameSnapshot = data.exerciseNameSnapshot ?? null;
        record.goalType = data.goalType;
        record.targetWeight = data.targetWeight ?? null;
        record.baseline1rm = data.baseline1rm ?? null;
        record.targetSessionsPerWeek = data.targetSessionsPerWeek ?? null;
        record.targetStepsPerDay = data.targetStepsPerDay ?? null;
        record.targetDistanceM = data.targetDistanceM ?? null;
        record.targetDurationS = data.targetDurationS ?? null;
        record.targetPaceMsPerM = data.targetPaceMsPerM ?? null;
        record.targetDate = data.targetDate ?? null;
        record.timezone = getCurrentTimezone();
        record.notes = data.notes ?? null;
        record.effectiveUntil = null;
        record.createdAt = now;
        record.updatedAt = now;
      });
    });
  }

  /**
   * Update an existing goal. Does NOT modify baseline_1rm.
   */
  static async updateGoal(id: string, updates: Partial<ExerciseGoalInput>): Promise<ExerciseGoal> {
    return await database.write(async () => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);

      if (goal.deletedAt) {
        throw new Error('Cannot update deleted goal');
      }

      await goal.update((record) => {
        if (updates.targetWeight !== undefined) {
          record.targetWeight = updates.targetWeight;
        }
        if (updates.targetSessionsPerWeek !== undefined) {
          record.targetSessionsPerWeek = updates.targetSessionsPerWeek;
        }
        if (updates.targetDate !== undefined) {
          record.targetDate = updates.targetDate ?? null;
        }
        if (updates.notes !== undefined) {
          record.notes = updates.notes ?? null;
        }
        record.updatedAt = Date.now();
      });

      return goal;
    });
  }

  /**
   * Get active goal for a specific exercise (any goal type)
   */
  static async getActiveGoalsForExercise(exerciseId: string): Promise<ExerciseGoal[]> {
    return await database
      .get<ExerciseGoal>('exercise_goals')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();
  }

  /**
   * Update only the baseline 1RM for a goal.
   */
  static async updateBaseline1rm(id: string, baseline1rm: number): Promise<ExerciseGoal> {
    return await database.write(async () => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);
      if (goal.deletedAt) {
        throw new Error('Cannot update deleted goal');
      }
      await goal.update((record) => {
        record.baseline1rm = baseline1rm;
        record.updatedAt = Date.now();
      });
      return goal;
    });
  }

  static async deleteGoal(id: string): Promise<void> {
    await database.write(async (writer) => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);

      const wasActive = goal.effectiveUntil === null;
      const goalCreatedAt = goal.createdAt;
      const goalType = goal.goalType;
      const exerciseId = goal.exerciseId;

      // markAsDeleted is a @writer, so it has to join this transaction via callWriter
      // rather than nest a new one (which would stall the queue).
      await writer.callWriter(() => goal.markAsDeleted());

      // If this was an active goal, try to restore the previous one
      if (wasActive) {
        let query = database
          .get<ExerciseGoal>('exercise_goals')
          .query(
            Q.where('goal_type', goalType),
            Q.where('effective_until', Q.notEq(null)),
            Q.where('deleted_at', Q.eq(null)),
            Q.where('created_at', Q.lt(goalCreatedAt)),
            Q.sortBy('created_at', Q.desc),
            Q.take(1)
          );

        // For 1RM goals, also filter by exercise
        if (goalType === '1rm' && exerciseId) {
          query = database
            .get<ExerciseGoal>('exercise_goals')
            .query(
              Q.where('exercise_id', exerciseId),
              Q.where('goal_type', '1rm'),
              Q.where('effective_until', Q.notEq(null)),
              Q.where('deleted_at', Q.eq(null)),
              Q.where('created_at', Q.lt(goalCreatedAt)),
              Q.sortBy('created_at', Q.desc),
              Q.take(1)
            );
        }

        const previousGoals = await query.fetch();

        if (previousGoals.length > 0) {
          await previousGoals[0].update((record) => {
            record.effectiveUntil = null;
            record.updatedAt = Date.now();
          });
        }
      }
    });
  }
}
