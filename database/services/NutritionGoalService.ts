import { Q } from '@nozbe/watermelondb';
import { endOfDay } from 'date-fns';

import { database } from '@/database';
import NutritionGoal, { type EatingPhase } from '@/database/models/NutritionGoal';
import { localDayKeyPlusCalendarDays, localDayStartFromUtcMs } from '@/utils/calendarDate';
import {
  isDynamicNutritionGoalValid,
  normalizeNutritionGoalTargetWeight,
} from '@/utils/nutritionGoalHelpers';
import { widgetEvents } from '@/utils/widgetEvents';

import { NutritionCheckinService } from './NutritionCheckinService';

function triggerWidgetUpdate(): void {
  widgetEvents.emitNutritionWidgetUpdate();
}

function assertValidDynamicGoal(goal: {
  isDynamic?: boolean;
  targetWeight?: number | null;
  targetDate?: number | null;
}): void {
  if (!isDynamicNutritionGoalValid(goal)) {
    throw new Error('Target weight and target date are required for dynamic goals.');
  }
}

export interface NutritionGoalInput {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  eatingPhase: EatingPhase;
  targetWeight?: number | null;
  targetBodyFat?: number;
  targetBMI?: number;
  targetFFMI?: number;
  targetDate?: number | null;
  isDynamic?: boolean;
}

export class NutritionGoalService {
  /**
   * Get the current nutrition goal (effective_until IS NULL).
   * If multiple exist, returns the most recently created one.
   */
  static async getCurrent(): Promise<NutritionGoal | null> {
    const rows = await database
      .get<NutritionGoal>('nutrition_goals')
      .query(
        Q.where('effective_until', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get the nutrition goal that was active on the given date (local timezone).
   * A goal is active on date D if created_at <= endOfDay(D) and
   * (effective_until === null || effective_until > endOfDay(D)).
   * Returns the latest such goal by created_at, or null if none.
   */
  static async getGoalForDate(date: Date): Promise<NutritionGoal | null> {
    const endOfDayTs = endOfDay(date).getTime();
    const rows = await database
      .get<NutritionGoal>('nutrition_goals')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('created_at', Q.lte(endOfDayTs)),
        Q.sortBy('created_at', Q.desc)
      )
      .fetch();
    const active = rows.find(
      (r) => r.effectiveUntil == null || (r.effectiveUntil != null && r.effectiveUntil > endOfDayTs)
    );
    return active ?? null;
  }

  /**
   * Save a new snapshot of goals. Supersedes all current goals (sets effective_until = now on each).
   */
  static async saveGoals(
    data: NutritionGoalInput,
    shouldDeleteCheckins = true
  ): Promise<NutritionGoal> {
    const normalizedTargetWeight = normalizeNutritionGoalTargetWeight(data.targetWeight);
    assertValidDynamicGoal({
      isDynamic: data.isDynamic,
      targetWeight: normalizedTargetWeight,
      targetDate: data.targetDate ?? null,
    });

    const now = Date.now();
    const supersededGoalIds: string[] = [];

    const newGoal = await database.write(async () => {
      const current = await database
        .get<NutritionGoal>('nutrition_goals')
        .query(Q.where('effective_until', Q.eq(null)), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const row of current) {
        supersededGoalIds.push(row.id);
        await row.update((r) => {
          r.effectiveUntil = now;
          r.updatedAt = now;
        });
      }

      const goal = await database.get<NutritionGoal>('nutrition_goals').create((r) => {
        r.totalCalories = data.totalCalories;
        r.protein = data.protein;
        r.carbs = data.carbs;
        r.fats = data.fats;
        r.fiber = data.fiber;
        r.eatingPhase = data.eatingPhase;
        r.targetWeight = normalizedTargetWeight ?? 0;
        r.targetBodyFat = data.targetBodyFat ?? null;
        r.targetBmi = data.targetBMI ?? null;
        r.targetFfmi = data.targetFFMI ?? null;
        r.targetDate = data.targetDate ?? null;
        r.isDynamic = data.isDynamic ?? false;
        r.effectiveUntil = null;
        r.createdAt = now;
        r.updatedAt = now;
      });

      triggerWidgetUpdate();

      return goal;
    });

    if (shouldDeleteCheckins) {
      // Soft-delete check-ins that belonged to the superseded goals. Run outside the
      // write block above to avoid nesting write transactions.
      for (const goalId of supersededGoalIds) {
        await NutritionCheckinService.deleteByGoalId(goalId);
      }
    }

    return newGoal;
  }

  /**
   * Get history of goals (for retrospective). Most recent first.
   */
  static async getHistory(limit?: number): Promise<NutritionGoal[]> {
    let query = database
      .get<NutritionGoal>('nutrition_goals')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
    if (limit != null) {
      query = query.extend(Q.take(limit));
    }
    return await query.fetch();
  }

  /**
   * Get goals history with pagination support (similar to WorkoutService.getWorkoutHistory).
   * Most recent first.
   */
  static async getGoalsHistory(limit?: number, offset?: number): Promise<NutritionGoal[]> {
    let query = database.get<NutritionGoal>('nutrition_goals').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('created_at', Q.desc) // Most recent first
    );

    // Apply pagination (same pattern as WorkoutService.getWorkoutHistory)
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
   * Update nutrition goal
   */
  static async updateGoal(
    id: string,
    updates: Partial<NutritionGoalInput>,
    shouldRecreateCheckins = false
  ): Promise<NutritionGoal> {
    const updatedGoal = await database.write(async () => {
      const goal = await database.get<NutritionGoal>('nutrition_goals').find(id);

      if (goal.deletedAt) {
        throw new Error('Cannot update deleted goal');
      }

      assertValidDynamicGoal({
        isDynamic: updates.isDynamic ?? goal.isDynamic,
        targetWeight:
          updates.targetWeight !== undefined
            ? normalizeNutritionGoalTargetWeight(updates.targetWeight)
            : normalizeNutritionGoalTargetWeight(goal.targetWeight),
        targetDate: updates.targetDate !== undefined ? updates.targetDate ?? null : goal.targetDate,
      });

      await goal.update((record) => {
        if (updates.totalCalories !== undefined) {
          record.totalCalories = updates.totalCalories;
        }

        if (updates.protein !== undefined) {
          record.protein = updates.protein;
        }

        if (updates.carbs !== undefined) {
          record.carbs = updates.carbs;
        }

        if (updates.fats !== undefined) {
          record.fats = updates.fats;
        }

        if (updates.fiber !== undefined) {
          record.fiber = updates.fiber;
        }

        if (updates.eatingPhase !== undefined) {
          record.eatingPhase = updates.eatingPhase;
        }

        if (updates.targetWeight !== undefined) {
          record.targetWeight = normalizeNutritionGoalTargetWeight(updates.targetWeight) ?? 0;
        }

        if (updates.targetBodyFat !== undefined) {
          record.targetBodyFat = updates.targetBodyFat;
        }

        if (updates.targetBMI !== undefined) {
          record.targetBmi = updates.targetBMI;
        }

        if (updates.targetFFMI !== undefined) {
          record.targetFfmi = updates.targetFFMI;
        }

        if (updates.targetDate !== undefined) {
          record.targetDate = updates.targetDate ?? null;
        }

        if (updates.isDynamic !== undefined) {
          record.isDynamic = updates.isDynamic;
        }

        record.updatedAt = Date.now();
      });

      triggerWidgetUpdate();

      return goal;
    });

    if (shouldRecreateCheckins) {
      await NutritionGoalService.regenerateCheckins(id);
    }

    return updatedGoal;
  }

  /**
   * Regenerate weekly check-ins for a specific goal.
   * Deletes existing check-ins and generates new ones based on the goal's
   * parameters and user metrics at the time the goal was created.
   */
  static async regenerateCheckins(goalId: string): Promise<void> {
    const goal = await database.get<NutritionGoal>('nutrition_goals').find(goalId);

    if (goal.deletedAt) {
      throw new Error('Cannot regenerate check-ins for a deleted goal');
    }

    // TODO: do not use dynamic import
    const { UserService } = require('./UserService');
    const user = await UserService.getCurrentUser();

    if (!user) {
      throw new Error('User profile not found. Please initialize your profile first.');
    }

    await NutritionCheckinService.deleteByGoalId(goalId);

    // Fetch metrics active at the time the goal was created
    const heightMetric = await database
      .get('user_metrics')
      .query(
        Q.where('type', 'height'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.lte(goal.createdAt)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    const weightMetric = await database
      .get('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.lte(goal.createdAt)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    const bodyFatMetric = await database
      .get('user_metrics')
      .query(
        Q.where('type', 'body_fat'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.lte(goal.createdAt)),
        Q.sortBy('date', Q.desc),
        Q.sortBy('updated_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    if (heightMetric.length > 0 && weightMetric.length > 0) {

      // TODO: do not use dynamic import
      const {
        calculateNutritionPlan,
        eatingPhaseToWeightGoal,
        generateWeeklyCheckins,
      } = require('../../utils/nutritionCalculator');
      const { storedWeightToKg, storedHeightToCm } = require('../../utils/unitConversion');

      const heightDecrypted = await (heightMetric[0] as any).getDecrypted();
      const weightDecrypted = await (weightMetric[0] as any).getDecrypted();
      const bodyFatDecrypted =
        bodyFatMetric.length > 0 ? await (bodyFatMetric[0] as any).getDecrypted() : null;

      const weightKg = storedWeightToKg(weightDecrypted.value, weightDecrypted.unit);
      const heightCm = storedHeightToCm(heightDecrypted.value, heightDecrypted.unit);

      const plan = calculateNutritionPlan({
        gender: user.gender,
        weightKg,
        heightCm,
        age: user.getAge(),
        activityLevel: user.activityLevel as any,
        weightGoal: eatingPhaseToWeightGoal(goal.eatingPhase),
        fitnessGoal: user.fitnessGoal,
        liftingExperience: user.liftingExperience,
        bodyFatPercent: bodyFatDecrypted?.value,
      });

      const checkins = generateWeeklyCheckins(
        plan,
        goal.createdAt,
        goal.targetDate ?? localDayKeyPlusCalendarDays(localDayStartFromUtcMs(goal.createdAt), 90),
        heightCm / 100,
        bodyFatDecrypted?.value ?? null
      );

      if (checkins.length > 0) {
        await NutritionCheckinService.createBatch(goalId, checkins);
      }
    }
  }

  /**
   * Insert a goal that started at a specific past (or present) date.
   * Finds the goal that was active during startDate, splits its period at startDate,
   * and creates the new goal with the correct effectiveUntil.
   */
  static async addGoalAtDate(data: NutritionGoalInput, startDate: number): Promise<NutritionGoal> {
    const normalizedTargetWeight = normalizeNutritionGoalTargetWeight(data.targetWeight);
    assertValidDynamicGoal({
      isDynamic: data.isDynamic,
      targetWeight: normalizedTargetWeight,
      targetDate: data.targetDate ?? null,
    });

    return await database.write(async () => {
      const now = Date.now();

      // All non-deleted goals, oldest first
      const allGoals = await database
        .get<NutritionGoal>('nutrition_goals')
        .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
        .fetch();

      // Find the goal whose active period includes startDate
      const prevGoal = allGoals.find(
        (g) =>
          g.createdAt <= startDate && (g.effectiveUntil == null || g.effectiveUntil > startDate)
      );

      // New goal inherits prevGoal's effectiveUntil
      const newEffectiveUntil = prevGoal?.effectiveUntil ?? null;

      // Truncate prevGoal's period at startDate
      if (prevGoal) {
        await prevGoal.update((r) => {
          r.effectiveUntil = startDate;
          r.updatedAt = now;
        });
      }

      return await database.get<NutritionGoal>('nutrition_goals').create((r) => {
        r.totalCalories = data.totalCalories;
        r.protein = data.protein;
        r.carbs = data.carbs;
        r.fats = data.fats;
        r.fiber = data.fiber;
        r.eatingPhase = data.eatingPhase;
        r.targetWeight = normalizedTargetWeight ?? 0;
        r.targetBodyFat = data.targetBodyFat ?? null;
        r.targetBmi = data.targetBMI ?? null;
        r.targetFfmi = data.targetFFMI ?? null;
        r.targetDate = data.targetDate ?? null;
        r.isDynamic = data.isDynamic ?? false;
        r.effectiveUntil = newEffectiveUntil;
        r.createdAt = startDate;
        r.updatedAt = now;
      });
    });
  }

  /**
   * Delete nutrition goal (soft delete).
   * If deleting the current goal (effectiveUntil == null), promotes the previous
   * goal to current by clearing its effectiveUntil.
   */
  static async deleteGoal(id: string): Promise<void> {
    await database.write(async () => {
      const goal = await database.get<NutritionGoal>('nutrition_goals').find(id);

      if (goal.effectiveUntil == null) {
        // This is the current goal — promote the previous one
        const previousGoals = await database
          .get<NutritionGoal>('nutrition_goals')
          .query(
            Q.where('deleted_at', Q.eq(null)),
            Q.where('created_at', Q.lt(goal.createdAt)),
            Q.sortBy('created_at', Q.desc),
            Q.take(1)
          )
          .fetch();

        if (previousGoals.length > 0) {
          await previousGoals[0].update((r) => {
            r.effectiveUntil = null;
            r.updatedAt = Date.now();
          });
        }
      }

      await goal.markAsDeleted();

      triggerWidgetUpdate();
    });
  }
}
