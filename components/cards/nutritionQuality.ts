import type { FoodLabels } from '@/database/models/Food';

export type NutritionQualityScore = 'a' | 'b' | 'c' | 'd' | 'e';

export type NutritionQualityInput = {
  nutriScore?: string;
  ecoScore?: string;
  novaGroup?: number;
  labels?: FoodLabels;
};

const LABEL_KEYS: { key: keyof FoodLabels }[] = [
  { key: 'organic' },
  { key: 'vegan' },
  { key: 'vegetarian' },
  { key: 'palmOilFree' },
  { key: 'fairTrade' },
  { key: 'highProtein' },
  { key: 'highFiber' },
];

export function normalizeNutritionQualityScore(score?: string): NutritionQualityScore | undefined {
  if (typeof score !== 'string') {
    return undefined;
  }

  const normalized = score.trim().toLowerCase();
  return /^[a-e]$/.test(normalized) ? (normalized as NutritionQualityScore) : undefined;
}

export function isHighProteinFood(protein: number, calories: number): boolean {
  return protein > 0 && calories > 0 && protein * 10 >= calories;
}

export function isHighFiberFood(totalCarbs: number, dietaryFiber: number, calories: number) {
  // 1. Presence Check: Must contain at least *some* fiber.
  // (This also prevents division by zero in the ratio check below).
  if (dietaryFiber <= 0) {
    return false;
  }

  // 2. Caloric Cost Rule: Must provide at least 3 grams of fiber per 100 calories.
  // We use a fallback for 0 calorie items to prevent division by zero.
  const fiberPer100Cals = calories > 0 ? (dietaryFiber / calories) * 100 : dietaryFiber * 100;
  if (fiberPer100Cals < 3) {
    return false;
  }

  // 3. Carb Quality Rule: The ratio of total carbs to fiber must be 5:1 or better (lower).
  const carbToFiberRatio = totalCarbs / dietaryFiber;
  if (carbToFiberRatio > 5) {
    return false;
  }

  // If it survives, it is genuinely high-fiber!
  return true;
}

type ResolveNutritionLabelsInput = {
  labels?: FoodLabels;
  protein?: number;
  carbs?: number;
  fiber?: number;
  calories?: number;
};

export function resolveNutritionLabels({
  labels,
  protein,
  carbs,
  fiber,
  calories,
}: ResolveNutritionLabelsInput): FoodLabels | undefined {
  const computedHighProtein =
    protein != null && calories != null && isHighProteinFood(protein, calories);
  const computedHighFiber =
    carbs != null &&
    fiber != null &&
    calories != null &&
    isHighFiberFood(carbs, fiber, calories);

  if (!labels && !computedHighProtein && !computedHighFiber) {
    return undefined;
  }

  return {
    ...labels,
    highProtein: labels?.highProtein === true || computedHighProtein,
    highFiber: labels?.highFiber === true || computedHighFiber,
  };
}

export function hasNutritionQualityData({
  nutriScore,
  ecoScore,
  novaGroup,
  labels,
}: NutritionQualityInput): boolean {
  const hasScores =
    normalizeNutritionQualityScore(nutriScore) != null ||
    normalizeNutritionQualityScore(ecoScore) != null;
  const hasLabels = LABEL_KEYS.some(({ key }) => labels?.[key] === true);
  return hasScores || novaGroup != null || hasLabels;
}
