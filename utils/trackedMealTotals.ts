import { storedMealCarbs } from '@/utils/carbsConvention';
import type { TrackMealIngredient } from '@/utils/coachAI';

/** Totals of an estimate as the diary will store them, carbs with fiber included. */
export function trackedMealTotals(ingredients: readonly TrackMealIngredient[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
} {
  return ingredients.reduce(
    (totals, item) => ({
      calories: totals.calories + item.kcal,
      protein: totals.protein + item.protein,
      carbs: totals.carbs + storedMealCarbs(item),
      fat: totals.fat + item.fat,
      grams: totals.grams + (item.grams || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
  );
}
