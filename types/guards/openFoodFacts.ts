import { MappedNutriments, SuccessFoodProductState } from '@/types/openFoodFacts';
import { getProductName } from '@/utils/productName';

/** Type guard for nutriments shaped by mapOpenFoodFactsProduct (has macronutrients, minerals, other). */
export function isMappedNutriments(n: unknown): n is MappedNutriments {
  return n != null && typeof n === 'object' && 'macronutrients' in n;
}

/** OFF API can return 'success' | 'success_with_warnings' | 'success_with_errors'; all indicate a found product. */
export const isSuccessStatus = (s: unknown) =>
  s === 'success' || s === 'success_with_warnings' || s === 'success_with_errors';

/** V3 API may use product.nutrition (aggregated_set/input_sets) instead of product.nutriments. */
const hasNutritionData = (p: unknown): boolean => {
  if (!p || typeof p !== 'object') {
    return false;
  }

  const obj = p as Record<string, unknown>;
  const nutrition = obj.nutrition;
  const inputSets =
    nutrition && typeof nutrition === 'object'
      ? (nutrition as Record<string, unknown>).input_sets
      : undefined;

  return (
    obj.nutriments !== undefined ||
    obj.nutriments_estimated !== undefined ||
    (nutrition !== null && typeof nutrition === 'object' && 'aggregated_set' in nutrition) ||
    (Array.isArray(inputSets) && inputSets.length > 0)
  );
};

export const isSuccessFoodDetailProductState = (
  state: unknown
): state is SuccessFoodProductState => {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const s = state as Record<string, unknown>;
  const { status, product } = s;
  if (!product) {
    return false;
  }

  const p = product as Record<string, unknown>;
  return (
    isSuccessStatus(status) &&
    (p.product_type === 'food' || p.product_type === undefined) &&
    (hasNutritionData(product) || getProductName(product).found)
  );
};
