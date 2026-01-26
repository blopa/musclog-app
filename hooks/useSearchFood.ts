import { useQuery } from '@tanstack/react-query';
import { OpenFoodFacts } from '@openfoodfacts/openfoodfacts-nodejs';
import { fetch } from 'expo/fetch';
import { SearchResultProduct } from '../types/openFoodFacts';

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

      const products: SearchResultProduct[] = result.products.filter(
        (product: SearchResultProduct) => product.product_name
      );

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
