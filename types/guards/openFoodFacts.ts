import { SuccessFoodProductState } from '../openFoodFacts';

/** OFF API can return 'success' | 'success_with_warnings' | 'success_with_errors'; all indicate a found product. */
const isSuccessStatus = (s: unknown) =>
  s === 'success' || s === 'success_with_warnings' || s === 'success_with_errors';

/** V3 API may use product.nutrition (aggregated_set/input_sets) instead of product.nutriments. */
const hasNutritionData = (p: any) =>
  p?.nutriments !== undefined ||
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
    (hasNutritionData(product) || product.product_name != null)
  );
};
