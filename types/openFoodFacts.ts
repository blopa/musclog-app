// Import types from Open Food Facts library
import type {
  Product as ProductV2,
  Product as ProductV3,
  ProductStateV3,
  SearchResult as V2SearchResult,
} from '@openfoodfacts/openfoodfacts-nodejs';

// Re-export the main types we need from the library
export type { ProductStateV3 as ProductState, ProductV2, ProductV3, V2SearchResult };

// Type for search results (using V2 types from the library)
export type SearchResultProduct = ProductV2;

// Structured nutriments shape built by mapOpenFoodFactsProduct (not the raw API shape)
export interface MappedNutriments {
  macronutrients?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugars?: number;
    saturatedFat?: number;
    transFat?: number;
    polyunsaturatedFat?: number;
    monounsaturatedFat?: number;
    alcohol?: number;
  };
  vitamins?: {
    vitaminA?: number;
    vitaminC?: number;
    vitaminE?: number;
    vitaminK?: number;
  };
  minerals?: {
    calcium?: number;
    iron?: number;
    magnesium?: number;
    potassium?: number;
    zinc?: number;
    sodium?: number;
  };
  scores?: {
    nutritionScoreFr?: number;
    nutritionScoreUk?: number;
  };
  estimates?: {
    fruitsVegetablesNutsEstimate?: number;
    fruitsVegetablesLegumesEstimate?: number;
  };
  environmental?: {
    carbonFootprint?: number;
  };
  other?: {
    cholesterol?: number;
    caffeine?: number;
    salt?: number;
  };
  [key: string]: unknown; // allow flat nutriment keys from mapAllNutriments
  // TODO: maybe check the const NUTRIMENT_PROPERTIES?
}

// Type guard for successful food product state with nutrition data (V3 API)
export interface SuccessFoodProductState {
  status: 'success';
  product: ProductV3 & {
    product_type: 'food';
    // for fiber, do carbohydrates-total - carbohydrates
    nutriments: ProductV3['nutriments'];
    nutriments_estimated: ProductV3['nutriments'];
  };
}
