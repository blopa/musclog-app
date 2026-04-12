import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Exercise from '@/database/models/Exercise';
import ExerciseGoal, { type ExerciseGoalType } from '@/database/models/ExerciseGoal';

export interface ExerciseGoalInput {
  goalType: ExerciseGoalType;
  exerciseId?: string;
  exerciseNameSnapshot?: string;
  targetWeight?: number; // kg
  baseline1rm?: number; // kg
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
        record.notes = data.notes ?? null;
        record.effectiveUntil = null;
        record.createdAt = new Date(now);
        record.updatedAt = new Date(now);
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
        record.updatedAt = new Date();
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

  static async deleteGoal(id: string): Promise<void> {
    await database.write(async () => {
      const goal = await database.get<ExerciseGoal>('exercise_goals').find(id);

      const wasActive = goal.effectiveUntil === null;
      const goalCreatedAt = goal.createdAt.getTime();
      const goalType = goal.goalType;
      const exerciseId = goal.exerciseId;

      await goal.markAsDeleted();

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
            record.updatedAt = new Date();
          });
        }
      }
    });
  }
}
