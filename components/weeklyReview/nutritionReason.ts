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

/** How far a recommended calorie target moves from the current one, as a share of it (0.4 = 40%). */
export function calorieChangeShare(current: number, recommended: number): number {
  return current > 0 ? Math.abs(recommended - current) / current : 0;
}

/**
 * Whether a recommended calorie target moves far enough from the current one to warn about. Shown
 * whether or not the recommendation can be applied yet: a 40% cut is worth flagging the moment it
 * is on screen, not only once it becomes one tap away.
 */
export function isLargeCalorieChange(current: number, recommended: number): boolean {
  return calorieChangeShare(current, recommended) >= LARGE_CHANGE_SHARE;
}

/**
 * Whether a recommendation goes below the user's minimum-calorie floor. Only possible when they
 * turned the floor off in Advanced settings; with it on the recommendation is clamped to it.
 */
export function isBelowCalorieFloor(
  recommendation: WeeklyNutritionRecommendation | null | undefined
): boolean {
  return (
    !!recommendation?.minimumCaloriesDisabled &&
    recommendation.minimumCalories != null &&
    recommendation.targets.totalCalories < recommendation.minimumCalories
  );
}
