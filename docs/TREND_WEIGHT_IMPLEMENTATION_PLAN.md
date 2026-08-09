# Trend Weight — Implementation Plan

> Implemented in August 2026. This document is retained as the design and validation record;
> follow-up work on whole-series TDEE regression and expenditure confidence remains out of scope.

## Decision

Implement **trend weight** next.

This is the best value-per-effort item in the roadmap because it improves three things at once:

1. **Daily experience:** a noisy weigh-in no longer looks like sudden success or failure.
2. **Nutrition coaching:** check-ins can compare the user's underlying direction with their target.
3. **Calculation quality:** empirical TDEE can use smoothed weight anchors instead of noisy scale
   readings or first/last-week averages.

MacroFactor makes the same connection explicit: its trend weight filters transient water and food
mass, appears alongside scale weight, and feeds expenditure and calorie-target calculations. Its
documentation says missing days are linearly interpolated before a recent-weighted moving average
is calculated. Users also describe the long-term expenditure view built on this loop as a favorite
feature. Bevel's muscular load and recovery loop is compelling, but Musclog already has more of that
foundation; trend weight closes a more consequential correctness gap with a smaller change.

Research references:

- [MacroFactor: Weight Trend](https://help.macrofactorapp.com/dashboard/weight_trend)
- [MacroFactor: Dashboard and interpreted metrics](https://help.macrofactorapp.com/dashboard/consistency/)
- [MacroFactor: weigh-in frequency and interpolation](https://help.macrofactorapp.com/en/articles/109-how-frequently-do-i-need-to-log-my-weight-for-the-expenditure-algorithm-and-weekly-coaching-updates)
- [Bevel: Strength Builder](https://help.bevel.health/en/articles/11258753)
- [Hacker's Diet: exponentially smoothed weight trend](https://www.fourmilab.ch/hackdiet/www/subsubsection1_2_4_0_4_4.html)
- [NIST: single exponential smoothing](https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc431.htm)

## Product outcome

The user should see one calm, trustworthy weight trajectory without losing access to the measurements
that produced it.

- The **trend** is the primary line and primary summary value.
- Individual **scale weights** remain visible as subdued points and remain editable in metric history.
- A chart press shows both values when a weigh-in exists on that day.
- Check-ins use trend weight to determine progress, while their seven-day bars continue to show raw
  measurements.
- Empirical TDEE uses trend endpoints. Whole-series TDEE regression and an expenditure confidence
  band remain separate roadmap items.

No new home card is included in v1. There is no existing home weight surface, so adding one would be
a separate dashboard-information-architecture decision rather than part of replacing a raw value.

## UX specification

### Progress screen

Replace the current single-line Weight card with a dedicated trend card:

- Header: **Weight trend**
- Primary value: latest trend weight and the active unit
- Secondary value: change over the trailing seven calendar days
- Chart:
  - solid accent line and subtle area fill for trend weight;
  - small, low-contrast points for actual weigh-ins;
  - no connecting raw-weight line in v1, so gaps are not presented as observations;
  - compact legend: **Trend** and **Scale weight**;
  - shared tooltip with date, trend, and scale weight when available.
- Explanation below the summary: the trend filters normal changes in water, food, and hydration.
- Early state:
  - one weigh-in: show scale weight and “Add another weigh-in to start your trend”;
  - two or more weigh-ins: show the trend;
  - fewer than seven calendar days of history: omit the seven-day delta.

The existing date filter still controls the visible chart. The trend calculation receives a warm-up
window from before the visible start so changing from 90 days to 30 days does not change overlapping
trend values.

### Nutrition charts

Use trend weight, rather than raw scale weight, for the weight line in the combined nutrition/weight
views. The dedicated Weight card remains the place to inspect raw measurements.

### Nutrition check-in

The current card is already titled “Weight Trend” but displays a seven-day arithmetic average. Make
the terminology true:

- primary value: trend weight at the check-in boundary;
- delta badge: trend weight minus target weight;
- raw seven-day bar chart: unchanged;
- insufficient-data warning: keep the existing nutrition/weight coverage rule, but distinguish
  “not enough data” from a valid trend with sparse raw weigh-ins.

## Algorithm

### Inputs and units

The pure algorithm accepts points shaped as `{ date, value }` where:

- `date` is a UTC-normalized calendar-day key from `utcNormalizedDayKey`;
- `value` is kilograms;
- input order is irrelevant.

All smoothing happens in kilograms. Conversion to pounds happens only when constructing display
data. This follows the repository rule that persisted and calculated body values remain metric.

### Normalization

1. Sort by normalized day key.
2. Average multiple valid weigh-ins on the same calendar day.
3. Linearly interpolate days strictly between two observed days.
4. Do not backfill before the first observation or carry values beyond the last observation.

Interpolation makes a missed weigh-in neutral instead of treating the next measurement as a sudden
one-day change. Same-day averaging avoids making the result depend on database row order.

### Smoothing

Use a daily exponentially weighted moving average:

```text
trend[0] = dailyWeight[0]
trend[d] = alpha * dailyWeight[d] + (1 - alpha) * trend[d - 1]
```

Start with `alpha = 0.10`, the established Hacker's Diet value: 10% of the new daily estimate and
90% of the prior trend. Keep it as a named exported constant, not a user setting. The exact value is
a product/calibration choice, so lock representative fixtures in tests and review its behavior on
seeded cut, maintenance, and bulk series before release.

The merged roadmap mentioned `alpha ≈ 0.25`; research favors beginning with the calmer, established
0.10 value. A 0.25 trend reacts much more strongly to a single water-weight swing and weakens the
main psychological and calculation benefit of the feature.

### Boundary stability

An EWMA depends on earlier observations. Every caller that requests a bounded range must fetch at
least 28 extra calendar days before its start, calculate over the expanded sequence, then slice the
result to the requested range. Tests must prove that a day has the same trend value in 30-day and
90-day views when both calls have the same underlying history.

For “all” history, calculation begins at the first valid weigh-in. For a new user, the first trend
value necessarily equals the first scale weight; UI copy handles this low-confidence state.

### Pure utility API

Add `utils/trendWeight.ts` with a small, reusable surface:

```ts
export interface WeightPoint {
  date: number;
  value: number;
}

export const TREND_WEIGHT_ALPHA = 0.1;
export const TREND_WEIGHT_WARMUP_DAYS = 28;

export function calculateTrendWeightSeries(
  observedWeightsKg: WeightPoint[],
  options?: { alpha?: number }
): WeightPoint[];

export function trendWeightAtOrBefore(trend: WeightPoint[], dayKey: number): WeightPoint | null;
```

Keep interpolation private unless another real caller needs it. The utility does no I/O, unit
conversion, localization, or mutation.

## Data and service changes

### `ProgressService`

Refactor the weight path in `database/services/ProgressService.ts`:

1. Fetch weight records from `startDate - TREND_WEIGHT_WARMUP_DAYS` through `endDate`.
2. Decrypt and normalize them to kilogram `MetricPoint`s.
3. Calculate the trend over the expanded range.
4. Slice raw and trend series to the requested visible range.
5. Convert both series to display units at the response boundary.
6. Add `weightTrendHistory: MetricPoint[]` to `ProgressData`; preserve `weightHistory` as raw data.

Use the trend series for:

- the Weight card;
- `ProgressInsights.weightChangeWeekly` and `weightTrend` classification;
- the weight line passed to `NutritionCharts`;
- empirical TDEE weight anchors.

Continue using raw observed weights for FFMI calculations and any view that represents a
measurement. This avoids fabricating body-composition observations on interpolated days.

The progress screen's `useWeeklyAverages` control must not re-smooth trend weight. When enabled, it
may reduce the raw point density shown in the chart, but `weightTrendHistory` remains the canonical
daily trend.

**As built:** `calculateEmpiricalTDEEWindow` takes `weightsArePresmoothed` rather than a single
`useEndpointAverages` switch. The distinction matters: the flag governs the WEIGHT anchors only (and
therefore the window, which must match them). Body-fat endpoints are averaged whenever the window is
long enough either way, because body fat is never smoothed and does not define the window. An
earlier `useEndpointAverages` governed both at once, which silently downgraded the fat anchors to
single-day readings and forced `ProgressService.calculateInsights` into a second, duplicate call
just to recover them.

Collapsing same-day readings is `averagePointsByDay` in `utils/trendWeight.ts` — the single
definition used by the trend filter, the chart's scatter series, the weekly check-in, and
`calculateEmpiricalTDEEWindow`. Do not re-inline a by-day grouping; four copies (one of them
last-wins rather than mean) previously gave "my weight on day X" more than one answer depending on
which screen asked.

### `historicalNutritionParams`

Update `utils/historicalNutritionParams.ts` to fetch the warm-up window for weight metrics, calculate
trend weight, and return trend values at the empirical window's initial and final boundaries.

For compatibility, retain the existing `HistoricalNutritionParams` field names in this phase. The
values behind `historicalInitialWeightKg` and `historicalFinalWeightKg` become trend weights and the
comments/tests must say so. Remove the first-week/last-week averaging branch only after all callers
and mocks are migrated. The next roadmap item—whole-series regression—will replace these endpoints
with a fitted rate and confidence interval.

### `NutritionCheckinService`

Fetch enough pre-period weight history to warm the trend, then return explicit names in
`CheckinMetrics`:

```ts
scaleWeightAverage: number;
trendWeight: number;
targetWeightDelta: number;
dailyWeights: number[];
```

Do not keep the current ambiguous `avgWeight` and `trend` names. Update status calculation to compare
`trendWeight` with the target. Preserve the raw daily array for the bar chart.

### Persistence and reactivity

Do not add a database column or derived `user_metrics` row. Trend weight is computed from decrypted
weight history on demand because:

- edits and deletions then recalculate correctly;
- Health Connect/HealthKit imports cannot leave a cache stale;
- no encrypted derived value or migration is needed;
- export/restore remains unchanged.

The current progress refresh and check-in load paths are sufficient for v1. If profiling shows the
calculation itself is meaningful—which is unlikely for a few thousand scalar points—memoize at the
hook/service boundary using the raw record ids and `updated_at` values, not persisted state.

## Chart implementation

Add `components/progress/WeightTrendChart.tsx`. It uses the existing platform-resolved `LineChart`
implementations, so a re-export-only `.web.tsx` wrapper is unnecessary.

Use `victory-native` on native and `victory` on web, matching the repository's chart convention.
Build a dedicated component instead of adding weight-specific secondary-series behavior to the
generic `LineChart`.

The component accepts raw and trend points already converted for display. Its tooltip-selection
logic should live in a pure helper/view model so it can be unit tested without depending on Skia or
SVG rendering. It must integrate with `ChartTooltipContext` and honor the configured tooltip side.

Accessibility requirements:

- an accessible chart summary containing current trend and seven-day change;
- legend labels are text, not color alone;
- raw points remain distinguishable in light and dark themes;
- shared/captured charts include the legend and explanatory subtitle.

## Localization

Add copy to `progress.json` and `nutrition.json` for all five locales:

- `en-us`
- `es-es`
- `nl-nl`
- `pt-br`
- `ru-ru`

Required concepts include Weight trend, Scale weight, seven-day change, the smoothing explanation,
and the one-weigh-in empty state. All values use `useFormatAppNumber`; units use existing unit
helpers. Do not use `toFixed` or raw numeric interpolation in JSX.

## Testing strategy

### Pure algorithm tests — `utils/__tests__/trendWeight.test.ts`

Cover:

- empty and one-point input;
- unsorted input;
- same-day averaging;
- steady maintenance with alternating high/low water-weight noise;
- steady loss and steady gain;
- linear interpolation across missing days;
- a long gap between weigh-ins;
- no extrapolation before/after observed data;
- metric/imperial equivalence after boundary conversion;
- timezone-normalized day keys across DST and mixed stored timezones;
- invalid alpha values;
- no input mutation;
- golden fixtures for cut, maintain, and bulk behavior;
- boundary stability with a 28-day warm-up window.

### Integration tests

- Extend `historicalNutritionParams.test.ts` to assert trend endpoints, sparse weigh-ins, pounds-to-kg
  conversion, fasting-day behavior, and warm-up reads.
- Add focused `ProgressService` tests around raw/trend separation, visible-range slicing, display-unit
  conversion, and the fact that FFMI still uses observed weight.
- Add `NutritionCheckinService` tests for trend-based status, target delta, sparse raw bars, and
  insufficient-data behavior.
- Test the Weight chart view model/tooltips with and without a same-day scale weight.
- Update any `useEmpiricalTDEE` and dynamic-target mocks affected by the clarified endpoint semantics.

### Required verification

Run:

```bash
npx jest --selectProjects node utils/__tests__/trendWeight.test.ts
npx jest --selectProjects node utils/__tests__/historicalNutritionParams.test.ts
npx jest --selectProjects node utils/__tests__/progress.test.ts
npm run typecheck
npm run lint:eslint
npm run check-translations
```

Also verify the chart on native and web in metric and imperial modes with one, two, sparse, and dense
weigh-in histories.

## Implementation sequence

### Phase 1 — calculation foundation

1. Add the pure trend utility and exhaustive tests.
2. Add deterministic dev-seed fixtures with realistic daily noise if the current body-metric seed is
   too sparse to review visually.
3. Refactor ProgressService to produce raw kilogram weights and derived trend weights before display
   conversion.

Exit criterion: the same underlying date has the same trend in overlapping date-range requests.

### Phase 2 — Progress UX

1. Add native/web `WeightTrendChart` components and tooltip view model.
2. Replace the current Weight `LineChart` in `BodyMetricsCharts`.
3. Show latest trend, seven-day change, raw points, legend, explanation, and early state.
4. Pass trend weight into combined nutrition charts.
5. Add and validate translations.

Exit criterion: users can distinguish a scale reading from their trend and inspect both.

### Phase 3 — coaching and calculation integration

1. Feed trend endpoints into both empirical-TDEE paths:
   `historicalNutritionParams`/`useEmpiricalTDEE` and `ProgressService.calculateInsights`.
2. Replace the check-in's seven-day average masquerading as trend with actual trend weight.
3. Update dynamic nutrition target tests and check-in status tests.
4. Update `docs/PROGRESS_SCREEN.md`, `FEATURES.md`, the README feature summary if appropriate, and
   `docs/FUTURE_FEATURES.md` to reflect shipped behavior.

Exit criterion: every user-facing or coaching path labeled “trend” uses the same canonical utility.

### Phase 4 — validation and follow-up

1. Compare old and new empirical TDEE outputs on seeded noisy, sparse, and steady datasets.
2. Confirm no extreme target changes occur from a single outlier weigh-in.
3. Profile 10 years of daily data and chart rendering.
4. Record follow-ups for whole-series regression and the expenditure confidence-band screen; do not
   fold them into this feature.

## Risks and mitigations

| Risk                                                      | Mitigation                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Trend changes when the visible date range changes         | Always calculate with a 28-day warm-up window, then slice.                                           |
| A new user's first weight looks overly authoritative      | Show an early-state message and withhold seven-day change.                                           |
| Sparse data implies a smooth path that was never measured | Render interpolated values only as the trend line; raw observations remain discrete points.          |
| Trend lag frustrates fast gain/loss users                 | Explain that lag is intentional; calibrate the named alpha against fixtures before release.          |
| TDEE behavior changes unexpectedly                        | Golden tests and side-by-side seeded comparisons before switching anchors.                           |
| Pounds are accidentally smoothed as stored legacy values  | Normalize every input to kg before calculating; convert only at response/UI boundaries.              |
| Body composition is calculated from invented weights      | FFMI and measurement views continue to use raw observed points.                                      |
| Chart performance degrades on “all” history               | Profile long histories; downsample only the rendered series if needed, never the calculation series. |

## File map

New files:

- `utils/trendWeight.ts`
- `utils/__tests__/trendWeight.test.ts`
- `components/progress/WeightTrendChart.tsx`
- a pure chart view-model helper/test if tooltip logic warrants it

Primary modifications:

- `database/services/ProgressService.ts`
- `utils/historicalNutritionParams.ts`
- `utils/__tests__/historicalNutritionParams.test.ts`
- `utils/progress.ts`
- `utils/__tests__/progress.test.ts`
- `database/services/NutritionCheckinService.ts`
- `components/modals/CheckinDetailsModal.tsx`
- `components/progress/BodyMetricsCharts.tsx`
- `components/progress/NutritionCharts.tsx`
- `hooks/useEmpiricalTDEE.ts`
- `utils/dynamicNutritionTarget.ts` and affected tests/mocks
- `lang/locales/*/progress.json`
- `lang/locales/*/nutrition.json`
- `database/seeders/dev.ts`
- `docs/PROGRESS_SCREEN.md`
- `docs/FUTURE_FEATURES.md`
- `FEATURES.md`

## Recommended defaults open to UX feedback

These choices are safe to begin implementing without blocking, but are the most useful points for
product feedback:

1. **Trend is primary; scale weight is secondary.** Raw entries stay fully available in history.
2. **Raw chart data uses dots only**, not a pale connecting line.
3. **Seven-day change** appears beside current trend; no projected goal date is added in this scope.
4. **No home tile in v1.** Progress and check-ins are the initial surfaces.
5. **No smoothing slider.** One calibrated algorithm avoids making a health metric feel arbitrary.
