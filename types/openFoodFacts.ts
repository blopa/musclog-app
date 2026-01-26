export interface Nutriments {
  'energy-kcal'?: number;
  'energy-kcal_100g'?: number;
  proteins?: number;
  proteins_100g?: number;
  carbohydrates?: number;
  carbohydrates_100g?: number;
  fat?: number;
  fat_100g?: number;
  fiber?: number;
  fiber_100g?: number;
  sugars?: number;
  sugars_100g?: number;
  'saturated-fat'?: number;
  'saturated-fat_100g'?: number;
  sodium?: number;
  sodium_100g?: number;
  salt?: number;
  salt_100g?: number;
  [key: string]: number | undefined;
}

export interface FoodProduct {
  product_type: 'food' | 'beauty' | 'petfood' | 'product';
  nutriments?: Nutriments;
  product_name?: string;
  brands?: string;
  categories?: string;
  serving_size?: string;
  [key: string]: any;
}

export interface SuccessFoodProductState {
  status: 'success';
  product: FoodProduct & { nutriments: Nutriments };
}
