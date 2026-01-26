import { SuccessFoodProductState } from '../openFoodFacts';

// Type guard function to check if productDetails is a success state with food product and nutrition data
export const isSuccessFoodProductState = (state: any): state is SuccessFoodProductState => {
  return (
    state?.status === 'success' &&
    state?.product?.product_type === 'food' &&
    state?.product?.nutrition?.aggregated_set?.nutrients !== undefined
  );
};
