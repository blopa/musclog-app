import { Q } from '@nozbe/watermelondb';
import convert from 'convert';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DEFAULT_BATCH_SIZE } from '../constants/database';
import type { Units } from '../constants/settings';
import { database } from '../database';
import type { DecryptedUserMetricFields } from '../database/models';
import UserMetric from '../database/models/UserMetric';
import { UserMetricService } from '../database/services';
import { MetricType } from '../services/healthDataTransform';
import { cmToDisplay, kgToDisplay } from '../utils/unitConversion';
import { useSettings } from './useSettings';

export interface UserMetrics {
  weight?: number;
  height?: number;
  bodyFat?: number;
  bmi?: number;
}

// Hook parameters
export interface UseUserMetricsParams {
  mode?: 'latest' | 'history'; // Default: 'latest'
  metricType?: MetricType; // For history mode: filter by type ('weight', 'height', 'bodyFat', etc.)
  dateRange?: { startDate: number; endDate: number }; // For history mode: filter by date range
  initialLimit?: number; // For history mode, default: 5 (ignored if getAll is true)
  batchSize?: number; // For history mode, default: 5 (ignored if getAll is true)
  getAll?: boolean; // For history mode: if true, fetch all metrics of the specified type (no pagination)
  enableReactivity?: boolean; // Default: true
  visible?: boolean; // For modal visibility control, default: true
}

// Return type for latest mode
export type UseUserMetricsResultLatest = {
  metrics: UserMetrics | null;
  isLoading: boolean;
};

export type UserMetricWithDecrypted = {
  metric: UserMetric;
  decrypted: DecryptedUserMetricFields;
};

// Return type for history mode
export type UseUserMetricsResultHistory = {
  metrics: UserMetricWithDecrypted[];
  latest: UserMetrics | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

export type UseUserMetricsResult = UseUserMetricsResultLatest | UseUserMetricsResultHistory;

/**
 * Calculate BMI from weight (kg) and height (cm).
 * Used internally after normalizing to canonical metric.
 */
function calculateBMIFromMetric(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) {
    return 0;
  }

  const heightM = convert(heightCm, 'cm').to('m') as number;
  return weightKg / (heightM * heightM);
}

/**
 * Normalize stored weight value to canonical kg (for legacy lbs).
 */
function normalizeWeightToKg(value: number, unit?: string | null): number {
  if (unit === 'lbs') {
    return convert(value, 'lb').to('kg') as number;
  }

  return value;
}

/**
 * Normalize stored height value to canonical cm (for legacy in).
 */
function normalizeHeightToCm(value: number, unit?: string | null): number {
  if (unit === 'in') {
    return convert(value, 'in').to('cm') as number;
  }

  return value;
}

/**
 * Convert decrypted metric fields to UserMetrics object.
 * Normalizes stored values to kg/cm (legacy lbs/in), then converts to display unit.
 */
function convertDecryptedToUserMetrics(
  weightDec: DecryptedUserMetricFields | null,
  heightDec: DecryptedUserMetricFields | null,
  bodyFatDec: DecryptedUserMetricFields | null,
  units: Units
): UserMetrics | null {
  const bodyFat = bodyFatDec?.value;

  let weightKg: number | undefined;
  let heightCm: number | undefined;
  if (weightDec?.value != null) {
    weightKg = normalizeWeightToKg(weightDec.value, weightDec.unit);
  }

  if (heightDec?.value != null) {
    heightCm = normalizeHeightToCm(heightDec.value, heightDec.unit);
  }

  const weightDisplay = weightKg != null ? kgToDisplay(weightKg, units) : undefined;
  const heightDisplay = heightCm != null ? cmToDisplay(heightCm, units) : undefined;

  let bmi: number | undefined;
  if (weightKg != null && heightCm != null) {
    bmi = calculateBMIFromMetric(weightKg, heightCm);
  }

  if (weightDisplay === undefined && heightDisplay === undefined && bodyFat === undefined) {
    return null;
  }

  return {
    weight: weightDisplay,
    height: heightDisplay,
    bodyFat,
    bmi: bmi != null && bmi > 0 ? bmi : undefined,
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
  getAll = false,
  enableReactivity = true,
  visible = true,
}: UseUserMetricsParams = {}): UseUserMetricsResult {
  const { units } = useSettings();

  // State for latest mode
  const [latestMetrics, setLatestMetrics] = useState<UserMetrics | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  // State for history mode (with decrypted for display)
  const [metrics, setMetrics] = useState<UserMetricWithDecrypted[]>([]);
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

    try {
      let metricsHistory: UserMetric[];

      const dbMetricType = metricType;

      if (getAll) {
        metricsHistory = await UserMetricService.getMetricsHistory(dbMetricType, dateRange);
        setHasMore(false);
      } else {
        setHasMore(true);
        metricsHistory = await UserMetricService.getMetricsHistory(
          dbMetricType,
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

        setCurrentOffset(initialLimit);

        if (metricsHistory.length < initialLimit) {
          setHasMore(false);
        } else {
          const nextBatch = await UserMetricService.getMetricsHistory(
            dbMetricType,
            dateRange,
            1,
            initialLimit
          );
          setHasMore(nextBatch.length > 0);
        }
      }

      if (metricsHistory.length === 0) {
        setMetrics([]);
        setLatestValues(null);
        setIsLoading(false);
        return;
      }

      const withDecrypted: UserMetricWithDecrypted[] = await Promise.all(
        metricsHistory.map(async (m) => ({ metric: m, decrypted: await m.getDecrypted() }))
      );
      setMetrics(withDecrypted);

      const weightMetric = await UserMetricService.getLatest('weight');
      const heightMetric = await UserMetricService.getLatest('height');
      const bodyFatMetric = await UserMetricService.getLatest('body_fat');
      const [wDec, hDec, bDec] = await Promise.all([
        weightMetric?.getDecrypted() ?? null,
        heightMetric?.getDecrypted() ?? null,
        bodyFatMetric?.getDecrypted() ?? null,
      ]);
      setLatestValues(
        convertDecryptedToUserMetrics(wDec ?? null, hDec ?? null, bDec ?? null, units)
      );
    } catch (err) {
      console.error('Error loading user metrics history:', err);
      setMetrics([]);
      setLatestValues(null);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, initialLimit, metricType, dateRange, getAll, units]);

  // Load more metrics (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !visible || getAll) {
      // Don't load more if getAll is true (all metrics already loaded)
      return;
    }

    setIsLoadingMore(true);

    // Small delay to ensure React processes the state update and shows loading state
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

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

      const withDecrypted: UserMetricWithDecrypted[] = await Promise.all(
        metricsHistory.map(async (m) => ({ metric: m, decrypted: await m.getDecrypted() }))
      );
      setMetrics((prev) => [...prev, ...withDecrypted]);

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
  }, [isLoadingMore, hasMore, visible, currentOffset, batchSize, metricType, dateRange, getAll]);

  // Latest mode: Observe latest values for weight, height, bodyFat
  useEffect(() => {
    if (mode !== 'latest') {
      return;
    }

    // Observe any change to user_metrics and refetch latest via service
    const metricsQuery = database
      .get<UserMetric>('user_metrics')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(1));

    const refreshLatest = () => {
      Promise.all([
        UserMetricService.getLatest('weight'),
        UserMetricService.getLatest('height'),
        UserMetricService.getLatest('body_fat'),
      ])
        .then(([w, h, b]) => Promise.all([w?.getDecrypted(), h?.getDecrypted(), b?.getDecrypted()]))
        .then(([wDec, hDec, bDec]) => {
          setLatestMetrics(
            convertDecryptedToUserMetrics(wDec ?? null, hDec ?? null, bDec ?? null, units)
          );
        })
        .finally(() => setIsLoadingLatest(false));
    };

    const subscription = metricsQuery.observe().subscribe({
      next: refreshLatest,
      error: () => {
        refreshLatest();
      },
    });

    refreshLatest();

    return () => subscription.unsubscribe();
  }, [mode, units]);

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

    // Observe any change to trigger reload; date filtering is done in DB in UserMetricService.getMetricsHistory.
    let query = database
      .get<UserMetric>('user_metrics')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc), Q.take(1));

    if (metricType) {
      query = query.extend(Q.where('type', metricType));
    }

    if (dateRange) {
      query = query.extend(
        Q.where('created_at', Q.gte(dateRange.startDate)),
        Q.where('created_at', Q.lte(dateRange.endDate))
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
