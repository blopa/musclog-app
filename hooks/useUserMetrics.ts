import { useState, useEffect, useMemo } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import UserMetric from '../database/models/UserMetric';
import { useSettings } from './useSettings';

export interface UserMetrics {
  weight?: number;
  height?: number;
  bodyFat?: number;
  bmi?: number;
}

export interface UseUserMetricsResult {
  metrics: UserMetrics | null;
  isLoading: boolean;
}

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

export function useUserMetrics(): UseUserMetricsResult {
  const { weightUnit, heightUnit } = useSettings();
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

        setMetrics({
          weight,
          height,
          bodyFat,
          bmi: bmi && bmi > 0 ? bmi : undefined,
        });
        setIsLoading(false);
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
  }, [weightUnit, heightUnit]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      metrics,
      isLoading,
    }),
    [metrics, isLoading]
  );
}
