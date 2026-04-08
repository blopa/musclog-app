/**
 * Unit conversion for user settings (metric vs imperial).
 *
 * **Storage (DB)** is always metric: body weights in kg, lengths in cm, food portions in g,
 * workout set weights in kg.
 *
 * **Use these at UI boundaries:**
 * - Body metrics by `UserMetricType`: {@link metricValueToDisplay} / {@link displayValueToMetric}
 * - Workout / barbell weight (kg stored): {@link kgToDisplay} / {@link displayToKg}
 * - Food mass (grams stored): {@link gramsToDisplay} / {@link displayToGrams}
 *
 * Macros (protein, carbs, etc.) stay in grams for both systems per product rules.
 */
import convert from 'convert';

import type { Units } from '@/constants/settings';
import type { UserMetricType } from '@/database/models';

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

/**
 * Prepare metric data for database storage.
 * Converts user input (in display units) to metric (kg, cm, g).
 *
 * @param data - The data object containing values to convert
 * @param fields - Array of field configurations with key and type
 * @param units - User's unit preference ('metric' or 'imperial')
 * @returns New object with converted values
 *
 * @example
 * ```typescript
 * const saveData = prepareMetricDataToSave(
 *   { targetWeight: 180, height: 72 },
 *   [{ key: 'targetWeight', type: 'weight' }, { key: 'height', type: 'length' }],
 *   'imperial'
 * );
 * // Result: { targetWeight: 81.6, height: 182.88 }
 * ```
 */
export function prepareMetricDataToSave<T extends Record<string, any>>(
  data: T,
  fields: { key: keyof T; type: 'weight' | 'length' | 'mass' }[],
  units: Units
): T {
  const result = { ...data };
  for (const { key, type } of fields) {
    const value = result[key];
    if (typeof value === 'number') {
      switch (type) {
        case 'weight':
          (result as any)[key] = displayToKg(value, units);
          break;
        case 'length':
          (result as any)[key] = displayToCm(value, units);
          break;
        case 'mass':
          (result as any)[key] = displayToGrams(value, units);
          break;
      }
    }
  }
  return result;
}

/**
 * Prepare metric data from database for display.
 * Converts stored metric values (kg, cm, g) to display units.
 *
 * @param data - The data object containing metric values from DB
 * @param fields - Array of field configurations with key and type
 * @param units - User's unit preference ('metric' or 'imperial')
 * @returns New object with converted values for display
 *
 * @example
 * ```typescript
 * const displayData = prepareMetricDataToDisplay(
 *   { weight: 75 },
 *   [{ key: 'weight', type: 'weight' }],
 *   'imperial'
 * );
 * // Result: { weight: 165.3 }
 * ```
 */
export function prepareMetricDataToDisplay<T extends Record<string, any>>(
  data: T,
  fields: { key: keyof T; type: 'weight' | 'length' | 'mass' }[],
  units: Units
): T {
  const result = { ...data };
  for (const { key, type } of fields) {
    const value = result[key];
    if (typeof value === 'number') {
      switch (type) {
        case 'weight':
          (result as any)[key] = kgToDisplay(value, units);
          break;
        case 'length':
          (result as any)[key] = cmToDisplay(value, units);
          break;
        case 'mass':
          (result as any)[key] = gramsToDisplay(value, units);
          break;
      }
    }
  }
  return result;
}
