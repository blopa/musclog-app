# Quick "Log walk / run"

## Goal

Log a walk or run in a few taps (activity, distance, duration, time), instead of starting a strength
session. Estimate calories from it, show it in history and Progress, and write it to Health
Connect / HealthKit.

## What already exists

- `workout_logs` has `started_at`, `completed_at`, `calories_burned`, `type`, `workout_name`,
  `timezone` and `external_id`, but **no distance column**
  ([database/schema.ts](../database/schema.ts)).
- `workout_log_sets` is built for strength work (`reps`, `weight`, `rest_time_after`, RIR); it has no
  distance or duration.
- The bundled catalogue has cardio entries: `fx-Running_Treadmill`, `fx-Jogging_Treadmill` and
  `fx-Trail_Running_Walking` (no plain outdoor "walking" entry).
- `exercise_goals` already reserves `distance_per_session`, `pace` and `duration`, with
  `target_distance_m`, `target_duration_s` and `target_pace_ms_per_m` columns; the UI disables them
  ("Exercise goals v2" in `FUTURE_FEATURES.md`).
- Health writes: [services/healthConnectWorkout.ts](../services/healthConnectWorkout.ts) maps the
  app's workout type to an `ExerciseType` (cardio → HIIT today), and
  [services/healthConnectWorkout.ios.ts](../services/healthConnectWorkout.ios.ts) saves HKWorkouts.
  Neither sends distance.
- [utils/workoutEnergyCalculator.ts](../utils/workoutEnergyCalculator.ts) is rep/mechanical-work
  based and doesn't fit steady-state cardio.
- `utils/unitConversion.ts` has no distance (km ↔ mi) helpers.
- The workouts screen ([app/app/workout/workouts.tsx](../app/app/workout/workouts.tsx)) has a
  screen menu (`isScreenMenuVisible` → `BottomPopUpMenu`) where the entry point can go.

## Design

### Schema (additive migration)

1. Add optional `distance_m` (number) and `activity` (string: `'walk' | 'run'`) to `workout_logs`.
   Add `addColumns` only, so `pendingMigrationsCanTouchExistingData` stays false and no pre-migration
   snapshot is taken. Bump the schema version, and update `exportDbCore` / `importDb` and the
   import Zod schema (and the share allowlist test if `workout_logs` is ever shareable).

### Units

2. `utils/unitConversion.ts`: `kmToDisplay`, `displayToMeters`, `getDistanceUnit(units)` (`km` /
   `mi`), plus pace formatting (`min/km` or `min/mi`). The DB always stores meters and seconds.

### Energy

3. `utils/cardioEnergy.ts`: ACSM metabolic equations.
   - Walking: `VO2 = 0.1·speed + 3.5` (ml/kg/min, speed in m/min).
   - Running: `VO2 = 0.2·speed + 3.5`.
   - `kcal ≈ VO2 · bodyMassKg · minutes / 1000 · 5`.
   - Take body mass from `UserMetricService.getUserBodyWeightKgForVolume()`. Use flat-ground
     equations only; there's no incline in v1. Report **net** vs **gross** consistently with how
     other workout calories feed the day, and record the choice and source in `RESEARCH.md`.
   - If the user enters a calorie number from their watch, it overrides the estimate.

### Service

4. `WorkoutService.logCardioSession({ activity, distanceM, durationS, endedAt, caloriesOverride? })`:
   - One `database.write` that creates a completed `workout_logs` row (`type: 'cardio'`,
     `activity`, `distance_m`, `started_at = endedAt − duration`, `completed_at`, `timezone`,
     `calories_burned`, `workout_name` = localized "Walk"/"Run").
   - One `workout_log_exercises` row pointing at `fx-Trail_Running_Walking` (or the treadmill
     entries if the user picks "treadmill").
   - **No sets.** Check that history, the summary, `WorkoutAnalytics`, the weekly progress count
     (`completed_at`-based, so it should count) and the PR logic all handle a zero-set exercise.
     If any of them can't, fix the reader rather than inventing a fake performed set, because
     sets must never be fabricated (see the set-lifecycle rule in `AGENTS.md`).
   - Then trigger the existing health write.

### Health write

5. Map `activity` to `ExerciseType.WALKING` / `RUNNING` (Health Connect) and
   `WorkoutActivityType.walking` / `running` (HealthKit), and include total distance and energy.
   Keep the current mapping for other cardio.

### UI

6. `LogCardioModal` (bottom sheet, `KeyboardAwareScrollView` rules apply): Walk/Run segmented
   control, distance (unit-aware), duration (h:mm:ss), end date + time (reuse the date/time pickers
   from plan 04), a live pace and estimated kcal preview, and an optional "calories from my watch"
   field.
7. Entry points: the workouts screen menu ("Log walk/run"), and the `log_cardio` Home action from
   plan 07.
8. History card for a cardio log shows distance, duration and pace instead of volume.

### Follow-up (separate PR)

9. With distance and duration stored, enable the reserved `distance_per_session`, `duration` and
   `pace` exercise goals: service logic, progress calculation, units, localization. Keep the
   one-active-consistency-goal invariant.

## Tests

- `utils/__tests__/cardioEnergy.test.ts`: known ACSM reference values for walk and run at a fixed
  body mass; override wins.
- `utils/__tests__/unitConversion…`: meters ↔ km/mi, pace formatting.
- `database/services/__tests__/WorkoutService…`: `logCardioSession` writes one log + one exercise
  and no sets in a single write; stamps timezone; counted by the rolling weekly workout count;
  excluded from volume and PRs.
- Migration test for the new columns; export/import round-trip keeps `distance_m`.
- Health mapping tests for walk/run.

## Docs and translations

- Modal strings, activity names, units, pace label in all locales.
- `CURRENT_FEATURES.md` → Workout Tracking. `FUTURE_FEATURES.md` → Exercise goals v2 (mark distance
  as now stored). `AGENTS.md`: a line saying cardio sessions store distance on `workout_logs` and
  have no sets by design.
