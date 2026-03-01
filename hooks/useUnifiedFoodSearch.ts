import { useQuery } from '@tanstack/react-query';
import { fetch } from 'expo/fetch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  MappedNutriments,
  SearchResultProduct,
  SuccessFoodProductState,
} from '../types/openFoodFacts';
import { getNutrimentsWithFallback, mapOpenFoodFactsProduct } from '../utils/openFoodFactsMapper';
import { useFoods } from './useFoods';

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
  source: 'local' | 'api';
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
  debounceMs?: number;
}

export function useUnifiedFoodSearch({
  searchTerm,
  enabled = true,
  includeLocal = true,
  includeAPI = true,
  localLimit = 10,
  apiLimit = 20,
  debounceMs = 300,
}: UseUnifiedFoodSearchProps) {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [apiCompleted, setApiCompleted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // API pagination states
  const [apiOffset, setApiOffset] = useState(0);
  const [isLoadingMoreAPI, setIsLoadingMoreAPI] = useState(false);
  const [accumulatedApiResults, setAccumulatedApiResults] = useState<SearchResultProduct[]>([]);

  // Debounce search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setDebouncedSearchTerm('');
      setApiCompleted(false);
      setApiOffset(0);
      setAccumulatedApiResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setApiCompleted(false);
      setApiOffset(0);
      setAccumulatedApiResults([]);
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

        // v2 API doesn't support text search, so we use the v1 search endpoint directly
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(debouncedSearchTerm)}&json=1&page_size=${apiLimit}&page=${Math.floor(apiOffset / apiLimit) + 1}&fields=code,product_name,brands,generic_name,nutriments,serving_size,categories,image_url,image_small_url`;

        const response = await fetch(url, { signal: abortController.signal });

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
      enabled && includeAPI && Boolean(debouncedSearchTerm && debouncedSearchTerm.length >= 2),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Accumulate API results when new page is loaded
  useEffect(() => {
    if (isApiSuccess && apiPageResults.length > 0) {
      if (apiOffset === 0) {
        // First page - replace accumulated results
        setAccumulatedApiResults(apiPageResults);
      } else {
        // Additional pages - append to accumulated results
        setAccumulatedApiResults((prev) => [...prev, ...apiPageResults]);
      }
      setIsLoadingMoreAPI(false);
    }

    // Track when API completes (for initial load)
    if (isApiSuccess && !isLoadingAPI) {
      setApiCompleted(true);
    }
  }, [isApiSuccess, apiPageResults, apiOffset, isLoadingAPI]);

  // Convert local foods to unified format
  const localResults = useMemo(() => {
    if (!includeLocal) {
      return [];
    }

    return localFoods.map((food) => ({
      id: food.id,
      name: food.name,
      description: `${food.brand || 'Custom Food'} • ${Math.round(food.calories || 0)} kcal per 100g`, // TODO: use i18n and check if user uses metric or imperial to decide which unit to use
      brand: food.brand,
      imageUrl: food.imageUrl, // Include image URL from local database
      serving_size: '100 g', // Display standard serving
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      source: 'local' as const,
      _raw: food,
    }));
  }, [localFoods, includeLocal]);

  // Convert API results to unified format
  const apiResultsFormatted = useMemo(() => {
    if (!includeAPI) {
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
  }, [accumulatedApiResults, includeAPI]);

  // Combine and deduplicate results - updates when API completes
  const combinedResults = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }

    const allResults = [...localResults, ...apiResultsFormatted];

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
  }, [localResults, apiResultsFormatted, debouncedSearchTerm]);

  // Separate results by source for filtering
  const resultsBySource = useMemo(
    () => ({
      all: combinedResults,
      local: localResults,
      api: apiResultsFormatted,
    }),
    [combinedResults, localResults, apiResultsFormatted]
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

  // Check if there might be more results
  const hasMoreLocal = hasMoreFoods;
  const hasMoreAPI = apiPageResults.length === apiLimit; // If we got a full page, there might be more

  // Optimized loading states
  const isLoading = isLoadingLocal; // Only show loading for local search
  const isApiLoading = isLoadingAPI;
  const hasApiResults = apiResultsFormatted.length > 0;

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
    error: apiError,
    hasResults: combinedResults.length > 0,
    localCount: localResults.length,
    apiCount: apiResultsFormatted.length,
    totalCount: combinedResults.length,
    // Additional states for UI optimization
    hasLocalResults: localResults.length > 0,
    hasApiResults,
    isInitialLoad: isLoadingLocal && !apiCompleted,
    // Pagination states
    hasMoreLocal,
    hasMoreAPI,
    isLoadingMoreLocal: isLoadingMoreFoods,
    isLoadingMoreAPI,
    loadMoreLocal,
    loadMoreAPI,
  };
}
