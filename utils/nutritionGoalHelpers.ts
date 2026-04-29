export type DynamicNutritionGoalShape = {
  isDynamic?: boolean | null;
  targetWeight?: number | null;
  targetDate?: number | null;
};

export function normalizeNutritionGoalTargetWeight(
  targetWeight: number | null | undefined
): number | null {
  return typeof targetWeight === 'number' && targetWeight > 0 ? targetWeight : null;
}

export function isDynamicNutritionGoalValid(
  goal: DynamicNutritionGoalShape | null | undefined
): boolean {
  if (!goal?.isDynamic) {
    return true;
  }

  return (
    normalizeNutritionGoalTargetWeight(goal.targetWeight) != null &&
    goal.targetDate != null
  );
}
