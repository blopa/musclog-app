import { FoodService } from '@/database/services/FoodService';
import { MealService } from '@/database/services/MealService';
import { NutritionService } from '@/database/services/NutritionService';

import { aiIngredientMacrosPer100g } from './carbsConvention';
import type { GenerateMealPlanResponse, MacroEstimate, NutritionEntry } from './coachAI';
import { roundToDecimalPlaces } from './roundDecimal';

/**
 * Normalize macros by weight (convert to per-100g)
 */
export function normalizeMacrosByGrams(macros: MacroEstimate, grams: number): MacroEstimate {
  if (grams <= 0) {
    return macros;
  }

  const factor = 100 / grams;

  return {
    name: macros.name,
    kcal: Math.round(macros.kcal * factor),
    carbs: roundToDecimalPlaces(macros.carbs * factor),
    fat: roundToDecimalPlaces(macros.fat * factor),
    protein: roundToDecimalPlaces(macros.protein * factor),
    fiber: roundToDecimalPlaces(macros.fiber * factor),
    grams: 100,
    barcode: macros.barcode,
  };
}

/**
 * Merge duplicate foods from parsed nutrition (same name, same day)
 */
export function mergeDuplicateFoods(entries: NutritionEntry[]): NutritionEntry[] {
  const merged = new Map<string, NutritionEntry>();

  for (const entry of entries) {
    const key = `${entry.productTitle}-${entry.mealType}`;
    if (merged.has(key)) {
      const existing = merged.get(key)!;
      merged.set(key, {
        ...existing,
        calories: existing.calories + entry.calories,
        carbs: existing.carbs + entry.carbs,
        fat: existing.fat + entry.fat,
        protein: existing.protein + entry.protein,
        fiber: (existing.fiber ?? 0) + (entry.fiber ?? 0),
        sodium: (existing.sodium ?? 0) + (entry.sodium ?? 0),
        sugar: (existing.sugar ?? 0) + (entry.sugar ?? 0),
      });
    } else {
      merged.set(key, entry);
    }
  }

  return Array.from(merged.values());
}

/**
 * Validate nutrition entry values
 */
export function isValidNutritionEntry(entry: NutritionEntry): boolean {
  return !!(
    entry.productTitle &&
    entry.productTitle.trim().length > 0 &&
    entry.calories >= 0 &&
    entry.carbs >= 0 &&
    entry.fat >= 0 &&
    entry.protein >= 0 &&
    entry.mealType >= 1 &&
    entry.mealType <= 5
  );
}

/**
 * Convert meal type number to readable string
 */
export function mealTypeToString(mealType: number): string {
  const types: Record<number, string> = {
    1: 'Breakfast',
    2: 'Lunch',
    3: 'Dinner',
    4: 'Snack',
    5: 'Other',
  };
  return types[mealType] || 'Unknown';
}

/**
 * Calculate daily totals from nutrition entries
 */
export function calculateNutritionTotals(entries: NutritionEntry[]) {
  return {
    totalCalories: entries.reduce((sum, e) => sum + e.calories, 0),
    totalCarbs: entries.reduce((sum, e) => sum + e.carbs, 0),
    totalFat: entries.reduce((sum, e) => sum + e.fat, 0),
    totalProtein: entries.reduce((sum, e) => sum + e.protein, 0),
    totalFiber: entries.reduce((sum, e) => sum + (e.fiber ?? 0), 0),
    totalSodium: entries.reduce((sum, e) => sum + (e.sodium ?? 0), 0),
    totalSugar: entries.reduce((sum, e) => sum + (e.sugar ?? 0), 0),
  };
}

/**
 * Process generated meal plan response from AI
 * Creates new meal templates in the database
 */
export async function processMealPlanResponse(response: GenerateMealPlanResponse): Promise<{
  mealIds: string[];
  description: string;
  meals: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }[];
}> {
  try {
    const createdMealIds: string[] = [];
    const mealsData: {
      id: string;
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
    }[] = [];

    for (const aiMeal of response.meals) {
      const foodItems = [];
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFats = 0;

      // Normalize first: fill in real macros for any ingredient matched to a foundation food
      const normalizedIngredients = await NutritionService.normalizeAiMealIngredients(
        aiMeal.ingredients
      );

      for (const ingredient of normalizedIngredients) {
        // Reuse the existing food when the LLM matched a foundation food; create custom otherwise
        let foodId: string;
        if (ingredient.foodId) {
          foodId = ingredient.foodId;
        } else {
          // aiIngredientMacrosPer100g normalizes carbs from the LLM's net convention to total.
          const macros = aiIngredientMacrosPer100g(ingredient);
          const food = await FoodService.createCustomFood(ingredient.name, {
            calories: roundToDecimalPlaces(macros.calories),
            protein: roundToDecimalPlaces(macros.protein),
            carbs: roundToDecimalPlaces(macros.carbs),
            fat: roundToDecimalPlaces(macros.fat),
            fiber: roundToDecimalPlaces(macros.fiber),
          });
          foodId = food.id;
        }

        foodItems.push({
          foodId,
          amount: ingredient.grams,
        });

        totalCalories += ingredient.kcal;
        totalProtein += ingredient.protein;
        totalCarbs += ingredient.carbs;
        totalFats += ingredient.fat;
      }

      const mealName = `${aiMeal.name} (Day ${aiMeal.day})`;

      // Create the meal template
      const meal = await MealService.createMealFromFoods(
        mealName,
        foodItems,
        aiMeal.description,
        true
      );

      createdMealIds.push(meal.id);
      mealsData.push({
        id: meal.id,
        name: mealName,
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fats: Math.round(totalFats),
      });
    }

    return {
      mealIds: createdMealIds,
      description: response.description,
      meals: mealsData,
    };
  } catch (error) {
    console.error('[nutritionAI] Error processing meal plan:', error);
    throw error;
  }
}
