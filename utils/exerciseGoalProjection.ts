import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';

export type ExerciseType = 'squat' | 'bench' | 'deadlift' | 'overhead_press' | 'other';

export interface ProjectionInputs {
  dataPoints: ProgressiveOverloadDataPoint[]; // Sorted by date ascending
  baseline1rm: number;
  targetWeight: number;
  bodyWeight?: number; // Optional but highly recommended for realism nudges
  exerciseType?: ExerciseType;
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
  isRealistic: boolean;
}

/**
 * Perform weighted linear regression to find the slope (kg/week).
 * Applies an exponential decay factor to prioritize recent data.
 */
export function weightedLinearRegressionSlope(
  points: Array<{ x: number; y: number }>,
  halfLifeWeeks: number = 12
): number {
  const n = points.length;
  if (n < 2) return 0;

  const lambda = Math.log(2) / halfLifeWeeks;
  const currentX = points[n - 1].x;

  let sumW = 0;
  let sumWX = 0;
  let sumWY = 0;
  let sumWXX = 0;
  let sumWXY = 0;

  for (const point of points) {
    // Weight decays as we go further back from the current date (currentX)
    const weight = Math.exp(-lambda * (currentX - point.x));

    sumW += weight;
    sumWX += weight * point.x;
    sumWY += weight * point.y;
    sumWXX += weight * point.x * point.x;
    sumWXY += weight * point.x * point.y;
  }

  const denominator = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denominator) < 1e-10) return 0;

  return (sumW * sumWXY - sumWX * sumWY) / denominator;
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
  const { dataPoints, baseline1rm, targetWeight, bodyWeight, exerciseType = 'other' } = inputs;

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
      isRealistic: true,
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
      isRealistic: true,
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
      isRealistic: true,
    };
  }

  // Convert data points to weeks since first point for regression
  const firstDate = dataPoints[0].date;
  const regressionPoints = dataPoints.map((dp) => ({
    x: weeksBetween(firstDate, dp.date),
    y: dp.estimated1RM,
  }));

  // Use weighted regression to favor recent progress
  const weeklyProgressionRate = weightedLinearRegressionSlope(regressionPoints);

  // Determine status based on relative progression thresholds
  // Advanced lifters progress slower, so the "stalling" threshold should be lower for them.
  const relativeStrength = bodyWeight && bodyWeight > 0 ? currentEstimated1RM / bodyWeight : 1.0;

  // Stalling threshold: 0.1 kg/week for novices, 0.02 kg/week for advanced
  const stallingThreshold = relativeStrength > 1.5 ? 0.02 : 0.1;

  let status: ProjectionResult['status'];
  if (weeklyProgressionRate > stallingThreshold) {
    status = 'on_track';
  } else if (weeklyProgressionRate > -stallingThreshold) {
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
      isRealistic: true,
    };
  }

  const isRealistic = isProgressionRateRealistic(
    currentEstimated1RM,
    bodyWeight ?? 0,
    weeklyProgressionRate,
    exerciseType
  );

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
    isRealistic,
  };
}

/**
 * Check if a progression rate is realistic for a given baseline and target weight.
 * Boundary boundary scales inversely with the lifter's relative strength.
 */
export function isProgressionRateRealistic(
  currentWeight: number,
  bodyWeight: number,
  requiredRatePerWeek: number,
  exerciseType: ExerciseType = 'other'
): boolean {
  if (currentWeight <= 0) return true;

  const percentPerWeek = (requiredRatePerWeek / currentWeight) * 100;

  // If bodyweight is not provided, fall back to a conservative universal threshold
  if (bodyWeight <= 0) {
    return percentPerWeek <= 1.0;
  }

  const relativeStrength = currentWeight / bodyWeight;

  let upperThreshold = 1.0; // Default fallback

  // Dynamic thresholding based on relative strength tiers
  // Tiers adjusted by exercise type (Deadlifts have higher absolute strength standards)
  if (exerciseType === 'deadlift') {
    if (relativeStrength < 1.5) upperThreshold = 1.5;      // Novice
    else if (relativeStrength < 2.2) upperThreshold = 0.5; // Intermediate
    else upperThreshold = 0.15;                            // Advanced
  } else if (exerciseType === 'squat') {
    if (relativeStrength < 1.2) upperThreshold = 1.5;
    else if (relativeStrength < 1.8) upperThreshold = 0.5;
    else upperThreshold = 0.15;
  } else if (exerciseType === 'bench' || exerciseType === 'overhead_press') {
    if (relativeStrength < 0.8) upperThreshold = 1.2;
    else if (relativeStrength < 1.2) upperThreshold = 0.4;
    else upperThreshold = 0.1;
  } else {
    // General 'other' exercises
    if (relativeStrength < 1.0) upperThreshold = 1.0;
    else upperThreshold = 0.3;
  }

  return percentPerWeek <= upperThreshold;
}
