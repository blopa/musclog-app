import type { Units } from '../constants/settings';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { roundToDecimalPlaces } from './roundDecimal';
import { kgToDisplay } from './unitConversion';

/**
 * Locale-aware string for a weight stored in kg (workout UI: rest timer, transitions, etc.).
 *
 * **Do not** print `kgToDisplay(kg, units)` raw — always wrap with this helper (or `formatAppDecimal`
 * on the display number). See `formatAppNumber.ts` for the full display-number playbook.
 */
export function formatDisplayWeightKg(locale: string, units: Units, kg: number): string {
  const d = kgToDisplay(kg, units);
  return d % 1 === 0
    ? formatAppInteger(locale, Math.round(d))
    : formatAppDecimal(locale, roundToDecimalPlaces(d, 1), 1);
}
