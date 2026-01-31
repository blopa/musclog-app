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

// Type guard for successful food product state with nutrition data (V3 API)
export interface SuccessFoodProductState {
  status: 'success';
  product: ProductV3 & {
    product_type: 'food';
    // for fiber, do carbohydrates-total - carbohydrates
    nutriments: ProductV3['nutriments'];
  };
}
