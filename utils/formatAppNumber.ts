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
 *
 * ---
 * ## Deep audit (locale display) — 2026
 *
 * **Primitives:** `formatAppInteger` / `formatAppDecimal` / `formatAppRoundedDecimal` / `formatAppNumber`
 * via `Intl.NumberFormat(locale, { useGrouping: false })`. **Weights in kg** → `formatDisplayWeightKg(locale, units, kg)`.
 *
 * **Verified using `useFormatAppNumber` or `formatApp*` in UI:** profile stats, nutrition goals / onboarding
 * results, `DailySummaryCard`, `FoodInfoCard`, `FoodNutritionSectionCard`, `MealSection`, `LogMealModal`,
 * `NutritionConfirmationModal`, `AddFoodItemToMealModal` (kcal strings), `CheckinDetailsModal`, `BodyMetricsHistoryModal`,
 * `PastWorkoutDetailModal`, `FreeSessionExerciseCompleteModal` (volume), charts under `components/progress/` and
 * `components/charts/` (tooltips / formatFn), `ServingSizeSelector`, `SmartCameraModal`, `MyMealsModal`, `FoodSearchModal`,
 * `CreateMealModal`, `workout-session` (previous-set weight), `NutritionGoalsBody`, `EditPhysicalStatsBody` (initial weight display),
 * `FoodItemCard` / `MacroItem`, widgets (`NutritionWidget`), `healthDataTransform`, `foodDisplay` (`getFoodServingDisplay`,
 * `getSimpleServingDisplay`), `workoutHistory.formatVolume`, chart `chartUtils` defaults.
 *
 * **Workout summary share text:** `app/workout/workout-summary.tsx` — calories in shared message use `formatAppInteger`;
 * volume string uses `formatDisplayWeightKg` (already).
 *
 * **Typed input (comma vs dot) is separate:** `utils/localizedDecimalInput.ts` — pair with `formatApp*` for any read-only
 * label that mirrors the same field.
 *
 * ### Follow-ups (lower priority)
 *
 * - **`StepperInput` / `StepperInlineInput`:** free typing uses ASCII `.` in the validation regex; display paths use
 *   `useFormatAppNumber`. Full locale parity for *typing* is optional (see `localizedDecimalInput` + hooks).
 * - **`ProgressMetric`:** default `formatValue` is `toString()` — component is **unused**; if you ship it, pass
 *   `formatValue` from `useFormatAppNumber` or remove the default.
 * - **Third-party / HTML:** any future web-only numeric display outside React should call `formatApp*` with `i18n.language`.
 *
 * ---
 * ## Automated sweep (March 2026)
 *
 * **Findings:** Product UI is largely consistent. `grep` for `\\.toFixed\\(` under `*.tsx` only hits
 * `DataLogModal` (numeric coercion for export payloads, not labels — intentional). Math pipelines
 * (`utils/nutritionCalculator.ts`, etc.) use `toFixed`/`parseFloat` for **computation**, not display.
 *
 * **Weights:** `kgToDisplay` returns a number — UI must not interpolate it raw; use
 * `formatDisplayWeightKg` or `formatAppDecimal` on the display value (several modals already do).
 *
 * **Small gaps fixed in the same sweep:** `ChatWorkoutCard`, `SameAsYesterdayCard`, and
 * `MealEstimationScreen` previously interpolated raw calorie/count numbers; they now use
 * `useFormatAppNumber().formatInteger` for display strings.
 *
 * **Ongoing grep hygiene (when adding UI):** avoid `` `{numericVariable}` `` in `<Text>` for
 * user-visible quantities; prefer `formatInteger` / `formatRoundedDecimal` / `formatDisplayWeightKg`.
 *
 * ---
 * ## Audit — locale display (March 2026, follow-up)
 *
 * **Sweep:** `grep` for `.toFixed(` under `*.tsx` → only `DataLogModal` (numeric coercion for export
 * payloads, not user-facing labels). `grep` for `toLocaleString` on numbers → none in product UI
 * (dates only). `formatApp*` / `useFormatAppNumber` / `formatDisplayWeightKg` coverage matches the
 * lists above; `FoodMealDetailsModal` edit form seeds macro strings with `formatAppRoundedDecimal(locale, …)`.
 *
 * **`ProgressMetric`:** default display now uses `useFormatAppNumber` (integers vs 2-decimal) so a
 * future adoption is locale-safe without passing `formatValue`.
 *
 * **Deep audit (March 2026, second pass):** Product UI was already largely correct. Gaps fixed:
 * `VolumeCaloriesChart` (axis + formatters used raw `Math.round` → `formatInteger`), `MacroMuscleChart`
 * muscle-group overlay, `WorkoutCharts` muscle-group tooltip, `NutritionCharts` `computeLeftAxisLabels`
 * (compact `k` labels now use `formatDecimal` + `formatInteger`), `DailySummaryCard` progress `%` lines
 * (`formatInteger`), `BarLineChart` / `BarLineChart.web` default `heartRateFormatter` (`formatInteger`).
 * **Still intentional:** `app/profile.tsx` edit form seeds may use `toString()` for controlled inputs;
 * **debug/test** screens may show raw numbers; **NumericInput** in tests has no central formatter;
 * **DataLogModal** `toFixed` is coercion not labels.
 *
 * ---
 * ## Deep audit (March 2026, third pass — display decimals & locale)
 *
 * **Method:** `grep` for `.toFixed(` in `*.tsx` (only `DataLogModal`, coercion); `grep` for files under
 * `app/` + `components/` missing `useFormatAppNumber` / `formatApp*` / `formatDisplayWeightKg` (many are
 * layout-only); spot-check `kgToDisplay` (callers pair with `formatDecimal` / `formatDisplayWeightKg` in
 * product flows); verify `utils/foodDisplay.ts`, `workoutHistory.formatVolume`, widgets, onboarding
 * results.
 *
 * **Conclusion:** Product surfaces that show user-facing quantities are largely covered. **Typed input**
 * (comma vs dot) stays in `localizedDecimalInput.ts`; **read-only display** stays here and in
 * `formatDisplayWeightKg`.
 *
 * **Small gaps closed in this pass:** `MacroCard` (`/` goal `g` and macro `%`); `CaloriesRemainingCard`
 * header calorie `%`; `ChatWorkoutCompletedCard` PR count (integers — still use `formatInteger` for
 * non-Latin digit locales).
 *
 * **Presentation components** (`StatCard`, `WorkoutStatCard`, `ChatWorkoutCompletedCard.volume` string):
 * receive **pre-formatted** strings from parents — callers must format before passing.
 *
 * ---
 * ## Deep audit (March 2026, fourth pass — cross-cutting string pipelines)
 *
 * **Checked:** `grep` / spot review of `kgToDisplay(` — product UIs pair with `formatDecimal` /
 * `formatDisplayWeightKg` / `useFormatAppNumber` (e.g. `CheckinDetailsModal`, `FreeSessionExerciseCompleteModal`,
 * onboarding results). `AddFoodItemToMealModal` kcal line uses pre-formatted `formatRoundedDecimal` output.
 *
 * **Implemented this pass:** `healthConnectWorkout.android.ts` / `healthConnectWorkout.ios.ts`
 * (`formatSegmentBreakdown`): set weights and rep counts in Health session notes use `formatAppDecimal` /
 * `formatAppInteger` with `i18n` locale. `workoutDetail.ts` `formatWeight` + `transformWorkoutToDetailData`
 * take `appNumberLocale` (from `usePastWorkoutDetail`). `workout.ts` `formatExerciseDescription` formats
 * displayed weight with `formatApp*`; `createExerciseOption` passes current i18n locale.
 *
 * **`utils/prompts.ts` (AI strings):** workout JSON `totalVolume` uses `formatDisplayWeightKg(locale, …)`;
 * meal critique prompts use `formatAppInteger(language, …)` for grams, kcal, and macro lines. Pass the same
 * `language` as `getBaseSystemPrompt` into `buildWorkoutSummaryJson(…, locale)`.
 *
 * **StepperInput** free-typing still uses an ASCII decimal regex for the validation path (see
 * `localizedDecimalInput` for locale-aware typing in food forms).
 *
 * **Ongoing:** When adding UI, import `useFormatAppNumber()` in the screen or use `formatApp*` with an
 * explicit `locale` argument in non-React code paths.
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
