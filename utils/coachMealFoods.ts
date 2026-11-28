import { getEnglishFoundationFoodText } from '@/data/foundationFoodCatalogue';
import type Food from '@/database/models/Food';
import { FoodService } from '@/database/services/FoodService';
import { NutritionService } from '@/database/services/NutritionService';

import { reportAiError, type TrackMealIngredient } from './coachAI';
import {
  type FoodCandidate,
  matchNameOf,
  pickFoodMatch,
  searchSpellingsFor,
  searchTermsFor,
} from './localFoodPhoto';

function toFoodCandidate(food: Food): FoodCandidate | null {
  if (food.nutritionBasis === 'per_serving') {
    return null;
  }

  // A foundation food is stored in the first boot's language and compared in English.
  const { name, description } = getEnglishFoundationFoodText(food);

  return {
    id: food.id,
    name,
    ...(description ? { description } : {}),
    kcal: food.calories ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fat: food.fat ?? 0,
    fiber: food.fiber ?? 0,
  };
}

/**
 * Every food that can match an ingredient, fetched with the first word of `searchSpellingsFor` per
 * ingredient (the longest word, folded and with its accents). A match must carry every word of the
 * name, so it must carry that word too. The matches are a superset of every possible match when the
 * stored name carries the same accents as the lookup name, or none. A stored name with accents
 * looked up without them is not found, because the database search does not fold accents. No cut is
 * applied: a limit in name order could hide the right food, or cut one of two tied foods and turn a
 * tie (no match) into a confident match on the survivor.
 */
async function fetchCandidatesForTerms(terms: readonly string[]): Promise<FoodCandidate[]> {
  const uniqueTerms = [...new Set(terms.filter(Boolean))];
  if (uniqueTerms.length === 0) {
    return [];
  }

  // Without a limit the search returns every match of each term.
  const foods = await FoodService.searchFoodsByTerms(uniqueTerms, { includeDescription: true });

  const byId = new Map<string, FoodCandidate>();
  for (const food of foods) {
    const candidate = toFoodCandidate(food);
    if (candidate) {
      byId.set(candidate.id, candidate);
    }
  }

  return [...byId.values()];
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
  ingredients: readonly { name: string; grams: number; englishName?: string }[]
): Promise<{
  matched: TrackMealIngredient[];
  unmatched: { name: string; grams: number }[];
}> {
  const stubs: TrackMealIngredient[] = [];
  const unmatched: { name: string; grams: number }[] = [];

  try {
    const entries = ingredients.map((ingredient) => {
      // Stored foods are named in English, the model's wording is in the person's language: the
      // English name (when it gave one) is what is compared, the person's wording is what is kept.
      const lookupName = matchNameOf(ingredient);

      return { ingredient, lookupName, terms: searchTermsFor(lookupName) };
    });
    const candidates = await fetchCandidatesForTerms(
      entries.flatMap((entry) => searchSpellingsFor(entry.lookupName))
    );

    for (const { ingredient, lookupName, terms } of entries) {
      const { name, grams } = ingredient;
      const match = terms.length > 0 ? pickFoodMatch(lookupName, candidates) : null;
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
