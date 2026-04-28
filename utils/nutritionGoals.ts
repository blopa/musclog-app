import {
  type NutritionGoals,
  type NutritionGoalsInitialValues,
} from '@/components/modals/NutritionGoalsModal';
import { type EatingPhase, type NutritionGoal } from '@/database/models';

export function nutritionGoalToInitialValues(goal: NutritionGoal): NutritionGoalsInitialValues {
  return {
    totalCalories: goal.totalCalories,
    protein: goal.protein,
    carbs: goal.carbs,
    fats: goal.fats,
    fiber: goal.fiber,
    eatingPhase: goal.eatingPhase as EatingPhase,
    targetWeight: goal.targetWeight,
    targetBodyFat: goal.targetBodyFat,
    targetBMI: goal.targetBmi,
    targetFFMI: goal.targetFfmi,
    targetDate: goal.targetDate ?? null,
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
    targetWeight: goals.targetWeight ?? undefined,
    targetBodyFat: goals.targetBodyFat ?? undefined,
    targetBMI: goals.targetBMI ?? undefined,
    targetFFMI: goals.targetFFMI ?? undefined,
    targetDate: goals.targetDate ?? null,
  };
}
