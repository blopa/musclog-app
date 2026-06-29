import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';

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
