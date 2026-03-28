import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';

import { isSuccessStatus } from '../types/guards/openFoodFacts';
import type { ProductState, SearchResultProduct } from '../types/openFoodFacts';
import { getProductName } from '../utils/openFoodFactsMapper';
import { useSettings } from './useSettings';

/**
 * Fires both fetch functions in parallel. Resolves with the first non-null result
 * and aborts the other request immediately. Rejects only if both return null.
 */
async function raceToSuccess(
  offFetch: (signal: AbortSignal) => Promise<ProductDetailsQueryData>,
  usdaFetch: (signal: AbortSignal) => Promise<ProductDetailsQueryData>
): Promise<ProductDetailsQueryData> {
  const offController = new AbortController();
  const usdaController = new AbortController();

  const wrap = (
    fn: (signal: AbortSignal) => Promise<ProductDetailsQueryData>,
    ownController: AbortController,
    otherController: AbortController
  ): Promise<ProductDetailsQueryData> =>
    fn(ownController.signal).then((value) => {
      if (value === null) {
        throw new Error('not a success');
      }

      otherController.abort();
      return value;
    });

  return Promise.any([
    wrap(offFetch, offController, usdaController),
    wrap(usdaFetch, usdaController, offController),
  ]);
}

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

export async function fetchOFFProductByBarcode(
  barcode: string,
  externalSignal?: AbortSignal
): Promise<ProductV3Result> {
  const url = `${OFF_API_BASE}${PRODUCT_V3_PATH}/${encodeURIComponent(barcode)}`;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Propagate external abort (e.g. from raceToSuccess) into the timeout controller
  externalSignal?.addEventListener('abort', () => timeoutController.abort(), { once: true });

  try {
    const res = await fetch(url, {
      signal: timeoutController.signal,
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

export async function fetchUSDAProductByBarcode(
  barcode: string,
  signal?: AbortSignal
): Promise<any> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || '';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=1&api_key=${apiKey}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.foods && data.foods.length > 0) {
      return data.foods[0];
    }

    return null;
  } catch (e) {
    console.error('Error fetching from USDA by barcode:', e);
    return null;
  }
}

export async function fetchMusclogProductByBarcode(
  barcode: string,
  signal?: AbortSignal
): Promise<any> {
  const url = `https://api.musclog.app/barcodes/${encodeURIComponent(barcode)}.json`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchUSDAProductById(fdcId: string | number): Promise<any> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || '';
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

      const includeOpenFood =
        foodSearchSource !== 'none' &&
        (foodSearchSource === 'both' || foodSearchSource === 'openfood');
      const includeUSDA =
        foodSearchSource !== 'none' && (foodSearchSource === 'both' || foodSearchSource === 'usda');
      const includeMusclog = foodSearchSource === 'musclog' || foodSearchSource === 'both';

      if (includeOpenFood && includeUSDA) {
        // Both/All sources: fire OFF+USDA in parallel, resolve with whichever succeeds first.
        // If both fail, try Musclog as a sequential fallback.
        let offUsdaResult: ProductDetailsQueryData | null = null;
        try {
          offUsdaResult = await raceToSuccess(
            async (signal) => {
              const result = await fetchOFFProductByBarcode(barcode, signal);
              return isSuccessStatus(result.data?.status) ? result.data! : null;
            },
            async (signal) => {
              const usdaData = await fetchUSDAProductByBarcode(barcode, signal);
              return usdaData
                ? ({ status: 'success', product: usdaData, source: 'usda' } as any)
                : null;
            }
          );
        } catch {
          // Both returned null/non-success — fall through to Musclog
        }

        if (offUsdaResult) {
          return offUsdaResult;
        }

        if (includeMusclog) {
          const musclogData = await fetchMusclogProductByBarcode(barcode);
          if (musclogData) {
            return { status: 'success', product: musclogData, source: 'musclog' } as any;
          }
        }

        return { status: 'failure', code: barcode } as any;
      }

      if (includeOpenFood) {
        const result = await fetchOFFProductByBarcode(barcode);
        if (result.error) {
          return { status: 'error', error: result.error };
        }

        return result.data || null;
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

      if (includeMusclog && foodSearchSource === 'musclog') {
        const musclogData = await fetchMusclogProductByBarcode(barcode);
        if (musclogData) {
          return { status: 'success', product: musclogData, source: 'musclog' } as any;
        }
      }

      return { status: 'failure', code: barcode } as any;
    },
    enabled: Boolean(barcode || usdaId),
    staleTime: 1000 * 60 * 10,
  });
}
