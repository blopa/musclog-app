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
    ...macros,
    kcal: Math.round(macros.kcal * factor),
    kj: Math.round(macros.kj * factor),
    carbs: Math.round(macros.carbs * factor * 10) / 10,
    fat: Math.round(macros.fat * factor * 10) / 10,
    protein: Math.round(macros.protein * factor * 10) / 10,
    grams: 100,
  };
}

/**
 * Process parsed nutrition entries from AI for database storage
 * Maps meal type numbers to database format
 * Encrypts sensitive data if needed
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
  // TODO: Implement database storage with NutritionService
  // This is a placeholder for the structure

  return entries.map((entry) => ({
    foodTitle: entry.productTitle,
    calories: entry.calories,
    carbs: entry.carbs,
    fat: entry.fat,
    protein: entry.protein,
    mealType: entry.mealType, // 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack, 5=Other
    date,
    fiber: entry.fiber,
    sodium: entry.sodium,
    sugar: entry.sugar,
  }));
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
