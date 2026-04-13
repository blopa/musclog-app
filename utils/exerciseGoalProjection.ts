import type { ProgressiveOverloadDataPoint } from '@/database/services/WorkoutAnalytics';

export interface ProjectionInputs {
  dataPoints: ProgressiveOverloadDataPoint[]; // Sorted by date ascending
  baseline1rm: number;
  targetWeight: number;
  bodyWeight?: number; // Optional but highly recommended for realism nudges
  loadMultiplier?: number; // From Exercise model, ensures i18n independence
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
  const { dataPoints, baseline1rm, targetWeight, bodyWeight, loadMultiplier = 1.0 } = inputs;

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
  // We use loadMultiplier to normalize relative strength across different exercises.
  const bw = bodyWeight && bodyWeight > 0 ? bodyWeight : 80; // fallback to 80kg if unknown
  const normalizedRelativeStrength = currentEstimated1RM / (bw * loadMultiplier);

  // Stalling threshold: 0.1 kg/week for novices, 0.02 kg/week for advanced
  const stallingThreshold = normalizedRelativeStrength > 1.5 ? 0.02 : 0.1;

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
    loadMultiplier
  );

  // Calculate non-linear projection using a step-simulation.
  // This accounts for the Law of Diminishing Returns: as the lifter approaches
  // their target (and potentially moves into higher training tiers), their
  // rate of progress naturally decelerates.
  let sim1RM = currentEstimated1RM;
  let simWeeks = 0;
  const MAX_SIM_WEEKS = 104; // 2 years hard cap

  // Determine user's current "Performance Ratio" vs the theoretical cap for their tier.
  const currentRS = currentEstimated1RM / (bw * loadMultiplier);
  const currentCapPercent = getRealisticWeeklyRateCapPercent(currentRS);
  const currentCapKg = (currentCapPercent / 100) * currentEstimated1RM;

  // performanceRatio > 1 means they are currently outperforming standard realistic bounds
  // performanceRatio < 1 means they are progressing slower than the tier's capacity.
  let performanceRatio = weeklyProgressionRate / Math.max(currentCapKg, 0.01);

  while (sim1RM < targetWeight && simWeeks < MAX_SIM_WEEKS) {
    simWeeks += 1;

    // Recalculate cap for the simulated weight level
    const simRS = sim1RM / (bw * loadMultiplier);
    const simCapPercent = getRealisticWeeklyRateCapPercent(simRS);
    const simCapKg = (simCapPercent / 100) * sim1RM;

    // Projected gain for this week maintains the user's performance ratio but
    // is constrained by the new tier's biological capacity.
    const gain = simCapKg * performanceRatio;
    sim1RM += Math.max(gain, 0.001); // Ensure simulation moves forward

    // Slight decay in performance ratio (0.2% per week) to simulate the
    // cumulative cost of long-term adaptation and diminishing returns.
    performanceRatio *= 0.998;
  }

  const projectedWeeks = simWeeks;
  const projectedDate = new Date(Date.now() + projectedWeeks * 7 * 24 * 60 * 60 * 1000);

  return {
    currentEstimated1RM,
    weeklyProgressionRate,
    projectedWeeks,
    projectedDate,
    progressPercent,
    deltaFromBaseline,
    status,
    dataPointCount: dataPoints.length,
    isRealistic,
  };
}

/**
 * Returns the realistic upper bound for weekly progression (as % of 1RM)
 * based on the lifter's training tier.
 */
function getRealisticWeeklyRateCapPercent(normalizedRS: number): number {
  if (normalizedRS < 1.0) return 1.5; // Novice
  if (normalizedRS < 1.8) return 0.5; // Intermediate
  return 0.15; // Advanced
}

/**
 * Check if a progression rate is realistic for a given baseline and target weight.
 * Boundary boundary scales inversely with the lifter's relative strength.
 * Uses loadMultiplier for i18n-safe exercise categorization.
 */
export function isProgressionRateRealistic(
  currentWeight: number,
  bodyWeight: number,
  requiredRatePerWeek: number,
  loadMultiplier: number = 1.0
): boolean {
  if (currentWeight <= 0) return true;

  const percentPerWeek = (requiredRatePerWeek / currentWeight) * 100;

  // If bodyweight is not provided, fall back to a conservative universal threshold
  if (bodyWeight <= 0) {
    return percentPerWeek <= 1.0;
  }

  // Normalize relative strength using the loadMultiplier.
  const normalizedRelativeStrength = currentWeight / (bodyWeight * loadMultiplier);
  const upperThreshold = getRealisticWeeklyRateCapPercent(normalizedRelativeStrength);

  return percentPerWeek <= upperThreshold;
}
