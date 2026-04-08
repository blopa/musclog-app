import type { Units } from '@/constants/settings';

import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { roundToDecimalPlaces } from './roundDecimal';
import { gramsToDisplay, kgToDisplay } from './unitConversion';

/**
 * Weight stored in kg → display value in kg or lb, rounded to one decimal when not whole.
 * Same rules as {@link formatDisplayWeightKg}; use when the UI needs a number (e.g. set rows)
 * instead of a locale-formatted string.
 */
export function displayWeightKgNumeric(storedKg: number, units: Units): number {
  const d = kgToDisplay(storedKg, units);
  return d % 1 === 0 ? d : roundToDecimalPlaces(d, 1);
}

/**
 * Locale-aware string for a weight stored in kg (workout UI: rest timer, transitions, etc.).
 *
 * **Do not** print `kgToDisplay(kg, units)` raw — always wrap with this helper (or `formatAppDecimal`
 * on the display number). See `formatAppNumber.ts` for the display-number playbook.
 */
export function formatDisplayWeightKg(locale: string, units: Units, kg: number): string {
  const rounded = displayWeightKgNumeric(kg, units);
  return rounded % 1 === 0
    ? formatAppInteger(locale, Math.round(rounded))
    : formatAppDecimal(locale, rounded, 1);
}

/**
 * Locale-aware numeric string for a mass given in **grams** (food portions, serving sizes).
 * Converts to g or oz via `gramsToDisplay`, then formats with the user locale.
 * Append `getMassUnitLabel(units)` in the UI when you need the unit suffix.
 */
export function formatDisplayGrams(locale: string, units: Units, gramWeight: number): string {
  const d = gramsToDisplay(gramWeight, units);
  return d % 1 === 0
    ? formatAppInteger(locale, Math.round(d))
    : formatAppDecimal(locale, roundToDecimalPlaces(d, 1), 1);
}
