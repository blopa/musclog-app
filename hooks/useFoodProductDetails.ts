import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import type { ProductState, SearchResultProduct } from '../types/openFoodFacts';
import { getProductName } from '../utils/openFoodFactsMapper';
import { useSettings } from './useSettings';

/**
 * WORKAROUND: We do not use @openfoodfacts/openfoodfacts-nodejs for product-by-barcode
 * on React Native because it hangs on Android.
 *
 * That client uses openapi-fetch, which calls fetch(new Request(url, init)). On Android,
 * expo/fetch does not handle the Request object correctly and the promise never resolves.
 * See: https://github.com/expo/expo/issues/43193 (and related Request/URL input handling).
 *
 * Once expo/fetch properly supports Request (and URL) input on Android, we can switch
 * back to: new OpenFoodFacts(fetch).getProductV3(barcode) and remove fetchProductByBarcode below.
 */
const OFF_API_BASE = 'https://world.openfoodfacts.org';
const PRODUCT_V3_PATH = '/api/v3/product';
const REQUEST_TIMEOUT_MS = 20_000;

type ProductV3Result =
  | { data: ProductState; error?: undefined }
  | { data?: undefined; error: { message: string } };

/** Response type for useFoodProductDetails (success, error, or null when disabled). */
export type ProductDetailsQueryData =
  | ProductState
  | { status: 'error'; error: { message: string } }
  | null;

async function fetchOFFProductByBarcode(barcode: string): Promise<ProductV3Result> {
  const url = `${OFF_API_BASE}${PRODUCT_V3_PATH}/${encodeURIComponent(barcode)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { error: { message: `HTTP ${res.status}` } };
    }

    const data = (await res.json()) as ProductState;
    return { data };
  } catch (e: unknown) {
    clearTimeout(timeoutId);
    const err = e as { name?: string };
    if (err?.name === 'AbortError') {
      return { error: { message: 'Request timed out' } };
    }

    return { error: { message: (e as Error)?.message ?? 'Network error' } };
  }
}

async function fetchUSDAProductByBarcode(barcode: string): Promise<any> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || 'UNz8iH6WoBaHG4mEdAklid1MZq7zSbPKJVfNUbZR';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=1&api_key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data.foods && data.foods.length > 0) {
      // Get full details for the first match
      return fetchUSDAProductById(data.foods[0].fdcId);
    }
    return null;
  } catch (e) {
    console.error('Error fetching from USDA by barcode:', e);
    return null;
  }
}

export async function fetchUSDAProductById(fdcId: string | number): Promise<any> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || 'UNz8iH6WoBaHG4mEdAklid1MZq7zSbPKJVfNUbZR';
  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Error fetching USDA product by ID:', e);
    return null;
  }
}

/** @deprecated */
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
        (product: SearchResultProduct) => getProductName(product)
      );

      return products;
    },
    enabled: Boolean(searchTerm && searchTerm.trim().length >= 2),
    staleTime: 1000 * 60 * 5,
  });
}

export function useFoodProductDetails(
  barcode: string | null,
  usdaId: string | number | null = null
) {
  const { foodSearchSource } = useSettings();

  return useQuery({
    queryKey: ['product-details', barcode, usdaId, foodSearchSource],
    queryFn: async (): Promise<ProductDetailsQueryData> => {
      if (usdaId) {
        const usdaData = await fetchUSDAProductById(usdaId);
        if (usdaData) {
          return {
            status: 'success',
            product: usdaData,
            source: 'usda',
          } as any;
        }
        return { status: 'failure' } as any;
      }

      if (!barcode) {
        return null;
      }

      const includeOpenFood = foodSearchSource === 'both' || foodSearchSource === 'openfood';
      const includeUSDA = foodSearchSource === 'both' || foodSearchSource === 'usda';

      if (includeOpenFood) {
        const result = await fetchOFFProductByBarcode(barcode);
        if (result.data && result.data.status === 'success') {
          return result.data;
        }

        // If only OFF is enabled, return the result (might be error or not found)
        if (!includeUSDA) {
          if (result.error) {
            return { status: 'error', error: result.error };
          }
          return result.data || null;
        }
      }

      if (includeUSDA) {
        const usdaData = await fetchUSDAProductByBarcode(barcode);
        if (usdaData) {
          // Wrap USDA data to match the expected structure as much as possible,
          // though FoodMealDetailsModal will need to handle it.
          // We mark it so the component knows it's USDA.
          return {
            status: 'success',
            product: usdaData,
            source: 'usda',
          } as any;
        }
      }

      return { status: 'failure', code: barcode } as any;
    },
    enabled: Boolean(barcode || usdaId),
    staleTime: 1000 * 60 * 10,
  });
}
