/**
 * User-visible number formatting using the app locale (i18n), via `Intl.NumberFormat`.
 *
 * **Display only** — keep `roundToDecimalPlaces` / raw `number` math for DB and calculations.
 *
 * **In React:** prefer `useFormatAppNumber()` so formatters track `i18n.resolvedLanguage`.
 *
 * **Typed input:** use `utils/localizedDecimalInput.ts` (comma vs dot) for what the user types;
 * use these formatters for what the user sees (labels, summaries, charts, list rows).
 *
 * **Avoid** in UI: `Number.prototype.toFixed()`, stringifying raw floats, or assuming `.` as the
 * decimal separator — use `formatAppDecimal` / `formatAppInteger` / `formatAppRoundedDecimal`
 * (or the hook equivalents) instead.
 *
 * ---
 * **Audit (display):** Prefer `useFormatAppNumber()` in components so labels react to language changes.
 *
 * **Covered patterns**
 * - Nutrition cards/modals, progress charts, food search, daily summary, check-in modals — largely use
 *   this hook or `formatApp*` directly.
 * - **Weights stored as kg:** `formatDisplayWeightKg(locale, units, kg)` in `formatDisplayWeight.ts`
 *   (used from rest timer, exercise transition, workout session “previous set”, etc.).
 *
 * **Gaps fixed / watchlist**
 * - **`BodyMetricsCharts` / `app/progress` (custom measurements):** chart tooltips and Y-axis labels use
 *   `useFormatAppNumber` (`formatRoundedDecimal` / `formatInteger`).
 * - **`RecoveryTrainingChart`:** Y-axis labels from `getYAxisLabels` use `formatRoundedDecimal` (default
 *   formatter in `chartUtils` is still non-locale — always pass `formatFn` when showing values).
 * - **`app/workout/workout-session.tsx`:** stat cards, “previous set”, and blank-workout stat row use
 *   locale formatters for displayed numbers and units.
 * - **`CoachModal` share export:** timestamps use `toLocaleString(i18n.language)` (not default locale).
 * - **`StepperInput` / `StepperInlineInput`:** typing uses `utils/localizedDecimalInput.ts`; displayed
 *   values use `useFormatAppNumber` (`maxFractionDigits` 0 for integers, 1+ for decimals).
 *
 * **Intentionally not locale-formatted**
 * - **Percent widths** in styles: `` `${n}%` `` for CSS.
 * - **`DataLogModal`:** `Number(x.toFixed(n))` — numeric coercion for export payloads, not on-screen labels.
 * - **`utils/nutritionCalculator.ts`:** `toFixed` + `parseFloat` for stable float math, not UI.
 * - **Debug / test screens:** demos may show raw numbers.
 *
 * **Finding more:** search TSX for `kgToDisplay(` in JSX or i18n params — if the value is shown to the
 * user, wrap with `formatDecimal` / `formatInteger` or `formatDisplayWeightKg`. Avoid `toFixed` in
 * `Text`/`t()` interpolation.
 */

import { roundToDecimalPlaces } from './roundDecimal';

const formatterCache = new Map<string, Intl.NumberFormat>();

function cacheKey(locale: string, options: Intl.NumberFormatOptions): string {
  return `${locale}::${JSON.stringify(options)}`;
}

/** Memoized Intl.NumberFormat for performance (charts, lists). */
export function getAppNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/** Whole numbers (calories, counts). Grouping follows locale. */
export function formatAppInteger(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return getAppNumberFormatter(locale, {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

/** Decimals with at most `maxFractionDigits` fractional digits (macros, weight). */
export function formatAppDecimal(
  locale: string,
  value: number,
  maxFractionDigits: number,
  options?: Intl.NumberFormatOptions
): string {
  return getAppNumberFormatter(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
    ...options,
  }).format(value);
}

/** Full control (ranges, useGrouping: false, etc.). */
export function formatAppNumber(
  locale: string,
  value: number,
  options: Intl.NumberFormatOptions
): string {
  return getAppNumberFormatter(locale, options).format(value);
}

/**
 * Round with `roundToDecimalPlaces`, then format for display (common for nutrition macros).
 */
export function formatAppRoundedDecimal(
  locale: string,
  value: number,
  fractionDigits: number,
  options?: Intl.NumberFormatOptions
): string {
  return formatAppDecimal(
    locale,
    roundToDecimalPlaces(value, fractionDigits),
    fractionDigits,
    options
  );
}
