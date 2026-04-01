import type { Units } from '../constants/settings';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { roundToDecimalPlaces } from './roundDecimal';
import { gramsToDisplay, kgToDisplay } from './unitConversion';

/**
 * Locale-aware string for a weight stored in kg (workout UI: rest timer, transitions, etc.).
 *
 * **Do not** print `kgToDisplay(kg, units)` raw — always wrap with this helper (or `formatAppDecimal`
 * on the display number). See `formatAppNumber.ts` for the display-number playbook.
 */
export function formatDisplayWeightKg(locale: string, units: Units, kg: number): string {
  const d = kgToDisplay(kg, units);
  return d % 1 === 0
    ? formatAppInteger(locale, Math.round(d))
    : formatAppDecimal(locale, roundToDecimalPlaces(d, 1), 1);
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
