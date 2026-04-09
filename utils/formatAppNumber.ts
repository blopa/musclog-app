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
 *
 * ---
 * ## Coverage audit (decimal separators & locale)
 *
 * **Primary APIs**
 * - `useFormatAppNumber()` — React components; `locale` tracks i18n.
 * - `formatDisplayWeightKg` / `formatDisplayGrams` (`formatDisplayWeight.ts`) — mass after unit conversion.
 * - `getFoodServingDisplay` / `getSimpleServingDisplay` (`foodDisplay.ts`) — portions; grams use `formatDisplayGrams`.
 * - `formatVolume` (`workoutHistory.ts`) — workout volume string with locale.
 * - `formatDuration(minutes, t, locale)` (`workoutHistory.ts`) — workout duration stats (minutes-based).
 *
 * **Already wired across UI** — Most cards, charts, modals, nutrition progress, and widgets import
 * `useFormatAppNumber` or the helpers above. Search: `useFormatAppNumber`, `formatDisplayWeightKg`,
 * `formatAppInteger`, `formatAppDecimal`.
 *
 * **Intentionally not locale-formatted** (non-user copy, structure, or machine values)
 * - `Number(x.toFixed(n))` / `roundToDecimalPlaces` in services and `DataLogModal` — rounding for **storage**
 *   or API payloads, not display strings.
 * - `utils/workout.ts` `formatDuration(h, m, s)` — **clock-style** `HH:MM:SS` for live session timer (not a
 *   “number in locale” string; digits are fixed-width time).
 * - CSS `width: \`${pct}%\``, animation `transform`, chart canvas internals.
 * - `MealEstimationScreen` `IdentifiedItem.weight` — **string** from AI (pre-formatted upstream).
 * - `AddFoodItemToMealModal` `calories` variable is **already** `formatRoundedDecimal(...)` (formatted string).
 *
 * **Optional follow-ups**
 * - `utils/workout.ts` timer display: could use `Intl` for locales that prefer different digit sets for time
 *   (low priority; time is not a decimal “amount”).
 * - i18n interpolation like `t('key', { minutes })` — if `minutes` must show locale digits, pass a
 *   pre-formatted string from `formatAppInteger` into the translation value.
 *
 * **Regression check** — Ripgrep for user-visible anti-patterns when touching UI numbers:
 * `\.toFixed\(` in `*.tsx` (excluding tests), or `` `${` `` + raw numeric variables in new `Text` nodes.
 *
 * ---
 * ## Audit (2026) — decimal separator / locale for **display**
 *
 * - **`.toFixed(` in `*.tsx`:** only `DataLogModal` (rounding numeric payloads for dev tools / export, not
 *   end-user locale strings) — OK.
 * - **`MacroInput` + nutrition editing:** `CreateCustomFoodModal` + `FoodMealDetailsModal` use
 *   `formatAppRoundedDecimal` for seeded display strings; input uses `localizedDecimalInput.ts` for typing.
 * - **Portion labels:** `FoodMealDetailsModal` `generatePortionName` (auto-created `FoodPortion.name` from
 *   barcode/serving match) uses **`formatDisplayGrams(locale, units, grams)`** so amounts follow locale.
 * - **Serving UI:** `ServingSizeSelector` + `StepperInput` use `useFormatAppNumber` for tab labels; numeric
 *   `gramsToDisplay` is only the internal stepper **value** (Stepper formats for display).
 * - **Widgets:** `widgets/NutritionWidget.tsx` uses `formatAppInteger` + i18n locale.
 * - **Services (Health Connect, etc.):** `formatAppDecimal` / `formatAppInteger` build **string fields** for
 *   native health APIs — display-oriented; DB remains numeric.
 * - **Earlier gaps (fixed):** `ViewExerciseModal`, `app/cycle.tsx` flow intensity — now use locale helpers.
 * - **Still intentionally plain:** test screens, chart demo props with hardcoded `"23%"`, `ActivityRingsChart`
 *   `value: string` (callers pre-format), time `HH:MM:SS`, CSS `%` widths.
 * - **Not display strings:** `roundToDecimalPlaces` in services / `MyMealsModal` AI→`createCustomFood`,
 *   `utils/nutritionCalculator` `parseFloat(.toFixed())` — **numeric** pipeline for DB/API.
 *
 * ### Deep scan (2026-03) — `kgToDisplay` / `gramsToDisplay` vs locale
 *
 * Raw `kgToDisplay` / `gramsToDisplay` return **numbers** (still using `.` internally). **UI must not**
 * stringify them for users except via `useFormatAppNumber` / `formatDisplayWeightKg` / `formatDisplayGrams`
 * / chart helpers. Verified: `FoodItemCard` (`MacroItem` → `formatRoundedDecimal`), `nutrition-goals-results`
 * (`formatDecimal` / `formatInteger`), `CheckinDetailsModal` weight rows, `BodyMetricsHistoryModal` deltas,
 * `profile` stats, `FreeSessionExerciseCompleteModal` volume, `ServingSizeSelector` quick tabs, `StepperInput`
 * / `StepperInlineInput` `formatValue`. **Typing** locale (comma vs dot) lives in `localizedDecimalInput.ts`;
 * **display** locale lives here — keep both when adding numeric fields.
 *
 * ### Ongoing checklist (new UI)
 *
 * 1. User-visible number → `useFormatAppNumber()` or `formatDisplayWeight*` / `foodDisplay` helpers.
 * 2. Avoid `toFixed` / `` `${n}` `` in `Text` for amounts (see regression grep above).
 * 3. `t('key', { count: n })` / `t('key', { value: n })` → pass **pre-formatted** strings if separators matter.
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
