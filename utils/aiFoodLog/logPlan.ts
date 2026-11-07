import { totalCarbsForFoodSource } from '@/utils/carbsConvention';

import { type FoodLogFood, MEAL_NAME_MAX } from './contract';

/**
 * A food shaped for `NutritionService.normalizeAiMealIngredients` (which keys energy as `kcal`)
 * and for the review. `hasOwnMacros` remembers whether the file gave the numbers itself: a food
 * that only named a foundation `foodId` counts only while that id resolves.
 */
export type FoodLogIngredient = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  grams: number;
  foodId?: string;
  hasOwnMacros: boolean;
};

/** One food of a batch, in the shape `NutritionService.logCustomMealsBatch` takes. */
export type FoodLogBatchIngredient = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  grams: number;
  foodId?: string;
};

export type FoodLogTotals = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export function toIngredients(foods: readonly FoodLogFood[]): FoodLogIngredient[] {
  return foods.map((food) => ({
    name: food.name,
    kcal: food.calories ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fat: food.fat ?? 0,
    fiber: food.fiber ?? 0,
    grams: food.grams,
    ...(food.foodId ? { foodId: food.foodId } : {}),
    hasOwnMacros:
      food.calories !== undefined &&
      food.protein !== undefined &&
      food.carbs !== undefined &&
      food.fat !== undefined,
  }));
}

/**
 * Splits foods after the foundation lookup. `normalizeAiMealIngredients` drops the `foodId` of an
 * id it cannot find, which leaves a food with no id and, if the file gave none, zero macros:
 * logging that would record a 0 kcal food, so it is reported and left out instead.
 */
export function partitionResolved(ingredients: readonly FoodLogIngredient[]): {
  usable: FoodLogIngredient[];
  unresolved: FoodLogIngredient[];
} {
  const usable: FoodLogIngredient[] = [];
  const unresolved: FoodLogIngredient[] = [];
  for (const ingredient of ingredients) {
    if (ingredient.foodId || ingredient.hasOwnMacros) {
      usable.push(ingredient);
    } else {
      unresolved.push(ingredient);
    }
  }

  return { usable, unresolved };
}

/**
 * The carbs the diary will show for a food, which is the canonical total (fiber included). An
 * assistant's own numbers carry NET carbs and become that total exactly as `NutritionService`
 * stores them (`FOOD_SOURCE_CARBS_CONVENTION.ai`); a matched foundation food already holds the
 * total, so its fiber must not be added again.
 */
export function storedCarbs(ingredient: FoodLogIngredient): number {
  return ingredient.foodId
    ? ingredient.carbs
    : totalCarbsForFoodSource('ai', { carbs: ingredient.carbs, fiber: ingredient.fiber });
}

/**
 * What the review totals: energy and macros as they will appear in the diary once logged, so the
 * figures the person checks are the figures they get.
 */
export function sumIngredients(ingredients: readonly FoodLogIngredient[]): FoodLogTotals {
  return ingredients.reduce<FoodLogTotals>(
    (totals, ingredient) => ({
      kcal: totals.kcal + ingredient.kcal,
      protein: totals.protein + ingredient.protein,
      carbs: totals.carbs + storedCarbs(ingredient),
      fat: totals.fat + ingredient.fat,
      fiber: totals.fiber + ingredient.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

export function toBatchIngredients(
  ingredients: readonly FoodLogIngredient[]
): FoodLogBatchIngredient[] {
  return ingredients.map((ingredient) => ({
    name: ingredient.name,
    calories: ingredient.kcal,
    protein: ingredient.protein,
    carbs: ingredient.carbs,
    fat: ingredient.fat,
    fiber: ingredient.fiber,
    grams: ingredient.grams,
    ...(ingredient.foodId ? { foodId: ingredient.foodId } : {}),
  }));
}

/** Foods can only be one meal when there are at least two of them. */
export function canGroupFoods(count: number): boolean {
  return count >= 2;
}

export type FoodLogGrouping = { group: boolean; mealName: string };

/**
 * The assistant says "one meal" by naming it; the person can still turn that off in the review.
 * `foodCount` is the foods that survived the import, not the ones the file listed.
 */
export function defaultGrouping(foodCount: number, mealName?: string): FoodLogGrouping {
  return {
    group: canGroupFoods(foodCount) && Boolean(mealName),
    mealName: mealName ?? '',
  };
}

/** A name for a grouped meal the person left blank: its foods, trimmed to the name limit. */
function nameFromFoods(foods: readonly { name: string }[]): string {
  const joined = foods.map((food) => food.name).join(', ');
  return joined.length <= MEAL_NAME_MAX
    ? joined
    : `${joined.slice(0, MEAL_NAME_MAX - 1).trimEnd()}…`;
}

/**
 * Whether the foods are logged as one meal, and under what name. A single food, or a switch left
 * off, logs loose entries; a grouped meal always has a name.
 */
export function resolveGrouping(
  foods: readonly { name: string }[],
  { group, mealName }: FoodLogGrouping
): { grouped: false } | { grouped: true; loggedMealName: string } {
  if (!group || !canGroupFoods(foods.length)) {
    return { grouped: false };
  }

  const typed = mealName.trim().slice(0, MEAL_NAME_MAX);
  return { grouped: true, loggedMealName: typed || nameFromFoods(foods) };
}
