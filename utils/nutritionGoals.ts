import {
  type NutritionGoals,
  type NutritionGoalsInitialValues,
} from '@/components/modals/NutritionGoalsModal';
import { type EatingPhase, type NutritionGoal } from '@/database/models';
import type { ResolvedMacros } from '@/utils/dynamicNutritionTarget';
import { normalizeNutritionGoalTargetWeight } from '@/utils/nutritionGoalHelpers';

export function nutritionGoalToInitialValues(
  goal: NutritionGoal,
  resolvedMacros?: ResolvedMacros | null
): NutritionGoalsInitialValues {
  return {
    totalCalories: resolvedMacros?.totalCalories ?? goal.totalCalories,
    protein: resolvedMacros?.protein ?? goal.protein,
    carbs: resolvedMacros?.carbs ?? goal.carbs,
    fats: resolvedMacros?.fats ?? goal.fats,
    fiber: resolvedMacros?.fiber ?? goal.fiber,
    eatingPhase: goal.eatingPhase as EatingPhase,
    targetWeight: normalizeNutritionGoalTargetWeight(goal.targetWeight),
    targetBodyFat: goal.targetBodyFat,
    targetBMI: goal.targetBmi,
    targetFFMI: goal.targetFfmi,
    targetDate: goal.targetDate ?? null,
    goalStartDate: goal.createdAt,
    isDynamic: goal.isDynamic ?? false,
  };
}

export function nutritionGoalsToInput(goals: NutritionGoals) {
  return {
    totalCalories: goals.totalCalories,
    protein: goals.protein,
    carbs: goals.carbs,
    fats: goals.fats,
    fiber: goals.fiber,
    eatingPhase: goals.eatingPhase,
    targetWeight: normalizeNutritionGoalTargetWeight(goals.targetWeight),
    targetBodyFat: goals.targetBodyFat ?? undefined,
    targetBMI: goals.targetBMI ?? undefined,
    targetFFMI: goals.targetFFMI ?? undefined,
    targetDate: goals.targetDate ?? null,
    isDynamic: goals.isDynamic ?? false,
  };
}
