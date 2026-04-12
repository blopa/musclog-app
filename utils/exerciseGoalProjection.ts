import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';

export interface ProjectionInputs {
  dataPoints: ProgressiveOverloadDataPoint[]; // Sorted by date ascending
  baseline1rm: number;
  targetWeight: number;
}

export interface ProjectionResult {
  currentEstimated1RM: number; // kg
  weeklyProgressionRate: number; // kg/week (can be negative)
  projectedWeeks: number | null; // null if rate <= 0 or insufficient data
  projectedDate: Date | null;
  progressPercent: number; // 0–100, clamped, baseline-anchored
  deltaFromBaseline: number; // kg gained since goal started
  status: 'on_track' | 'stalling' | 'declining' | 'achieved' | 'insufficient_data' | 'no_history';
  dataPointCount: number;
}

/**
 * Perform linear regression to find the slope (kg/week)
 */
export function linearRegressionSlope(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Calculate weeks between two timestamps
 */
function weeksBetween(startMs: number, endMs: number): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return (endMs - startMs) / msPerWeek;
}

/**
 * Project goal completion based on workout history
 */
export function projectGoal(inputs: ProjectionInputs): ProjectionResult {
  const { dataPoints, baseline1rm, targetWeight } = inputs;

  // No history at all
  if (dataPoints.length === 0) {
    return {
      currentEstimated1RM: baseline1rm,
      weeklyProgressionRate: 0,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent: 0,
      deltaFromBaseline: 0,
      status: 'no_history',
      dataPointCount: 0,
    };
  }

  // Get current estimated 1RM (latest data point)
  const currentEstimated1RM = dataPoints[dataPoints.length - 1].estimated1RM;
  const deltaFromBaseline = currentEstimated1RM - baseline1rm;

  // Already achieved?
  if (currentEstimated1RM >= targetWeight) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate: 0,
      projectedWeeks: 0,
      projectedDate: new Date(),
      progressPercent: 100,
      deltaFromBaseline,
      status: 'achieved',
      dataPointCount: dataPoints.length,
    };
  }

  // Calculate progress percentage (anchored to baseline, not 0)
  const totalGap = targetWeight - baseline1rm;
  const currentGap = targetWeight - currentEstimated1RM;
  const rawProgressPercent = totalGap > 0 ? ((totalGap - currentGap) / totalGap) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(0, rawProgressPercent));

  // Insufficient data for regression
  if (dataPoints.length < 3) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate: 0,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent,
      deltaFromBaseline,
      status: 'insufficient_data',
      dataPointCount: dataPoints.length,
    };
  }

  // Convert data points to weeks since first point for regression
  const firstDate = dataPoints[0].date;
  const regressionPoints = dataPoints.map((dp) => ({
    x: weeksBetween(firstDate, dp.date),
    y: dp.estimated1RM,
  }));

  const weeklyProgressionRate = linearRegressionSlope(regressionPoints);

  // Determine status based on rate
  let status: ProjectionResult['status'];
  if (weeklyProgressionRate > 0.1) {
    status = 'on_track';
  } else if (weeklyProgressionRate > -0.1) {
    status = 'stalling';
  } else {
    status = 'declining';
  }

  // Can't project if not progressing
  if (weeklyProgressionRate <= 0) {
    return {
      currentEstimated1RM,
      weeklyProgressionRate,
      projectedWeeks: null,
      projectedDate: null,
      progressPercent,
      deltaFromBaseline,
      status,
      dataPointCount: dataPoints.length,
    };
  }

  // Calculate projection
  const remainingKg = targetWeight - currentEstimated1RM;
  const projectedWeeks = remainingKg / weeklyProgressionRate;

  // Cap at 2 years to avoid absurd projections
  const MAX_WEEKS = 104; // 2 years
  const cappedWeeks = Math.min(projectedWeeks, MAX_WEEKS);

  const projectedDate = new Date(Date.now() + cappedWeeks * 7 * 24 * 60 * 60 * 1000);

  return {
    currentEstimated1RM,
    weeklyProgressionRate,
    projectedWeeks: cappedWeeks,
    projectedDate,
    progressPercent,
    deltaFromBaseline,
    status,
    dataPointCount: dataPoints.length,
  };
}

/**
 * Check if a progression rate is realistic for a given baseline and target weight.
 * General rule of thumb: 0.5% - 2% per week is realistic depending on experience.
 * We'll use 1.5% as a generous upper bound for "realistic" for a nudge.
 */
export function isProgressionRateRealistic(
  currentWeight: number,
  requiredRatePerWeek: number
): boolean {
  if (currentWeight <= 0) return true; // Can't judge without baseline
  const percentPerWeek = (requiredRatePerWeek / currentWeight) * 100;
  return percentPerWeek <= 1.5;
}
