import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MappedNutriments,
  SearchResultProduct,
  SuccessFoodProductState,
} from '../types/openFoodFacts';
import { resolveRoundedPer100gCaloriesForDisplay } from '../utils/inferCaloriesFromMacros';
import { getNutrimentsWithFallback, mapOpenFoodFactsProduct } from '../utils/openFoodFactsMapper';
import { getProductName } from '../utils/productName';
import { gramsToDisplay } from '../utils/unitConversion';
import { getMassUnit, getMassUnitI18nKey } from '../utils/units';
import { mapUSDAFoodToUnified } from '../utils/usdaMapper';
import { useFoods } from './useFoods';
import { useSettings } from './useSettings';

// Unified search result type
export type UnifiedFoodResult = {
  id: string;
  name: string;
  description: string;
  brand?: string;
  imageUrl?: string;
  serving_size?: string;
  nutriments?: SuccessFoodProductState['product']['nutriments'] | MappedNutriments;
  nutriments_estimated?: SuccessFoodProductState['product']['nutriments'] | MappedNutriments;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  source: 'local' | 'openfood' | 'usda' | 'foundation';
  _raw?: any; // Original data from API or database
};

// Hook parameters
export interface UseUnifiedFoodSearchProps {
  searchTerm: string;
  enabled?: boolean;
  includeLocal?: boolean;
  includeAPI?: boolean;
  localLimit?: number;
  apiLimit?: number;
  usdaLimit?: number;
  debounceMs?: number;
}

export function useUnifiedFoodSearch({
  searchTerm,
  enabled = true,
  includeLocal = true,
  includeAPI = true,
  localLimit = 10,
  apiLimit = 20,
  usdaLimit = 20,
  debounceMs = 300,
}: UseUnifiedFoodSearchProps) {
  const { t } = useTranslation();
  const { units, foodSearchSource } = useSettings();
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [apiCompleted, setApiCompleted] = useState(false);
  const [firstResolvedApi, setFirstResolvedApi] = useState<'openfood' | 'usda' | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevDebouncedRef = useRef(searchTerm.trim());

  // API pagination states
  const [apiOffset, setApiOffset] = useState(0);
  const [isLoadingMoreAPI, setIsLoadingMoreAPI] = useState(false);
  const [accumulatedApiResults, setAccumulatedApiResults] = useState<SearchResultProduct[]>([]);

  // USDA API states
  const [usdaOffset, setUsdaOffset] = useState(0);
  const [isLoadingMoreUSDA, setIsLoadingMoreUSDA] = useState(false);
  const [accumulatedUsdaResults, setAccumulatedUsdaResults] = useState<any[]>([]);
  const [usdaCompleted, setUsdaCompleted] = useState(false);

  const includeOpenFood =
    foodSearchSource !== 'none' && (foodSearchSource === 'both' || foodSearchSource === 'openfood');
  const includeUSDA =
    foodSearchSource !== 'none' && (foodSearchSource === 'both' || foodSearchSource === 'usda');

  // Debounce search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      prevDebouncedRef.current = '';
      setDebouncedSearchTerm('');
      setApiCompleted(false);
      setUsdaCompleted(false);
      setFirstResolvedApi(null);
      setApiOffset(0);
      setUsdaOffset(0);
      setAccumulatedApiResults([]);
      setAccumulatedUsdaResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      const didChange = trimmed !== prevDebouncedRef.current;
      prevDebouncedRef.current = trimmed;
      setDebouncedSearchTerm(trimmed);

      if (didChange) {
        setApiCompleted(false);
        setUsdaCompleted(false);
        setFirstResolvedApi(null);
        setApiOffset(0);
        setUsdaOffset(0);
        setAccumulatedApiResults([]);
        setAccumulatedUsdaResults([]);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Local database search - using built-in pagination from useFoods
  const {
    foods: localFoods,
    isLoading: isLoadingLocal,
    loadMore: loadMoreFoods,
    hasMore: hasMoreFoods,
    isLoadingMore: isLoadingMoreFoods,
  } = useFoods({
    mode: 'search',
    searchTerm: includeLocal ? debouncedSearchTerm : '',
    visible: enabled && includeLocal,
    enableReactivity: true,
    initialLimit: localLimit,
    batchSize: localLimit,
  });

  // API search using existing hook logic - with pagination
  const {
    data: apiPageResults = [],
    isLoading: isLoadingAPI,
    error: apiError,
    isSuccess: isApiSuccess,
    refetch: retryAPI,
  } = useQuery({
    queryKey: ['food-search-api', debouncedSearchTerm, apiOffset],
    queryFn: async () => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        if (!includeAPI || !debouncedSearchTerm || debouncedSearchTerm.length < 2) {
          return [];
        }

        // Languages supported by OFF with significant product data.
        // Full taxonomy: https://github.com/openfoodfacts/openfoodfacts-server/blob/645053e9b62ac25b23e061d522de950309be2c4b/taxonomies/languages.txt
        const supportedLangs = [
          'ar',
          'bg',
          'bn',
          'ca',
          'cs',
          'da',
          'de',
          'el',
          'en',
          'es',
          'et',
          'fa',
          'fi',
          'fr',
          'he',
          'hr',
          'hu',
          'hy',
          'id',
          'it',
          'ja',
          'ka',
          'kk',
          'ko',
          'lt',
          'lv',
          'mk',
          'ms',
          'nb',
          'nl',
          'pl',
          'pt',
          'ro',
          'ru',
          'sk',
          'sl',
          'sq',
          'sr',
          'sv',
          'ta',
          'th',
          'tr',
          'uk',
          'ur',
          'uz',
          'vi',
          'xx',
          'zh',
        ];

        const localizedFields = supportedLangs
          .flatMap((lang) => [`product_name_${lang}`, `generic_name_${lang}`])
          .join(',');

        // v2 API doesn't support text search, so we use the v1 search endpoint directly
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(debouncedSearchTerm)}&json=1&page_size=${apiLimit}&page=${Math.floor(apiOffset / apiLimit) + 1}&fields=code,product_name,brands,generic_name,nutriments,serving_size,categories,image_url,image_small_url,${localizedFields}`;

        const response = await fetch(url, { signal: abortController.signal });

        if (!response.ok) {
          throw new Error('Failed to fetch from Open Food Facts');
        }

        const result = await response.json();

        if (!result.products || result.products.length === 0) {
          return [];
        }

        const products: SearchResultProduct[] = result.products.filter(
          (product: SearchResultProduct) => getProductName(product).found
        );

        return products;
      } catch (error) {
        // Don't throw error for aborted requests
        if (error instanceof Error && error.name === 'AbortError') {
          return [];
        }
        throw error;
      } finally {
        // Clean up abort controller if this is the current request
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    enabled:
      enabled &&
      includeAPI &&
      includeOpenFood &&
      Boolean(debouncedSearchTerm && debouncedSearchTerm.length >= 2),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // USDA search
  const {
    data: usdaPageResults = [],
    isLoading: isLoadingUSDA,
    error: usdaError,
    isSuccess: isUsdaSuccess,
    refetch: retryUSDA,
  } = useQuery({
    queryKey: ['food-search-usda', debouncedSearchTerm, usdaOffset],
    queryFn: async () => {
      if (!includeAPI || !includeUSDA || !debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return [];
      }

      const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY || '';
      const pageNumber = Math.floor(usdaOffset / usdaLimit) + 1;
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(debouncedSearchTerm)}&pageSize=${usdaLimit}&pageNumber=${pageNumber}&api_key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch from USDA');
      }

      const result = await response.json();
      return result.foods || [];
    },
    enabled:
      enabled &&
      includeAPI &&
      includeUSDA &&
      Boolean(debouncedSearchTerm && debouncedSearchTerm.length >= 2),
    staleTime: 1000 * 60 * 5,
  });

  // Accumulate API results when new page is loaded
  useEffect(() => {
    if (isApiSuccess && apiPageResults.length > 0) {
      if (apiOffset === 0) {
        // First page - replace accumulated results
        setAccumulatedApiResults(apiPageResults);
        setFirstResolvedApi((prev) => prev ?? 'openfood');
      } else {
        // Additional pages - append to accumulated results
        setAccumulatedApiResults((prev) => [...prev, ...apiPageResults]);
      }
      setIsLoadingMoreAPI(false);
    }

    // Track when API completes (for initial load)
    if ((isApiSuccess || apiError) && !isLoadingAPI) {
      setApiCompleted(true);
    }
  }, [isApiSuccess, apiError, apiPageResults, apiOffset, isLoadingAPI]);

  // Accumulate USDA results
  useEffect(() => {
    if (isUsdaSuccess && usdaPageResults.length > 0) {
      if (usdaOffset === 0) {
        setAccumulatedUsdaResults(usdaPageResults);
        setFirstResolvedApi((prev) => prev ?? 'usda');
      } else {
        setAccumulatedUsdaResults((prev) => [...prev, ...usdaPageResults]);
      }
      setIsLoadingMoreUSDA(false);
    }

    if ((isUsdaSuccess || usdaError) && !isLoadingUSDA) {
      setUsdaCompleted(true);
    }
  }, [isUsdaSuccess, usdaError, usdaPageResults, usdaOffset, isLoadingUSDA]);

  // Convert local foods to unified format
  const localResults = useMemo(() => {
    if (!includeLocal) {
      return [];
    }

    return localFoods.map((food) => {
      const massUnit = getMassUnit(units);
      const displayAmount = units === 'imperial' ? Math.round(gramsToDisplay(100, units)) : 100;

      const displayCalories = resolveRoundedPer100gCaloriesForDisplay({
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
      });

      return {
        id: food.id,
        name: food.name,
        description: t('food.descriptionFormat', {
          brand: food.brand || t('food.customFood'),
          calories: displayCalories,
          amount: displayAmount,
          unit: t(getMassUnitI18nKey(units)),
        }),
        brand: food.brand,
        imageUrl: food.imageUrl, // Include image URL from local database
        serving_size: `100 ${massUnit}`, // Display standard serving with appropriate unit
        calories: displayCalories > 0 ? displayCalories : food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        source: 'local' as const,
        _raw: food,
      };
    });
  }, [localFoods, includeLocal, units, t]);

  // Convert API results to unified format
  const apiResultsFormatted = useMemo(() => {
    if (!includeAPI || !includeOpenFood) {
      return [];
    }

    return accumulatedApiResults
      .map((product) => {
        const nutriments = getNutrimentsWithFallback(product);
        if (!nutriments) {
          return null;
        }

        return mapOpenFoodFactsProduct(product);
      })
      .filter((product) => product) as UnifiedFoodResult[];
  }, [accumulatedApiResults, includeAPI, includeOpenFood]);

  const usdaResultsFormatted = useMemo(() => {
    if (!includeAPI || !includeUSDA) {
      return [];
    }
    return accumulatedUsdaResults.map(mapUSDAFoodToUnified);
  }, [accumulatedUsdaResults, includeAPI, includeUSDA]);

  // Combine and deduplicate results - updates when API completes
  const combinedResults = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }

    const allResults = [...localResults, ...apiResultsFormatted, ...usdaResultsFormatted];

    // Deduplication logic:
    // 1. If same barcode exists, keep local version (user's data)
    // 2. If no barcode, deduplicate by name (case-insensitive)
    const seenBarcodes = new Set<string>();
    const seenNames = new Set<string>();

    return allResults.filter((result) => {
      const barcode = result.id; // Both local and API foods use 'id' for barcode
      const normalizedName = (result.name ?? '').toLowerCase().trim();

      // Priority 1: Deduplicate by barcode
      if (barcode) {
        if (seenBarcodes.has(barcode)) {
          return false;
        }

        seenBarcodes.add(barcode);
        return true;
      }

      // Priority 2: For items without barcode, deduplicate by name
      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    });
  }, [debouncedSearchTerm, localResults, apiResultsFormatted, usdaResultsFormatted]);

  // Separate results by source for filtering
  const resultsBySource = useMemo(
    () => ({
      all: combinedResults,
      local: localResults,
      api: apiResultsFormatted,
      usda: usdaResultsFormatted,
    }),
    [combinedResults, localResults, apiResultsFormatted, usdaResultsFormatted]
  );

  // Load more functions
  const loadMoreLocal = useCallback(async () => {
    if (isLoadingMoreFoods) {
      return;
    }
    await loadMoreFoods();
  }, [isLoadingMoreFoods, loadMoreFoods]);

  const loadMoreAPI = useCallback(async () => {
    if (isLoadingMoreAPI) {
      return;
    }

    setIsLoadingMoreAPI(true);
    setApiOffset((prev) => prev + apiLimit);
  }, [isLoadingMoreAPI, apiLimit]);

  const loadMoreUSDA = useCallback(async () => {
    if (isLoadingMoreUSDA) {
      return;
    }
    setIsLoadingMoreUSDA(true);
    setUsdaOffset((prev) => prev + usdaLimit);
  }, [isLoadingMoreUSDA, usdaLimit]);

  // Check if there might be more results
  const hasMoreLocal = hasMoreFoods;
  const hasMoreAPI = apiPageResults.length === apiLimit; // If we got a full page, there might be more
  const hasMoreUSDA = usdaPageResults.length === usdaLimit;

  // Optimized loading states
  const isLoading = isLoadingLocal; // Only show loading for local search
  const isApiLoading = isLoadingAPI || isLoadingUSDA;
  const hasApiResults = apiResultsFormatted.length > 0 || usdaResultsFormatted.length > 0;

  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    results: combinedResults,
    resultsBySource,
    isLoading,
    isLoadingLocal,
    isLoadingAPI: isApiLoading,
    apiCompleted,
    usdaCompleted,
    apiError,
    usdaError,
    error: apiError || usdaError, // Keep for backward compatibility if needed, but discouraged
    hasResults: combinedResults.length > 0,
    localCount: localResults.length,
    apiCount: apiResultsFormatted.length + usdaResultsFormatted.length,
    totalCount: combinedResults.length,
    // Additional states for UI optimization
    hasLocalResults: localResults.length > 0,
    hasApiResults,
    isInitialLoad:
      (isLoadingLocal || (includeOpenFood && !apiCompleted) || (includeUSDA && !usdaCompleted)) &&
      combinedResults.length === 0,
    // Pagination states
    hasMoreLocal,
    hasMoreAPI,
    hasMoreUSDA,
    isLoadingMoreLocal: isLoadingMoreFoods,
    isLoadingMoreAPI,
    isLoadingMoreUSDA,
    loadMoreLocal,
    loadMoreAPI,
    loadMoreUSDA,
    firstResolvedApi,
    retryAPI,
    retryUSDA,
    cancelSearch,
  };
}
