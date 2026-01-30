import { SuccessFoodProductState } from '../openFoodFacts';

const isSuccessFoodProductState = (state: any) => {
  return (
    state?.status === 'success' &&
    state?.product?.product_type === 'food' &&
    state?.product?.nutriments !== undefined
  );
};

export const isSuccessFoodDetailProductState = (state: any): state is SuccessFoodProductState => {
  return isSuccessFoodProductState(state) && state?.product?.nutriments !== undefined;
};

export const isSuccessFoodSearchProductState = (state: any): state is SuccessFoodProductState => {
  return (
    isSuccessFoodProductState(state) &&
    state?.product?.nutrition?.aggregated_set?.nutrients !== undefined
  );
};
