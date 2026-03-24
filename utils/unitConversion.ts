import convert from 'convert';

import type { Units } from '../constants/settings';

/**
 * Convert weight from storage (kg) to display value.
 * Returns value in kg when metric, in lb when imperial.
 */
export function kgToDisplay(kg: number, units: Units): number {
  if (units === 'imperial') {
    return convert(kg, 'kg').to('lb') as number;
  }
  return kg;
}

/**
 * Convert display weight (user unit) to storage (kg).
 * Input is in kg when metric, in lb when imperial.
 */
export function displayToKg(value: number, units: Units): number {
  if (units === 'imperial') {
    return convert(value, 'lb').to('kg') as number;
  }
  return value;
}

/**
 * Convert height from storage (cm) to display value.
 * Returns value in cm when metric, in in when imperial.
 */
export function cmToDisplay(cm: number, units: Units): number {
  if (units === 'imperial') {
    return convert(cm, 'cm').to('in') as number;
  }
  return cm;
}

/**
 * Convert display height (user unit) to storage (cm).
 * Input is in cm when metric, in in when imperial.
 */
export function displayToCm(value: number, units: Units): number {
  if (units === 'imperial') {
    return convert(value, 'in').to('cm') as number;
  }
  return value;
}

/**
 * Convert mass (food amount) from storage (g) to display value.
 * Returns value in g when metric, in oz when imperial.
 */
export function gramsToDisplay(g: number, units: Units): number {
  if (units === 'imperial') {
    return convert(g, 'g').to('oz') as number;
  }
  return g;
}

/**
 * Convert display mass (user unit) to storage (g).
 * Input is in g when metric, in oz when imperial.
 */
export function displayToGrams(value: number, units: Units): number {
  if (units === 'imperial') {
    return convert(value, 'oz').to('g') as number;
  }

  return value;
}

/**
 * Return the mass unit label key or literal for display (e.g. 'g' vs 'oz').
 * For i18n you may have keys like 'food.unitGrams' / 'food.unitOz'.
 */
export function getMassUnitLabel(units: Units): 'g' | 'oz' {
  return units === 'imperial' ? 'oz' : 'g';
}

/**
 * Normalize stored weight value to canonical kg (for legacy lbs in DB).
 */
export function storedWeightToKg(value: number, storedUnit?: string | null): number {
  if (storedUnit === 'lbs') {
    return convert(value, 'lb').to('kg') as number;
  }
  return value;
}

/**
 * Normalize stored height value to canonical cm (for legacy in in DB).
 */
export function storedHeightToCm(value: number, storedUnit?: string | null): number {
  if (storedUnit === 'in') {
    return convert(value, 'in').to('cm') as number;
  }
  return value;
}
