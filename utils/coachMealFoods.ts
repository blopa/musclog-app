import { FoodService } from '@/database/services/FoodService';
import { NutritionService } from '@/database/services/NutritionService';

import type { TrackMealIngredient } from './coachAI';
import {
  type FoodCandidate,
  limitFoodCandidates,
  matchNameOf,
  pickFoodMatch,
  searchTermsFor,
} from './localFoodPhoto';

/**
 * Foods this phone already has whose names or descriptions share a word with `name`, merged and
 * deduplicated and capped at `MAX_FOOD_CANDIDATES` (best candidates first, so the cap never changes
 * the match). A food whose numbers are per serving is left out: a match is scaled by grams from
 * per-100 g numbers.
 */
export async function candidateFoodsFor(name: string): Promise<FoodCandidate[]> {
  const byId = new Map<string, FoodCandidate>();
  for (const term of searchTermsFor(name)) {
    // The description is searched too: a foundation food's is its generic English name
    // ("Lettuce, leaf, green, raw") under a product-like `name`.
    for (const food of await FoodService.searchFoods(term, { includeDescription: true })) {
      if (food.nutritionBasis === 'per_serving') {
        continue;
      }

      byId.set(food.id, {
        id: food.id,
        name: food.name,
        ...(food.description ? { description: food.description } : {}),
        kcal: food.calories ?? 0,
        protein: food.protein ?? 0,
        carbs: food.carbs ?? 0,
        fat: food.fat ?? 0,
        fiber: food.fiber ?? 0,
      });
    }
  }

  return limitFoodCandidates(name, [...byId.values()]);
}

/**
 * Ingredients with no food id, looked up BY NAME in the foods this phone has (the person's own,
 * saved and foundation foods), whichever provider made the estimate: a model is offered only the
 * foundation foods, so the ids it claims miss almost everything the person actually eats. A match (`pickFoodMatch`: every significant word of the name or description, the
 * fewest extra words, a tie is no match) keeps the model's name and grams and takes that food's own
 * numbers scaled to the grams;
 * everything else is returned unchanged for the estimate request. The model's wording is kept so the
 * person reads their own language. Best effort: a failed lookup leaves every ingredient unmatched,
 * which only costs the estimate it would have saved.
 */
export async function matchIngredientsToOwnFoods(
  reportAiError: (error: unknown, context: string) => void,
  ingredients: readonly { name: string; grams: number; englishName?: string }[]
): Promise<{
  matched: TrackMealIngredient[];
  unmatched: { name: string; grams: number }[];
}> {
  const stubs: TrackMealIngredient[] = [];
  const unmatched: { name: string; grams: number }[] = [];

  try {
    for (const ingredient of ingredients) {
      const { name, grams } = ingredient;
      // Stored foods are named in English, the model's wording is in the person's language: the
      // English name (when it gave one) is what is compared, the person's wording is what is kept.
      const lookupName = matchNameOf(ingredient);
      const match = pickFoodMatch(lookupName, await candidateFoodsFor(lookupName));
      if (match) {
        stubs.push({ name, grams, foodId: match.id, kcal: 0, protein: 0, carbs: 0, fat: 0 });
      } else {
        unmatched.push({ name, grams });
      }
    }

    if (stubs.length === 0) {
      return { matched: [], unmatched };
    }

    const normalized = await NutritionService.normalizeAiMealIngredients(stubs);
    const matched = normalized.filter((ingredient) => ingredient.foodId);
    // An id the lookup dropped (the food vanished meanwhile) goes back to the estimate.
    for (const ingredient of normalized.filter((item) => !item.foodId)) {
      unmatched.push({ name: ingredient.name, grams: ingredient.grams });
    }

    return { matched, unmatched };
  } catch (error) {
    reportAiError(error, 'coachAI.matchIngredientsToOwnFoods');

    return {
      matched: [],
      unmatched: ingredients.map(({ name, grams }) => ({ name, grams })),
    };
  }
}
