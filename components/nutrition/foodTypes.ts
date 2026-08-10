import type { ShareSendTarget } from '@/components/modals/ShareOpticalSendModal';
import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import type { MealType } from '@/database/models/NutritionLog';

/**
 * Meal types in display order, with their translation keys. `snack` uses the plural
 * `snacks` key. Single source of truth — the diary's meal sections and the copy-day
 * preview both render from this, so their ordering can't drift apart.
 */
export const MEAL_TYPES: { type: MealType; titleKey: string }[] = [
  { type: 'breakfast', titleKey: 'food.meals.breakfast' },
  { type: 'lunch', titleKey: 'food.meals.lunch' },
  { type: 'dinner', titleKey: 'food.meals.dinner' },
  { type: 'snack', titleKey: 'food.meals.snacks' },
  { type: 'other', titleKey: 'food.meals.other' },
];

/** Full nutrient breakdown for a logged food / meal. */
export type NutrientTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  alcohol: number;
};

/** Macro-only subset used for card display and meal-group aggregation. */
export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** A nutrition log with its resolved relations (food, nutrients, display name). */
export type ResolvedLogEntry = {
  log: NutritionLog;
  food: Food | null;
  nutrients: NutrientTotals;
  gramWeight: number;
  displayName: string;
};

/** Logs that share a group_id, presented as a single named meal. */
export type MealGroup = {
  groupId: string;
  mealName: string;
  entries: ResolvedLogEntry[];
  totalNutrients: MacroTotals;
};

/**
 * Capture a named diary group as the meal the optical sender will turn into a saved recipe.
 *
 * Returns the sender's own `ShareSendTarget` rather than a local `{logs, name}` shape: the diary's
 * other send path (a whole meal section) builds that target inline, and two spellings of one
 * concept is how the two paths drift.
 */
export function mealGroupShareTarget(group: MealGroup): ShareSendTarget {
  return {
    kind: 'loggedMeal',
    logs: group.entries.map((entry) => entry.log),
    name: group.mealName,
  };
}

const EMPTY_MACROS: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
const EMPTY_NUTRIENTS: NutrientTotals = { ...EMPTY_MACROS, fiber: 0, alcohol: 0 };

/** Sum the full nutrient breakdown (incl. fiber/alcohol) across resolved log entries. */
export function sumNutrients(entries: ResolvedLogEntry[]): NutrientTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.nutrients.calories,
      protein: acc.protein + e.nutrients.protein,
      carbs: acc.carbs + e.nutrients.carbs,
      fat: acc.fat + e.nutrients.fat,
      fiber: acc.fiber + e.nutrients.fiber,
      alcohol: acc.alcohol + e.nutrients.alcohol,
    }),
    { ...EMPTY_NUTRIENTS }
  );
}

/** Sum macro values across resolved log entries. */
export function sumMacros(entries: ResolvedLogEntry[]): MacroTotals {
  const { calories, protein, carbs, fat } = sumNutrients(entries);
  return { calories, protein, carbs, fat };
}
