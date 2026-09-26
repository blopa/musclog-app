# Daily steps and energy balance on Home

## Goal

Show today's step count and a plain "burned vs. eaten" line on the Home screen, so a user sees how
the day is going without opening Progress.

## What already exists

- Step data is already synced. `syncDailySteps` in
  [services/healthConnectFitness.ts](../services/healthConnectFitness.ts) (Android) and its
  counterpart in [services/healthConnectFitness.ios.ts](../services/healthConnectFitness.ios.ts)
  add up step records per local calendar day. They store the totals as `user_metrics` rows of type
  `daily_steps` (`MetricType.STEPS` in
  [services/healthDataTransform.ts](../services/healthDataTransform.ts)).
- `active_calories_burned` and `total_calories_burned` are also `UserMetricType` values.
- The sync runs from [components/AppBoot.tsx](../components/AppBoot.tsx) via
  `healthDataSyncService`.
- Home ([app/app/index.tsx](../app/app/index.tsx)) already has `currentTdee` from
  `useEmpiricalTDEE`. Today's intake comes from `useDailyNutritionSummary` inside
  [components/home/DailyHomeSummary.tsx](../components/home/DailyHomeSummary.tsx).
- Metric values are encrypted, so reads must go through `UserMetricService` (which decrypts), never
  raw queries.

Nothing on Home reads `daily_steps` today.

## Design

### Data

1. Add a hook `hooks/useDailySteps.ts` that returns
   `{ steps: number | null, isLoading, source: 'health' | null }` for a given local day:
   - Read with `UserMetricService.getLatestOnOrBefore('daily_steps', …)` or a new
     `UserMetricService.getForDay(type, dayStartMs)` that uses `localDayHalfOpenRange` from
     `utils/calendarDate.ts`. Only an exact match for that day counts; don't carry yesterday's
     total forward.
   - Observe `user_metrics` for type `daily_steps` so the value updates when the background sync
     writes it.
   - Return `null` (not `0`) when there is no row, so "no data / not connected" is not shown as
     "0 steps".
2. Add a pure helper `utils/energyBalance.ts`:
   `computeEnergyBalance({ tdee, consumedKcal, activeKcal? })` →
   `{ burned, eaten, balance, direction: 'deficit' | 'surplus' | 'even' }`.
   - v1: `burned = tdee`. `utils/historicalNutritionParams.ts` already makes that figure empirical.
   - Don't add `active_calories_burned` on top of the TDEE; the empirical TDEE already includes
     typical activity, so adding it would double-count. If per-day active calories become useful
     later, they should _replace_ the activity part of the estimate, not add to it. Record that
     decision in `RESEARCH.md`.
   - Use neutral wording ("under / over"), in line with the `FUTURE_FEATURES.md` guidance against
     punitive messaging.

### UI

3. Add a compact row under the summary card (in `DailyHomeSummary` and `WeeklyHomeSummary`, or
   directly below them in `index.tsx`) with:
   - A steps chip (footprints icon + number formatted with `useFormatAppNumber`). Hidden when
     `steps === null`.
   - An energy line: "Burned ~2,450 · Eaten 1,820 · 630 kcal under". Hidden in **intuitive eating
     mode** (it's calorie numbers) and when there is no nutrition goal.
4. Tapping the steps chip opens the existing metric history for `daily_steps` (the
   `useUserMetricDataLogs` screens already have icons for calorie types; add one for steps if it's
   missing).
5. Web has no health source, so the steps chip never renders there. The energy line still works.

### Settings

6. Add `SHOW_HOME_STEPS_SETTING_TYPE` (default **on**) to `constants/settings.ts` and
   `SettingsService`, with a toggle in Visual settings next to the home summary card choice. The
   energy line follows the existing intuitive-eating toggle; it doesn't need its own.

### Freshness

7. The step total only changes when the sync runs. Also trigger a lightweight _steps-only_ sync
   when the app returns to the foreground (`AppState` change) if the last steps sync is older than
   ~15 minutes. Reuse `syncDailySteps` for today's range only; don't run the full fitness sync.

## Tests

- `utils/__tests__/energyBalance.test.ts`: deficit, surplus, even, zero TDEE.
- `hooks/__tests__/useDailySteps.test.ts` (jsdom project): returns `null` without a row, the exact
  day's value with one, and ignores yesterday's row.
- Update `services/__tests__/healthDataTransform.test.ts` only if the metric shape changes.

## Docs and translations

- New keys (steps label, energy line, direction words) in all five `lang/locales/*`; run
  `npm run check-translations` and `npm run check-locale-consistency`.
- `CURRENT_FEATURES.md` → Dashboard & Home Screen.

## Open questions

- Should a step **goal** be added now? The `steps_per_day` exercise goal type is reserved (see
  "Exercise goals v2" in `FUTURE_FEATURES.md`). If so, the chip could show `8,200 / 10,000`.
  Suggest shipping the chip first and then wiring it to the goal.
