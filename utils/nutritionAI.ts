import { Q } from '@nozbe/watermelondb';

import { database } from '../database';
import Food from '../database/models/Food';
import { FoodService, NutritionService } from '../database/services';
import type { MacroEstimate, NutritionEntry } from './coachAI';

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
    carbs: Math.round(macros.carbs * factor * 10) / 10,
    fat: Math.round(macros.fat * factor * 10) / 10,
    protein: Math.round(macros.protein * factor * 10) / 10,
    fiber: Math.round(macros.fiber * factor * 10) / 10,
    grams: 100,
    barcode: macros.barcode,
  };
}

const mapMealTypeToDb = (
  mealType: number
): 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other' => {
  switch (mealType) {
    case 1:
      return 'breakfast';
    case 2:
      return 'lunch';
    case 3:
      return 'dinner';
    case 4:
      return 'snack';
    case 5:
      return 'other';
    default:
      return 'other';
  }
};

/**
 * Process parsed nutrition entries from AI for database storage
 * Maps meal type numbers to database format
 * Creates or finds foods and logs them via NutritionService
 */
export async function processParsedNutritionEntries(
  entries: NutritionEntry[],
  date: Date
): Promise<
  {
    foodTitle: string;
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    mealType: number;
    date: Date;
    fiber?: number;
    sodium?: number;
    sugar?: number;
  }[]
> {
  // Map meal type numbers to database MealType strings

  const results = [];

  for (const entry of entries) {
    try {
      // Try to find existing food by name (exact match)
      let food: Food | null = null;
      try {
        const existingFoods = await database
          .get<Food>('foods')
          .query(Q.where('deleted_at', Q.eq(null)), Q.where('name', entry.productTitle))
          .fetch();
        food = existingFoods.length > 0 ? existingFoods[0] : null;
      } catch (error) {
        // Food not found, we'll create a new one
      }

      // Create new food if not found
      if (!food) {
        food = await FoodService.createCustomFood(entry.productTitle, {
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          sugar: entry.sugar,
          sodium: entry.sodium,
        });
      }

      // Log the food using NutritionService
      const mealType = mapMealTypeToDb(entry.mealType);
      await NutritionService.logFood(
        food.id,
        date,
        mealType,
        1, // Default amount of 1 serving
        undefined, // No specific portion
        undefined // No external ID
      );

      results.push({
        foodTitle: entry.productTitle,
        calories: entry.calories,
        carbs: entry.carbs,
        fat: entry.fat,
        protein: entry.protein,
        mealType: entry.mealType,
        date,
        fiber: entry.fiber,
        sodium: entry.sodium,
        sugar: entry.sugar,
      });
    } catch (error) {
      console.error('Error processing nutrition entry:', entry, error);
      // Continue with next entry even if one fails
    }
  }

  return results;
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
