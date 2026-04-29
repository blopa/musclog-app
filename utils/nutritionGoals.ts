import {
  type NutritionGoals,
  type NutritionGoalsInitialValues,
} from '@/components/modals/NutritionGoalsModal';
import { type EatingPhase, type NutritionGoal } from '@/database/models';
import { normalizeNutritionGoalTargetWeight } from '@/utils/nutritionGoalHelpers';

export function nutritionGoalToInitialValues(goal: NutritionGoal): NutritionGoalsInitialValues {
  return {
    totalCalories: goal.totalCalories,
    protein: goal.protein,
    carbs: goal.carbs,
    fats: goal.fats,
    fiber: goal.fiber,
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
    targetBodyFat: goals.targetBodyFat ?? null,
    targetBMI: goals.targetBMI ?? null,
    targetFFMI: goals.targetFFMI ?? null,
    targetDate: goals.targetDate ?? null,
    isDynamic: goals.isDynamic ?? false,
  };
}
