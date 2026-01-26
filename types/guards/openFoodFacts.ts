import { SuccessFoodProductState } from '../openFoodFacts';

// Type guard function to check if productDetails is a success state with food product and nutriments
export const isSuccessFoodProductState = (
  state: any
): state is SuccessFoodProductState => {
  return (
    state?.status === 'success' &&
    state?.product?.product_type === 'food' &&
    state?.product?.nutriments !== undefined
  );
};
