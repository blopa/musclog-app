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

/**
 * OFF product name fields used by getProductName (aligned with OFF Data fields / API).
 * @see https://wiki.openfoodfacts.org/Data_fields
 * @see https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/
 * Localized: product_name_LANG, generic_name_LANG (e.g. product_name_en, generic_name_fr).
 */
export interface ProductNameFields {
  product_name?: string;
  product_name_en?: string;
  product_name_nl?: string;
  product_name_fr?: string;
  product_name_de?: string;
  abbreviated_product_name?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  categories?: string;
  lang?: string;
  [key: string]: string | undefined;
}

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
  // Allow flat nutriment keys from NUTRIMENT_PROPERTIES and any additional nutriments
  [key: string]: unknown;
}

// Type for v3 nutrition data structure
export interface V3Nutrient {
  value?: number;
  value_per_100g?: number;
  value_per_serving?: number;
  unit?: string;
  name?: string;
  id?: string;
}

export interface V3NutritionSet {
  [nutrientId: string]: V3Nutrient | number | string | undefined;
}

export interface V3Nutrition {
  aggregated_set?: V3NutritionSet;
  input_sets?: V3NutritionSet[];
  data_per_100g?: V3NutritionSet;
  data_per_serving?: V3NutritionSet;
}

// Type guard for successful food product state with nutrition data (V3 API)
export interface SuccessFoodProductState {
  status: 'success';
  product: ProductV3 & {
    product_type: 'food';
    // for fiber, do carbohydrates-total - carbohydrates
    nutriments?: ProductV3['nutriments'];
    nutriments_estimated?: ProductV3['nutriments'];
    nutrition?: V3Nutrition;
  };
}
