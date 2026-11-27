// What a calorie goal screen must say out loud before someone saves it. Pure.

import type { Gender } from '@/database/models/User';
import { bmiFromWeightAndHeightM, getMinCalories } from '@/utils/nutritionCalculator';

/** The adult BMI below which the WHO calls a person underweight. */
export const UNDERWEIGHT_BMI = 18.5;

export type GoalSafetyWarning = 'belowMinimum' | 'underweightCut' | 'goalUnderweight';

type GoalSafetyInput = {
  calories: number;
  gender: Gender;
  /** True when the goal is a calorie deficit. */
  isCut: boolean;
  weightKg?: number | null;
  heightM?: number | null;
  targetWeightKg?: number | null;
};

const isUnderweight = (weightKg: number | null | undefined, heightM: number | null | undefined) =>
  weightKg != null &&
  weightKg > 0 &&
  heightM != null &&
  heightM > 0 &&
  bmiFromWeightAndHeightM(weightKg, heightM) < UNDERWEIGHT_BMI;

export function goalSafetyWarnings({
  calories,
  gender,
  isCut,
  weightKg,
  heightM,
  targetWeightKg,
}: GoalSafetyInput): GoalSafetyWarning[] {
  const warnings: GoalSafetyWarning[] = [];

  if (calories > 0 && calories < getMinCalories(gender)) {
    warnings.push('belowMinimum');
  }

  if (isCut && isUnderweight(weightKg, heightM)) {
    warnings.push('underweightCut');
  }

  if (isUnderweight(targetWeightKg, heightM)) {
    warnings.push('goalUnderweight');
  }

  return warnings;
}
