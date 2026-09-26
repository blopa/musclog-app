# Pick the meal's time (not just the day) when logging an AI meal

## Goal

When logging a meal from the AI photo scan or the coach, let the user set **both date and time**
before saving. This matters for back-filling ("I had this at 8am") and keeps the diary order and
meal-timing data accurate.

## What already exists

- `nutrition_logs.date` stores the consumed **datetime** (see `AGENTS.md`). Helpers live in
  [utils/calendarDate.ts](../utils/calendarDate.ts): `combineLocalDateAndTime`,
  `consumedDateTimeOnDay(dayDate, timeDate = new Date())`, and `withCurrentTimeOnDay`.
- The regular food-tracking flow already has a time picker:
  [components/modals/FoodMealTrackingDetailsModal.tsx](../components/modals/FoodMealTrackingDetailsModal.tsx)
  renders `TimePickerInput` + `TimePickerModal`, and
  `FoodMealTrackingActionService` combines `selectedDate` + `selectedTime`.
- The AI paths only take a **day**:
  - [components/modals/LogMealModal.tsx](../components/modals/LogMealModal.tsx) has a
    `DatePickerInput`/`DatePickerModal` and calls `onLogMeal(date, mealType, portionGrams)`. It's
    used by `SmartCameraModal` (AI photo) and `CoachModal` (coach-tracked meals).
  - `NutritionService.logCustomMeal(meal, date, mealType, amount, options)` calls
    `consumedDateTimeOnDay(date)`, which replaces any time-of-day with **now**.
  - `processParsedNutritionEntries` in [utils/nutritionAI.ts](../utils/nutritionAI.ts) does the
    same via `withCurrentTimeOnDay`.
  - [components/modals/MealEstimationModal.tsx](../components/modals/MealEstimationModal.tsx) is
    only mounted in `app/app/test/modals.tsx`.

## Design

1. **Service**: add `consumedTime?: Date` to the `options` of `NutritionService.logCustomMeal`
   and `logCustomMealsBatch`. Pass it as the second argument of
   `consumedDateTimeOnDay(date, options?.consumedTime)`. Leaving it out keeps today's behavior
   ("that day, current time"), so no other caller changes.
2. **LogMealModal**:
   - Add `selectedTime` state, initialized to now. Render `TimePickerInput` under the date input,
     with `TimePickerModal` **inside the modal's children**, as `DatePickerModal` already is (the
     host stays visible, so the picker must be its child; see `FIXES.md` → iOS modal presentation
     hierarchy).
   - Change the callback to
     `onLogMeal({ date, time, mealType, portionGrams })`. An object avoids a fifth positional
     argument and makes both call sites update explicitly.
   - When the user picks a new **date**, keep the chosen time.
   - Optional: when the meal type changes and the user hasn't touched the time, suggest a default
     time for that meal type (breakfast 08:00 …). Ship without it; it's easy to add later.
3. **Callers**:
   - `SmartCameraModal.handleLogMeal` → pass `consumedTime: time` to `logCustomMeal`.
   - `CoachModal`'s LogMealModal handler → the same.
   - `processParsedNutritionEntries` → accept an optional `consumedTime` and use
     `combineLocalDateAndTime` instead of `withCurrentTimeOnDay` when it's given.
4. **Future times**: don't block them (a user may pre-log dinner), but reuse whatever warning, if
   any, `FoodMealTrackingDetailsModal` shows so the two flows behave the same.
5. **MealEstimationModal** (test only): either give it the same time picker or delete it if it's
   dead code. Check `app/app/test/modals.tsx` first.

## Tests

- `database/services/__tests__/NutritionService…`: `logCustomMeal` with `consumedTime` stores that
  wall-clock time on the chosen day, with the timezone captured at that instant (DST edge: a day
  where the offset changes). Without `consumedTime` the behavior is unchanged.
- `components/modals/__tests__/LogMealModal.test.tsx`: changing the date keeps the time;
  `onLogMeal` receives both.
- `utils/__tests__/nutritionAI…`: the `consumedTime` path.

## Docs and translations

- Reuse existing time-picker label keys if there are any (check `food.*` keys used by
  `FoodMealTrackingDetailsModal`); otherwise add them to all locales.
- `CURRENT_FEATURES.md` → Nutrition: "set date and time when logging an AI-estimated meal".
- `FUTURE_FEATURES.md`: this delivers the "time" part of "Editable AI nutrition results before
  save"; trim that bullet.
