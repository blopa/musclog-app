import { useState, useEffect, useMemo, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import UserMetric from '../database/models/UserMetric';
import { useSettings } from './useSettings';
import { UserMetricService } from '../database/services/UserMetricService';

export interface UserMetrics {
  weight?: number;
  height?: number;
  bodyFat?: number;
  bmi?: number;
}

// Hook parameters
export interface UseUserMetricsParams {
  mode?: 'latest' | 'history'; // Default: 'latest'
  metricType?: string; // For history mode: filter by type ('weight', 'height', 'bodyFat', etc.)
  dateRange?: { startDate: number; endDate: number }; // For history mode: filter by date range
  initialLimit?: number; // For history mode, default: 5
  batchSize?: number; // For history mode, default: 5
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
}

// Return type for latest mode
export type UseUserMetricsResultLatest = {
  metrics: UserMetrics | null;
  isLoading: boolean;
};

// Return type for history mode
export type UseUserMetricsResultHistory = {
  metrics: UserMetric[]; // Array of UserMetric models
  latest: UserMetrics | null; // Latest values for convenience
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

export type UseUserMetricsResult = UseUserMetricsResultLatest | UseUserMetricsResultHistory;

const DEFAULT_BATCH_SIZE = 5;

/**
 * Calculate BMI from weight and height
 * Handles both metric and imperial units
 */
function calculateBMI(
  weight: number,
  height: number,
  weightUnit: 'kg' | 'lbs',
  heightUnit: 'cm' | 'in'
): number {
  // Convert to metric units for calculation
  let weightKg = weight;
  let heightM = height;

  // Convert weight to kg if needed
  if (weightUnit === 'lbs') {
    weightKg = weight / 2.20462;
  }

  // Convert height to meters if needed
  if (heightUnit === 'cm') {
    heightM = height / 100;
  } else if (heightUnit === 'in') {
    heightM = height * 0.0254;
  }

  // Calculate BMI: weight(kg) / height(m)²
  if (heightM > 0) {
    return weightKg / (heightM * heightM);
  }

  return 0;
}

/**
 * Convert UserMetric records to UserMetrics object
 */
function convertMetricsToUserMetrics(
  weightMetric: UserMetric | null,
  heightMetric: UserMetric | null,
  bodyFatMetric: UserMetric | null,
): UserMetrics | null {
  const weight = weightMetric?.value;
  const height = heightMetric?.value;
  const bodyFat = bodyFatMetric?.value;

  // Calculate BMI if both weight and height are available
  let bmi: number | undefined;
  if (weight && height) {
    // Get units from metric records or use settings
    const wUnit = (weightMetric?.unit === 'lbs' ? 'lbs' : 'kg') as 'kg' | 'lbs';
    const hUnit = (heightMetric?.unit === 'in' ? 'in' : 'cm') as 'cm' | 'in';

    bmi = calculateBMI(weight, height, wUnit, hUnit);
  }

  // Return null if no metrics at all
  if (weight === undefined && height === undefined && bodyFat === undefined) {
    return null;
  }

  return {
    weight,
    height,
    bodyFat,
    bmi: bmi && bmi > 0 ? bmi : undefined,
  };
}

// Function overloads for proper type narrowing
export function useUserMetrics(
  params?: UseUserMetricsParams & { mode?: 'latest' }
): UseUserMetricsResultLatest;
export function useUserMetrics(
  params: UseUserMetricsParams & { mode: 'history' }
): UseUserMetricsResultHistory;
export function useUserMetrics({
  mode = 'latest',
  metricType,
  dateRange,
  initialLimit = 5,
  batchSize = DEFAULT_BATCH_SIZE,
  enableReactivity = true,
  visible = true,
}: UseUserMetricsParams = {}): UseUserMetricsResult {
  const { weightUnit, heightUnit } = useSettings();

  // State for latest mode
  const [latestMetrics, setLatestMetrics] = useState<UserMetrics | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  // State for history mode
  const [metrics, setMetrics] = useState<UserMetric[]>([]);
  const [latestValues, setLatestValues] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Load initial batch of metrics (history mode)
  const loadInitialMetrics = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCurrentOffset(0);
    setHasMore(true);

    try {
      // Fetch initial batch
      const metricsHistory = await UserMetricService.getMetricsHistory(
        metricType,
        dateRange,
        initialLimit
      );

      if (metricsHistory.length === 0) {
        setMetrics([]);
        setLatestValues(null);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      setMetrics(metricsHistory);
      setCurrentOffset(initialLimit);

      // Get latest values for convenience
      const weightMetric = await UserMetricService.getLatest('weight');
      const heightMetric = await UserMetricService.getLatest('height');
      const bodyFatMetric = await UserMetricService.getLatest('bodyFat');
      const latest = convertMetricsToUserMetrics(
        weightMetric,
        heightMetric,
        bodyFatMetric
      );
      setLatestValues(latest);

      // Check if there are more metrics
      if (metricsHistory.length < initialLimit) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await UserMetricService.getMetricsHistory(
          metricType,
          dateRange,
          1,
          initialLimit
        );
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading user metrics history:', err);
      setMetrics([]);
      setLatestValues(null);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit, metricType, dateRange]);

  // Load more metrics (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible) {
      return;
    }

    setIsLoadingMore(true);

    try {
      // Fetch next batch
      const metricsHistory = await UserMetricService.getMetricsHistory(
        metricType,
        dateRange,
        batchSize,
        currentOffset
      );

      if (metricsHistory.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Append to existing metrics
      setMetrics((prev) => [...prev, ...metricsHistory]);

      const newOffset = currentOffset + metricsHistory.length;
      setCurrentOffset(newOffset);

      // Check if there are more metrics
      if (metricsHistory.length < batchSize) {
        setHasMore(false);
      } else {
        // Check if there's a next batch
        const nextBatch = await UserMetricService.getMetricsHistory(
          metricType,
          dateRange,
          1,
          newOffset
        );
        setHasMore(nextBatch.length > 0);
      }
    } catch (err) {
      console.error('Error loading more user metrics:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, metricType, dateRange]);

  // Latest mode: Observe latest values for weight, height, bodyFat
  useEffect(() => {
    if (mode !== 'latest') {
      return;
    }

    // Track individual metric values
    let weight: number | undefined;
    let height: number | undefined;
    let bodyFat: number | undefined;
    let weightUnitFromMetric: string | undefined;
    let heightUnitFromMetric: string | undefined;
    let loadedCount = 0;
    const totalQueries = 3;

    const updateMetrics = () => {
      loadedCount++;
      if (loadedCount === totalQueries) {
        // Calculate BMI if both weight and height are available
        let bmi: number | undefined;
        if (weight && height) {
          // Get units from metric records or use settings
          const wUnit = (weightUnitFromMetric === 'lbs' ? 'lbs' : 'kg') as 'kg' | 'lbs';
          const hUnit = (heightUnitFromMetric === 'in' ? 'in' : 'cm') as 'cm' | 'in';

          bmi = calculateBMI(weight, height, wUnit, hUnit);
        }

        // Return null if no metrics at all
        if (weight === undefined && height === undefined && bodyFat === undefined) {
          setLatestMetrics(null);
        } else {
          setLatestMetrics({
            weight,
            height,
            bodyFat,
            bmi: bmi && bmi > 0 ? bmi : undefined,
          });
        }
        setIsLoadingLatest(false);
      }
    };

    // Create separate queries for each metric type
    const weightQuery = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'weight'),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.take(1)
      );

    const heightQuery = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'height'),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.take(1)
      );

    const bodyFatQuery = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'bodyFat'),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.desc),
        Q.take(1)
      );

    // Subscribe to each query separately
    const weightSubscription = weightQuery.observe().subscribe({
      next: (weights) => {
        weight = weights[0]?.value;
        weightUnitFromMetric = weights[0]?.unit;
        updateMetrics();
      },
      error: () => {
        updateMetrics();
      },
    });

    const heightSubscription = heightQuery.observe().subscribe({
      next: (heights) => {
        height = heights[0]?.value;
        heightUnitFromMetric = heights[0]?.unit;
        updateMetrics();
      },
      error: () => {
        updateMetrics();
      },
    });

    const bodyFatSubscription = bodyFatQuery.observe().subscribe({
      next: (bodyFats) => {
        bodyFat = bodyFats[0]?.value;
        updateMetrics();
      },
      error: () => {
        updateMetrics();
      },
    });

    return () => {
      weightSubscription.unsubscribe();
      heightSubscription.unsubscribe();
      bodyFatSubscription.unsubscribe();
    };
  }, [mode, weightUnit, heightUnit]);

  // History mode: Observe for new metrics to trigger reload (reactivity)
  useEffect(() => {
    if (mode !== 'history') {
      return;
    }

    if (!enableReactivity || !visible) {
      // Still load initial data even if reactivity is disabled
      if (visible) {
        loadInitialMetrics();
      }
      return;
    }

    // Build query based on filters
    let query = database.get<UserMetric>('user_metrics').query(
      Q.where('deleted_at', Q.eq(null)),
      Q.sortBy('date', Q.desc),
      Q.take(1) // Only need to know if there are any changes
    );

    if (metricType) {
      query = query.extend(Q.where('type', metricType));
    }

    if (dateRange) {
      query = query.extend(
        Q.where('date', Q.gte(dateRange.startDate)),
        Q.where('date', Q.lte(dateRange.endDate))
      );
    }

    const subscription = query.observe().subscribe({
      next: () => {
        // When a new metric is created/updated, reload the initial batch
        loadInitialMetrics();
      },
      error: (err) => {
        console.error('Error observing user metrics:', err);
      },
    });

    // Load initial data
    loadInitialMetrics();

    return () => subscription.unsubscribe();
  }, [mode, enableReactivity, visible, metricType, dateRange, loadInitialMetrics]);

  // Latest mode result
  const latestResult = useMemo(
    () => ({
      metrics: latestMetrics,
      isLoading: isLoadingLatest,
    }),
    [latestMetrics, isLoadingLatest]
  );

  // History mode result
  const historyResult = useMemo(
    () => ({
      metrics,
      latest: latestValues,
      isLoading,
      isLoadingMore,
      hasMore,
      loadMore,
    }),
    [metrics, latestValues, isLoading, isLoadingMore, hasMore, loadMore]
  );

  // Return appropriate type based on mode
  return (mode === 'history' ? historyResult : latestResult) as UseUserMetricsResult;
}
