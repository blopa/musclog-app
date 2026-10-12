import type { WeeklyNutritionRecommendation } from '@/database/services/WeeklyReviewService';

/**
 * A calorie change at least this large (as a share of the current target) gets a "check your log"
 * prompt. A week with unlogged meals reads as low expenditure, and the recommendation follows it
 * straight down — the most common way a weekly algorithm earns a user's distrust.
 */
export const LARGE_CHANGE_SHARE = 0.15;

export type NutritionReason =
  | { key: 'weeklyReview.collectData' }
  | { key: 'weeklyReview.reasonEmpirical'; expenditure: number; trendChangeKg: number }
  | { key: 'weeklyReview.reasonEmpiricalNoTrend'; expenditure: number }
  | { key: 'weeklyReview.reasonBaseline'; expenditure: number }
  | { key: 'weeklyReview.empiricalReason' }
  | { key: 'weeklyReview.baselineReason' };

/** Why the targets are what they are, as specifically as the stored recommendation allows. */
export function nutritionReason(
  recommendation: WeeklyNutritionRecommendation | null | undefined
): NutritionReason {
  if (!recommendation?.canApply) {
    return { key: 'weeklyReview.collectData' };
  }
  const { expenditure, trendChangeKg, usedEmpiricalData } = recommendation;
  if (expenditure == null || !Number.isFinite(expenditure)) {
    // A snapshot saved before the numbers were recorded.
    return {
      key: usedEmpiricalData ? 'weeklyReview.empiricalReason' : 'weeklyReview.baselineReason',
    };
  }
  if (!usedEmpiricalData) {
    return { key: 'weeklyReview.reasonBaseline', expenditure };
  }
  return trendChangeKg != null && Number.isFinite(trendChangeKg)
    ? { key: 'weeklyReview.reasonEmpirical', expenditure, trendChangeKg }
    : { key: 'weeklyReview.reasonEmpiricalNoTrend', expenditure };
}

/** Whether a recommended calorie target moves far enough from the current one to double-check. */
export function isLargeCalorieChange(current: number, recommended: number): boolean {
  return current > 0 && Math.abs(recommended - current) / current >= LARGE_CHANGE_SHARE;
}
