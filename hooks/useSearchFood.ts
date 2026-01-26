import { useQuery } from '@tanstack/react-query';
import { OpenFoodFacts } from '@openfoodfacts/openfoodfacts-nodejs';
import { fetch } from 'expo/fetch';

export interface FoodProduct {
  id: string;
  name: string;
  brand?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal_serving'?: number;
  };
  serving_size?: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  _raw?: any;
}

const getClient = () => {
  return new OpenFoodFacts(fetch as any);
};

export function useFoodSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['food-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        return [];
      }

      // v2 API doesn't support text search, so we use the v1 search endpoint directly
      // https://world.openfoodfacts.org/cgi/search.pl?search_terms=chicken&json=1
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&json=1&page_size=20&fields=code,product_name,brands,generic_name,nutriments,serving_size,categories,image_url,image_small_url`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch from Open Food Facts');
      }

      const result = await response.json();

      if (!result.products || result.products.length === 0) {
        return [];
      }

      const products: FoodProduct[] = result.products
        .filter((product: any) => product.product_name)
        .map((product: any) => ({
          id: product.code || String(Math.random()),
          name: product.product_name || 'Unknown Product',
          brand: product.brands || product.generic_name || 'Generic',
          nutriments: product.nutriments,
          serving_size: product.serving_size,
          product_name: product.product_name,
          brands: product.brands,
          categories: product.categories,
          image_url: product.image_small_url || product.image_url,
          _raw: product,
        }));

      return products;
    },
    enabled: Boolean(searchTerm && searchTerm.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
  });
}

export function useProductDetails(barcode: string | null) {
  return useQuery({
    queryKey: ['product-details', barcode],
    queryFn: async () => {
      if (!barcode) {
        return null;
      }

      const client = getClient();
      const { data, error } = await client.getProductV3(barcode);

      if (error) {
        throw new Error('Failed to fetch product details');
      }

      return data;
    },
    enabled: Boolean(barcode),
    staleTime: 1000 * 60 * 10,
  });
}
