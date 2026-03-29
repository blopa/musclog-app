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
 * ## Display audit (how to stay consistent)
 *
 * **Prefer in React:** `useFormatAppNumber()` so strings update when the user changes language.
 *
 * **Weights stored in kg:** `formatDisplayWeightKg(locale, units, kg)` from `formatDisplayWeight.ts`
 * (rest timer, exercise transition, workout session “previous set”, goal cards, **workout summary volume**).
 *
 * **Large workout volume strings (kg·reps aggregate):** `formatVolume` in `utils/workoutHistory.ts` uses
 * `formatAppInteger` / `formatAppDecimal` with an app locale passed from `processWorkouts`.
 *
 * **Typed input (comma vs dot on keyboard):** `utils/localizedDecimalInput.ts` — separate from display;
 * pair with these formatters for any mirrored read-only label.
 *
 * ### Coverage sweep (deep audit, 2026)
 *
 * **React UI:** Prefer `useFormatAppNumber()` everywhere user-visible numbers appear (macros, calories,
 * percentages, chart tooltips, profile stats, `LogMealModal`, `NutritionConfirmationModal`, food cards,
 * `CheckinDetailsModal`, `FreeSessionExerciseCompleteModal`, `profile`, progress charts, etc.).
 *
 * **Weights stored in kg:** `formatDisplayWeightKg(locale, units, kg)` from `formatDisplayWeight.ts`
 * (workout summary volume string, rest timer, exercise transition, goal cards, `WorkoutHistory` via
 * `formatVolume` in `workoutHistory.ts`).
 *
 * **Serving / mass strings:** `utils/foodDisplay.ts` (`getFoodServingDisplay`, `getSimpleServingDisplay`)
 * uses `formatAppInteger` / `formatAppDecimal` with an explicit `locale` argument.
 *
 * **Non-React / services:** `healthDataTransform.ts`, widgets (`NutritionWidget`), `workoutHistory`
 * `formatVolume` — pass `i18n.language` or `locale` into `formatApp*` functions.
 *
 * **Chart helpers:** `utils/chartUtils.ts` `getYAxisLabels` — when `formatFn` is omitted, the default
 * Y-label formatter uses `formatAppDecimal` + current i18n locale (still prefer passing `formatFn`
 * from the chart component for units, e.g. `%`, `g`). `getXAxisLabels` uses **dates** (date-fns), not
 * this module.
 *
 * **Typed input vs display:** `utils/localizedDecimalInput.ts` — comma/dot for **editing**; `formatApp*`
 * for **read-only** labels. Do not mix: formatted strings are not valid for `parseFloat` without
 * normalizing.
 *
 * ### Watchlist / grep hygiene
 *
 * - **Avoid in UI:** `Number.prototype.toFixed`, raw `` `${float}` `` in `Text`, `parseFloat` → string for
 *   display. Prefer `formatDecimal` / `formatInteger` / `formatRoundedDecimal`.
 * - **`toLocaleString`:** fine for dates/times; for **numbers**, prefer `formatApp*` so options match the
 *   rest of the app (rounding). **Thousands separators are off by default** (`useGrouping: false`).
 * - **`kgToDisplay`:** returns a **number** — do not interpolate it directly into UI; wrap with
 *   `formatDisplayWeightKg` or `formatDecimal` as appropriate.
 * - **`components/ProgressMetric.tsx`:** default `formatValue` uses `toString()` — component is currently
 *   unused; if you adopt it, pass `formatValue` from `useFormatAppNumber`.
 * - **`StepperInput` / `StepperInlineInput`:** display uses `useFormatAppNumber`; input sanitization uses
 *   `localizedDecimalInput` (locale-aware).
 *
 * ### Intentionally not locale-formatted
 *
 * - **CSS:** `` `${n}%` ``, layout math.
 * - **`DataLogModal`:** `Number(x.toFixed(n))` — coercion for export payloads, not labels.
 * - **`utils/nutritionCalculator.ts`:** float math, not UI.
 * - **Debug / test screens** (`app/test/*`): may show raw numbers.
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

/** Whole numbers (calories, counts). No thousands separator — `useGrouping` is always off. */
export function formatAppInteger(
  locale: string,
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return getAppNumberFormatter(locale, {
    maximumFractionDigits: 0,
    ...options,
    useGrouping: false,
  }).format(value);
}

/** Decimals with at most `maxFractionDigits` fractional digits (macros, weight). No grouping. */
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
    useGrouping: false,
  }).format(value);
}

/** Full control over fraction digits etc. Thousands separators are always off. */
export function formatAppNumber(
  locale: string,
  value: number,
  options: Intl.NumberFormatOptions
): string {
  return getAppNumberFormatter(locale, {
    ...options,
    useGrouping: false,
  }).format(value);
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
