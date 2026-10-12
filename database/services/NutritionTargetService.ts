import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import type NutritionGoal from '@/database/models/NutritionGoal';
import type { NutritionTargetMode } from '@/database/models/NutritionGoal';
import type NutritionTargetPeriod from '@/database/models/NutritionTargetPeriod';
import { localDayStartMs } from '@/utils/calendarDate';
import { resolveDailyMacros, type ResolvedMacros } from '@/utils/dynamicNutritionTarget';

export type NutritionTargets = Pick<
  ResolvedMacros,
  'totalCalories' | 'protein' | 'carbs' | 'fats' | 'fiber'
>;
export type ResolvedNutritionTargets = NutritionTargets & {
  mode: NutritionTargetMode;
  effectiveFrom?: number;
  sourceReviewId?: string;
  isDynamic: boolean;
  usedEmpiricalData: boolean;
  tdee: number;
};
export const nutritionTargetMode = (
  goal: Pick<NutritionGoal, 'targetMode' | 'isDynamic'>
): NutritionTargetMode => goal.targetMode ?? (goal.isDynamic ? 'daily' : 'manual');
export const storedNutritionTargets = (goal: NutritionTargets): NutritionTargets => ({
  totalCalories: goal.totalCalories,
  protein: goal.protein,
  carbs: goal.carbs,
  fats: goal.fats,
  fiber: goal.fiber,
});

export class NutritionTargetService {
  static async resolve(
    goal: NutritionGoal,
    date: Date = new Date()
  ): Promise<ResolvedNutritionTargets> {
    const mode = nutritionTargetMode(goal);
    const day = localDayStartMs(date);
    const rows = await database
      .get<NutritionTargetPeriod>('nutrition_target_periods')
      .query(
        Q.where('nutrition_goal_id', goal.id),
        Q.where('effective_from', Q.lte(day)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('effective_from', Q.desc)
      )
      .fetch();
    const period = rows.find(
      (row) => row.effectiveFrom <= day && (row.effectiveUntil == null || row.effectiveUntil > day)
    );
    if (period) {
      return {
        ...storedNutritionTargets(period),
        mode: 'weekly',
        isDynamic: false,
        usedEmpiricalData: false,
        tdee: 0,
        effectiveFrom: period.effectiveFrom,
        sourceReviewId: period.sourceReviewId,
      };
    }
    if (mode === 'daily') {
      const calculated = await resolveDailyMacros(goal, date);
      return {
        ...storedNutritionTargets(goal),
        ...calculated,
        mode,
        isDynamic: true,
        usedEmpiricalData: calculated?.usedEmpiricalData ?? false,
        tdee: calculated?.tdee ?? 0,
      };
    }
    return {
      ...storedNutritionTargets(goal),
      mode,
      isDynamic: false,
      usedEmpiricalData: false,
      tdee: 0,
    };
  }

  static preparePeriod(
    goalId: string,
    targets: NutritionTargets,
    effectiveFrom: number,
    now: number,
    sourceReviewId?: string
  ): NutritionTargetPeriod {
    this.validateTargets(targets);
    return database
      .get<NutritionTargetPeriod>('nutrition_target_periods')
      .prepareCreate((record) => {
        record.nutritionGoalId = goalId;
        record.effectiveFrom = effectiveFrom;
        record.totalCalories = targets.totalCalories;
        record.protein = targets.protein;
        record.carbs = targets.carbs;
        record.fats = targets.fats;
        record.fiber = targets.fiber;
        record.sourceReviewId = sourceReviewId;
        record.createdAt = now;
        record.updatedAt = now;
      });
  }

  static validateTargets(targets: NutritionTargets): void {
    if (
      ![targets.totalCalories, targets.protein, targets.carbs, targets.fats, targets.fiber].every(
        (value) => Number.isFinite(value) && value >= 0
      ) ||
      targets.totalCalories <= 0
    ) {
      throw new Error('Invalid nutrition targets');
    }
  }
}
