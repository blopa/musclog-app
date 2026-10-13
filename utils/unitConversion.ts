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

const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.344;

/** Distance is stored in metres; a metric user sees kilometres, an imperial one miles. */
export function getDistanceUnitLabel(units: Units): 'km' | 'mi' {
  return units === 'imperial' ? 'mi' : 'km';
}

export function metersToDisplayDistance(meters: number, units: Units): number {
  return meters / (units === 'imperial' ? METERS_PER_MILE : METERS_PER_KILOMETER);
}

export function displayDistanceToMeters(value: number, units: Units): number {
  return value * (units === 'imperial' ? METERS_PER_MILE : METERS_PER_KILOMETER);
}

/**
 * Seconds to cover one display unit (a kilometre or a mile) at the average pace of a session, or
 * `null` when there is no distance or no time to divide by — a pace of "0:00" or "Infinity" would
 * read as a result rather than as missing data.
 */
export function paceSecondsPerDisplayUnit(
  distanceM: number,
  durationS: number,
  units: Units
): number | null {
  if (
    !Number.isFinite(distanceM) ||
    !Number.isFinite(durationS) ||
    distanceM <= 0 ||
    durationS <= 0
  ) {
    return null;
  }

  return durationS / metersToDisplayDistance(distanceM, units);
}

/** A weight unit a gym or an exercise can pin, as stored. */
export type WeightUnitOverride = 'kg' | 'lbs';

export function isWeightUnitOverride(value: unknown): value is WeightUnitOverride {
  return value === 'kg' || value === 'lbs';
}

/**
 * The unit system an exercise's weights are shown and entered in.
 *
 * The most specific statement wins: the exercise's own override, then the gym being trained in
 * (a gym whose plates are pounds is lifted in pounds whatever the account says), then the account
 * default. Anything that is not exactly 'kg' or 'lbs' — an absent override, a value written by a
 * newer build — is "no statement" rather than an error, so a bad row can never blank a weight.
 *
 * The result feeds the ordinary weight helpers (`kgToDisplay`, `displayToKg`,
 * `getWeightUnitI18nKey`). The database stays metric whichever unit is shown.
 */
export function resolveWeightUnits({
  account,
  gym,
  exercise,
}: {
  account: Units;
  gym?: unknown;
  exercise?: unknown;
}): Units {
  let pinned: WeightUnitOverride | null = null;
  if (isWeightUnitOverride(exercise)) {
    pinned = exercise;
  } else if (isWeightUnitOverride(gym)) {
    pinned = gym;
  }

  if (pinned === null) {
    return account;
  }

  return pinned === 'lbs' ? 'imperial' : 'metric';
}

/** The storable override that selects `units`, for a picker that edits one. */
export function weightUnitOverrideFor(units: Units): WeightUnitOverride {
  return units === 'imperial' ? 'lbs' : 'kg';
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
 * Rounds a weight to a whole number in the unit the user sees, returned in kg: 102.5 kg is 103 kg
 * for a metric user and 226 lb (102.5 kg) for an imperial one. This is the app's long-standing
 * rounding of a computed load when no gym describes the equipment.
 */
export function roundWeightForUnits(kg: number, units: Units): number {
  if (units === 'imperial') {
    return displayToKg(Math.round(kgToDisplay(kg, units)), units);
  }

  return Math.round(kg);
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
export function prepareMetricDataToSave<T extends Record<string, unknown>>(
  data: T,
  fields: { key: keyof T; type: 'weight' | 'length' | 'mass' }[],
  units: Units
): T {
  const result = { ...data };
  const mutableResult = result as Record<keyof T, unknown>;
  for (const { key, type } of fields) {
    const value = result[key];
    if (typeof value === 'number') {
      switch (type) {
        case 'weight':
          mutableResult[key] = displayToKg(value, units);
          break;
        case 'length':
          mutableResult[key] = displayToCm(value, units);
          break;
        case 'mass':
          mutableResult[key] = displayToGrams(value, units);
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
export function prepareMetricDataToDisplay<T extends Record<string, unknown>>(
  data: T,
  fields: { key: keyof T; type: 'weight' | 'length' | 'mass' }[],
  units: Units
): T {
  const result = { ...data };
  const mutableResult = result as Record<keyof T, unknown>;
  for (const { key, type } of fields) {
    const value = result[key];
    if (typeof value === 'number') {
      switch (type) {
        case 'weight':
          mutableResult[key] = kgToDisplay(value, units);
          break;
        case 'length':
          mutableResult[key] = cmToDisplay(value, units);
          break;
        case 'mass':
          mutableResult[key] = gramsToDisplay(value, units);
          break;
      }
    }
  }

  return result;
}
