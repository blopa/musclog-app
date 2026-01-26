// Import types from Open Food Facts library
import type {
  Product as ProductV3,
  ProductStateV3,
  Product as ProductV2,
  SearchResult as V2SearchResult,
} from '@openfoodfacts/openfoodfacts-nodejs';

// Re-export the main types we need from the library
export type { ProductV3, ProductStateV3 as ProductState, ProductV2, V2SearchResult };

// Type for search results (using V2 types from the library)
export type SearchResultProduct = ProductV2;

// Type guard for successful food product state with nutrition data (V3 API)
export interface SuccessFoodProductState {
  status: 'success';
  product: ProductV3 & {
    product_type: 'food';
    nutrition?: {
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
  };
}
