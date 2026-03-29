import { getProductName } from '../../utils/productName';
import { MappedNutriments, SuccessFoodProductState } from '../openFoodFacts';

/** Type guard for nutriments shaped by mapOpenFoodFactsProduct (has macronutrients, minerals, other). */
export function isMappedNutriments(n: unknown): n is MappedNutriments {
  return n != null && typeof n === 'object' && 'macronutrients' in n;
}

/** OFF API can return 'success' | 'success_with_warnings' | 'success_with_errors'; all indicate a found product. */
export const isSuccessStatus = (s: unknown) =>
  s === 'success' || s === 'success_with_warnings' || s === 'success_with_errors';

/** V3 API may use product.nutrition (aggregated_set/input_sets) instead of product.nutriments. */
const hasNutritionData = (p: any) =>
  p?.nutriments !== undefined ||
  p?.nutriments_estimated !== undefined ||
  p?.nutrition?.aggregated_set !== undefined ||
  (Array.isArray(p?.nutrition?.input_sets) && p.nutrition.input_sets.length > 0);

export const isSuccessFoodDetailProductState = (state: any): state is SuccessFoodProductState => {
  const status = state?.status;
  const product = state?.product;
  if (!product) {
    return false;
  }

  return (
    isSuccessStatus(status) &&
    (product.product_type === 'food' || product.product_type === undefined) &&
    (hasNutritionData(product) || getProductName(product).found)
  );
};
