import type { TrackMealIngredient, TrackMealResponse } from '@/utils/coachAI';
import { trackedMealTotals } from '@/utils/trackedMealTotals';

/** An estimated meal waiting for the person to confirm it. */
export type MealEstimateReview = {
  /** Totals as the diary will store them. */
  meal: ReturnType<typeof trackedMealTotals> & { name: string; type: string };
  ingredients: TrackMealIngredient[];
};

type Names = {
  /** The name the person gave, which wins over the model's. */
  name?: string;
  /** What a meal with no name at all is called. */
  fallback: string;
};

/** The review of an estimate, or null when it holds no ingredient. */
export function mealEstimateReview(
  result: TrackMealResponse | null,
  { name, fallback }: Names
): MealEstimateReview | null {
  const ingredients = result?.meals.flatMap((meal) => meal.ingredients) ?? [];
  if (!result || ingredients.length === 0) {
    return null;
  }

  return {
    meal: {
      ...trackedMealTotals(ingredients),
      name: name?.trim() || result.meals[0]?.mealName || result.meals[0]?.mealType || fallback,
      type: fallback,
    },
    ingredients,
  };
}
