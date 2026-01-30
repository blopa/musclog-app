import { SuccessFoodProductState } from '../openFoodFacts';

export const isSuccessFoodDetailProductState = (state: any): state is SuccessFoodProductState => {
  return (
    state?.status === 'success' &&
    state?.product?.product_type === 'food' &&
    state?.product?.nutriments !== undefined
  );
};
