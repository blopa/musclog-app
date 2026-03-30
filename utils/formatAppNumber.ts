import { roundToDecimalPlaces } from './roundDecimal';

/**
 * **Display-only** number formatting (comma vs dot, etc.) via `Intl.NumberFormat`.
 * Storage stays `number`; never persist these strings.
 *
 * **Use in UI**
 * - Prefer `useFormatAppNumber()` so `locale` tracks `i18n.resolvedLanguage ?? i18n.language`.
 * - **Integers** (kcal counts, reps): `formatInteger` / `formatAppInteger`.
 * - **Decimals** (macros g, 1–2 dp): `formatDecimal`, `formatRoundedDecimal`, or `formatAppRoundedDecimal`.
 * - **Weight in kg** → user units (kg/lb): `formatDisplayWeightKg` in `formatDisplayWeight.ts`.
 * - **Mass in grams** → g/oz display amount only: `formatDisplayGrams` in `formatDisplayWeight.ts`;
 *   food copy like “12 g serving”: `getSimpleServingDisplay` / `getFoodServingDisplay` in `foodDisplay.ts`.
 *
 * **Avoid** interpolating raw `number` or `toFixed()` in `Text` for user-visible values.
 */

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
