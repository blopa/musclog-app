import convert from 'convert';
import { bmiFromWeightAndHeightM } from './nutritionCalculator';

export interface BMIStatus {
  bmi: number;
  statusKey: string;
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

  // Determine BMI status key
  const statusKey =
    bmi < 18.5
      ? 'profile.bmiStatus.underweight'
      : bmi < 25
        ? 'profile.bmiStatus.normal'
        : bmi < 30
          ? 'profile.bmiStatus.overweight'
          : 'profile.bmiStatus.obese';

  return {
    bmi,
    statusKey,
  };
}
