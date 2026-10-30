import type { MealType } from './NutritionLog';

/**
 * Where a copy or move puts each log's meal. A separate, WatermelonDB-free file (like
 * `muscleGroupFamily.ts`) so the service, the modal and tests can import the value without
 * loading the `NutritionLog` model class.
 */

/** Leave every log in the meal it is already in. */
export const KEEP_MEAL_TYPES = 'keep';

/** A concrete meal to move logs into, or {@link KEEP_MEAL_TYPES}. */
export type MealTypeTarget = MealType | typeof KEEP_MEAL_TYPES;
