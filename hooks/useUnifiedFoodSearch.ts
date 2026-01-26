import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFoods } from './useFoods';
import { SearchResultProduct } from '../types/openFoodFacts';
import { fetch } from 'expo/fetch';

// Unified search result type
export type UnifiedFoodResult = {
  id: string;
  name: string;
  description: string;
  brand?: string;
  imageUrl?: string;
  serving_size?: string;
  nutriments?: any;
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

  // Debounce search term
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setDebouncedSearchTerm('');
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Local database search
  const { foods: localFoods, isLoading: isLoadingLocal } = useFoods({
    mode: 'search',
    searchTerm: includeLocal ? debouncedSearchTerm : '',
    visible: enabled && includeLocal,
    enableReactivity: true,
  });

  // API search using existing hook logic
  const {
    data: apiResults = [],
    isLoading: isLoadingAPI,
    error: apiError,
  } = useQuery({
    queryKey: ['food-search-api', debouncedSearchTerm],
    queryFn: async () => {
      if (!includeAPI || !debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return [];
      }

      // v2 API doesn't support text search, so we use the v1 search endpoint directly
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(debouncedSearchTerm)}&json=1&page_size=${apiLimit}&fields=code,product_name,brands,generic_name,nutriments,serving_size,categories,image_url,image_small_url`;

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
    enabled:
      enabled && includeAPI && Boolean(debouncedSearchTerm && debouncedSearchTerm.length >= 2),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Convert local foods to unified format
  const localResults = useMemo(() => {
    if (!includeLocal) {
      return [];
    }

    return localFoods.slice(0, localLimit).map((food) => ({
      id: food.id,
      name: food.name,
      description: `${food.brand || 'Custom Food'} • ${food.calories || 0} kcal per 100g`,
      brand: food.brand,
      serving_size: `${food.servingAmount || 100} ${food.servingUnit || 'g'}`,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      source: 'local' as const,
      _raw: food,
    }));
  }, [localFoods, includeLocal, localLimit]);

  // Convert API results to unified format
  const apiResultsFormatted = useMemo(() => {
    if (!includeAPI) return [];

    return apiResults.map((product) => {
      const kcal = product.nutriments?.['energy-kcal'];
      const calories = kcal ? Math.round(kcal) : undefined;

      return {
        id: product.code || String(Math.random()),
        name: product.product_name || 'Unknown Product',
        description: `${product.brands || product.generic_name || 'Generic'} • ${calories ? `${calories} kcal` : 'N/A'}`,
        brand: product.brands,
        imageUrl: product.image_url,
        serving_size: product.serving_size,
        calories,
        protein: product.nutriments?.proteins,
        carbs: product.nutriments?.carbohydrates,
        fat: product.nutriments?.fat,
        fiber: (product.nutriments as any)?.fiber || 0, // Default to 0 if not available
        source: 'api' as const,
        _raw: product,
      };
    });
  }, [apiResults, includeAPI]);

  // Combine and deduplicate results
  const combinedResults = useMemo(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      return [];
    }

    const allResults = [...localResults, ...apiResultsFormatted];

    // Simple deduplication by name (case-insensitive)
    const seen = new Set<string>();
    return allResults.filter((result) => {
      const normalizedName = result.name.toLowerCase().trim();
      if (seen.has(normalizedName)) {
        return false;
      }

      seen.add(normalizedName);
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

  return {
    results: combinedResults,
    resultsBySource,
    isLoading: isLoadingLocal || isLoadingAPI,
    isLoadingLocal,
    isLoadingAPI,
    error: apiError,
    hasResults: combinedResults.length > 0,
    localCount: localResults.length,
    apiCount: apiResultsFormatted.length,
    totalCount: combinedResults.length,
  };
}
