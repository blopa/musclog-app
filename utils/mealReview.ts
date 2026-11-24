// Applying a review of a meal estimate. Pure and relative-import-only. A second look at a meal
// (with the description or photo) answers two things: what was eaten but is not listed, and which
// portions look wrong. Code applies the portions (scaling the numbers by the gram ratio) and hands
// back what to estimate; a figure the model gives for an ingredient is never taken as it is.

import type { TrackedMeal, TrackMealIngredient } from './coachAI';
import { normalizeIngredientName } from './mealConsensus';

/** `englishName` is the plain English name of a missing ingredient, used only to find it among the stored foods. */
export type MealReviewItem = { name: string; grams: number; englishName?: string };

export type MealReview = {
  missingIngredients?: MealReviewItem[];
  corrections?: MealReviewItem[];
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

const isUsable = (item: MealReviewItem | null | undefined): item is MealReviewItem =>
  Boolean(item) &&
  typeof item!.name === 'string' &&
  normalizeIngredientName(item!.name).length > 0 &&
  typeof item!.grams === 'number' &&
  Number.isFinite(item!.grams) &&
  item!.grams > 0;

function scaled(ingredient: TrackMealIngredient, grams: number): TrackMealIngredient {
  if (ingredient.grams <= 0) {
    return { ...ingredient, grams };
  }

  const ratio = grams / ingredient.grams;

  return {
    ...ingredient,
    grams: round1(grams),
    kcal: round1(ingredient.kcal * ratio),
    protein: round1(ingredient.protein * ratio),
    carbs: round1(ingredient.carbs * ratio),
    fat: round1(ingredient.fat * ratio),
    ...(ingredient.fiber == null ? {} : { fiber: round1(ingredient.fiber * ratio) }),
  };
}

/**
 * The meal with its corrected portions, and the ingredients the review says are missing (name and
 * grams only, to be estimated). A correction that names no listed ingredient, or gives grams that
 * are not a positive number, is ignored; so is a "missing" ingredient the meal already lists.
 */
export function applyMealReview(
  meal: TrackedMeal,
  review: MealReview | null | undefined
): { meal: TrackedMeal; added: MealReviewItem[] } {
  const corrections = new Map<string, number>();
  for (const item of review?.corrections ?? []) {
    if (isUsable(item)) {
      corrections.set(normalizeIngredientName(item.name), item.grams);
    }
  }

  const listed = new Set(meal.ingredients.map(({ name }) => normalizeIngredientName(name)));
  const added: MealReviewItem[] = [];
  for (const item of review?.missingIngredients ?? []) {
    const key = isUsable(item) ? normalizeIngredientName(item.name) : '';
    if (key && !listed.has(key)) {
      listed.add(key);
      const englishName = typeof item.englishName === 'string' ? item.englishName.trim() : '';
      added.push({
        name: item.name.trim(),
        grams: item.grams,
        ...(englishName ? { englishName } : {}),
      });
    }
  }

  return {
    meal: {
      ...meal,
      ingredients: meal.ingredients.map((ingredient) => {
        const grams = corrections.get(normalizeIngredientName(ingredient.name));

        return grams == null ? ingredient : scaled(ingredient, grams);
      }),
    },
    added,
  };
}
