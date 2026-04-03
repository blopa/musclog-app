import convert from 'convert';

import type { Units } from '../constants/settings';
import type { UserMetricType } from '../database/models';

/** Metric types stored in kg that need kg↔lbs conversion. */
const WEIGHT_METRIC_TYPES: ReadonlySet<UserMetricType> = new Set([
  'weight',
  'muscle_mass',
  'lean_body_mass',
]);

/** Metric types stored in cm that need cm↔in conversion. */
const LENGTH_METRIC_TYPES: ReadonlySet<UserMetricType> = new Set([
  'height',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
  'neck',
  'shoulders',
]);

/** Check whether a metric type is stored in kg (needs weight conversion). */
export function isWeightMetricType(type: string): boolean {
  return WEIGHT_METRIC_TYPES.has(type as UserMetricType);
}

/** Check whether a metric type is stored in cm (needs length conversion). */
export function isLengthMetricType(type: string): boolean {
  return LENGTH_METRIC_TYPES.has(type as UserMetricType);
}

/**
 * Convert a stored metric value to its display value based on its type and user units.
 * Weight types: kg → lbs (imperial) or passthrough.
 * Length types: cm → in (imperial) or passthrough.
 * Other types: passthrough (%, kcal, mood, etc.).
 */
export function metricValueToDisplay(value: number, type: string, units: Units): number {
  if (isWeightMetricType(type)) {
    return kgToDisplay(value, units);
  }

  if (isLengthMetricType(type)) {
    return cmToDisplay(value, units);
  }

  return value;
}

/**
 * Convert a user-entered display value back to storage units based on its type and user units.
 * Weight types: lbs → kg (imperial) or passthrough.
 * Length types: in → cm (imperial) or passthrough.
 * Other types: passthrough.
 */
export function displayValueToMetric(value: number, type: string, units: Units): number {
  if (isWeightMetricType(type)) {
    return displayToKg(value, units);
  }

  if (isLengthMetricType(type)) {
    return displayToCm(value, units);
  }

  return value;
}

/**
 * Return the display unit label for a metric type given the user's unit system.
 * Weight types: 'kg' or 'lbs'. Length types: 'cm' or 'in'.
 * Other types: the stored unit as-is (e.g. '%', 'kcal', undefined).
 */
export function metricDisplayUnit(
  type: string,
  units: Units,
  storedUnit?: string
): string | undefined {
  if (isWeightMetricType(type)) {
    return units === 'imperial' ? 'lbs' : 'kg';
  }

  if (isLengthMetricType(type)) {
    return units === 'imperial' ? 'in' : 'cm';
  }

  return storedUnit;
}

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
