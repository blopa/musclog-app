import type { Product, ProductStateV3 } from '@openfoodfacts/openfoodfacts-nodejs';

export type { Product, ProductStateV3 as ProductState };

// Create a more specific type for food products with nutrition data
export interface FoodProductWithNutrition extends Product {
  product_type: 'food';
  nutrition: {
    aggregated_set?: {
      nutrients?: {
        'energy-kcal'?: { value?: number };
        proteins?: { value?: number };
        carbohydrates?: { value?: number };
        fat?: { value?: number };
        fiber?: { value?: number };
        sugars?: { value?: number };
        'saturated-fat'?: { value?: number };
        sodium?: { value?: number };
        salt?: { value?: number };
        [key: string]: { value?: number } | undefined;
      };
    };
  };
}

// Type for successful product state with nutrition data
export interface SuccessFoodProductState {
  status: 'success';
  product: FoodProductWithNutrition;
}

// Helper type for the nutrients we commonly use
export interface NutrientValues {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugars?: number;
  saturatedFat?: number;
  sodium?: number;
  salt?: number;
}

// Legacy types for backward compatibility during migration
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
