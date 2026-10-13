import type { WeeklyNutritionRecommendation } from '@/database/services/WeeklyReviewService';

import {
  calorieChangeShare,
  isBelowCalorieFloor,
  isLargeCalorieChange,
  nutritionReason,
} from '../nutritionReason';

const recommendation = (
  overrides: Partial<WeeklyNutritionRecommendation> = {}
): WeeklyNutritionRecommendation => ({
  targets: { totalCalories: 2200, protein: 160, carbs: 220, fats: 70, fiber: 30 },
  usedEmpiricalData: true,
  foodDays: 7,
  weightDays: 5,
  canApply: true,
  expenditure: 2600,
  trendChangeKg: -0.4,
  ...overrides,
});

describe('nutritionReason', () => {
  it('names expenditure and the week’s trend change when both come from the user’s data', () => {
    expect(nutritionReason(recommendation())).toEqual({
      key: 'weeklyReview.reasonEmpirical',
      expenditure: 2600,
      trendChangeKg: -0.4,
    });
  });

  it('omits the trend when there was no weigh-in before the week to compare with', () => {
    expect(nutritionReason(recommendation({ trendChangeKg: undefined }))).toEqual({
      key: 'weeklyReview.reasonEmpiricalNoTrend',
      expenditure: 2600,
    });
  });

  it('labels a formula estimate as one', () => {
    expect(nutritionReason(recommendation({ usedEmpiricalData: false }))).toEqual({
      key: 'weeklyReview.reasonBaseline',
      expenditure: 2600,
    });
  });

  it('asks for more data instead of explaining a recommendation that cannot be applied', () => {
    expect(nutritionReason(recommendation({ canApply: false }))).toEqual({
      key: 'weeklyReview.collectData',
    });
    expect(nutritionReason(null)).toEqual({ key: 'weeklyReview.collectData' });
  });

  it('falls back to the generic sentence for snapshots saved without the numbers', () => {
    expect(nutritionReason(recommendation({ expenditure: undefined }))).toEqual({
      key: 'weeklyReview.empiricalReason',
    });
    expect(
      nutritionReason(recommendation({ expenditure: undefined, usedEmpiricalData: false }))
    ).toEqual({ key: 'weeklyReview.baselineReason' });
  });
});

describe('isLargeCalorieChange', () => {
  it('flags changes of 15% or more in either direction', () => {
    expect(isLargeCalorieChange(2500, 1500)).toBe(true);
    expect(isLargeCalorieChange(2000, 2300)).toBe(true);
    expect(isLargeCalorieChange(2000, 2200)).toBe(false);
    expect(isLargeCalorieChange(0, 1500)).toBe(false);
  });
});

describe('calorie warnings', () => {
  it('measures the change as a share of the current target', () => {
    expect(calorieChangeShare(2500, 1500)).toBeCloseTo(0.4);
    expect(calorieChangeShare(0, 1500)).toBe(0);
    expect(isLargeCalorieChange(2500, 1500)).toBe(true);
    expect(isLargeCalorieChange(2500, 2300)).toBe(false);
  });

  it('flags a recommendation below the floor only when the user turned the floor off', () => {
    const low = { targets: { ...recommendation().targets, totalCalories: 1100 } };
    expect(
      isBelowCalorieFloor(
        recommendation({ ...low, minimumCalories: 1500, minimumCaloriesDisabled: true })
      )
    ).toBe(true);
    // With the floor on, the recommendation is clamped to it, so it cannot be below.
    expect(
      isBelowCalorieFloor(
        recommendation({ ...low, minimumCalories: 1500, minimumCaloriesDisabled: false })
      )
    ).toBe(false);
    // Snapshots saved before the floor was recorded say nothing.
    expect(isBelowCalorieFloor(recommendation(low))).toBe(false);
    expect(isBelowCalorieFloor(null)).toBe(false);
  });
});
