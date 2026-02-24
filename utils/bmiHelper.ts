import convert from 'convert';

import { bmiFromWeightAndHeightM } from './nutritionCalculator';

export interface BMIStatus {
  bmi: number;
  statusKey: string;
}

/**
 * Determines the BMI status key based on BMI value.
 *
 * @param bmi - BMI value
 * @returns i18n status key for the BMI category
 */
export function getBMIStatusKey(bmi: number): string {
  if (bmi < 18.5) {
    return 'profile.bmiStatus.underweight';
  } else if (bmi < 25) {
    return 'profile.bmiStatus.normal';
  } else if (bmi < 30) {
    return 'profile.bmiStatus.overweight';
  } else {
    return 'profile.bmiStatus.obese';
  }
}

/**
 * Calculates BMI from weight and height in various units and returns the status key.
 *
 * @param weight - Weight value
 * @param height - Height value
 * @param weightUnit - Unit of weight ('kg' or 'lbs')
 * @param heightUnit - Unit of height ('m', 'cm', or 'in')
 * @returns Object containing BMI value and i18n status key
 */
export function calculateBMIWithStatus(
  weight: number,
  height: number,
  weightUnit: 'kg' | 'lbs',
  heightUnit: 'm' | 'cm' | 'in'
): BMIStatus {
  // Convert weight to kg if needed
  let weightKg = weight;
  if (weightUnit === 'lbs') {
    weightKg = convert(weight, 'lbs').to('kg');
  }

  // Convert height to meters if needed
  let heightM = height;
  if (heightUnit === 'cm') {
    heightM = convert(height, 'cm').to('m');
  } else if (heightUnit === 'in') {
    heightM = convert(height, 'in').to('m');
  }

  // Calculate BMI using the nutritionCalculator function
  const bmi = bmiFromWeightAndHeightM(weightKg, heightM);

  // Get the status key using the dedicated function
  const statusKey = getBMIStatusKey(bmi);

  return {
    bmi,
    statusKey,
  };
}
