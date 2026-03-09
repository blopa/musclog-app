# TODO Implementation Plan

High-level plan for the TODOs added across the codebase, grouped by area with effort estimates.  
Effort: **S** = small (≈0.5–1 day), **M** = medium (≈1–3 days), **L** = large (≈3–5+ days).  
**Status:** Done = implemented; — = not started.

**Recent completions (ViewExerciseModal):** All TODOs in `ViewExerciseModal.tsx` and related wiring are done: real exercise data via `exerciseId`/`exercise` props and `ExerciseService.getExerciseById`, `imageUrl` with fallback, personal best and avg frequency from `WorkoutAnalytics`, templates using this exercise from DB, watch technique (YouTube search), navigate to workout template preview via `/workout/workouts?previewTemplateId=...`, edit via `GenericEditModal`, share via `Share.share`, duplicate/delete with confirmation and dependency warning. `ExercisesModal` opens `ViewExerciseModal` on exercise press; workouts screen reads `previewTemplateId` from URL and opens template preview.

---

## 1. Exercise & workout UI
# DONE

---

## 2. Workout flow & coach

| TODO                                                            | Location              | Plan                                                                                                                                                                                                                                        | Effort | Status |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| Implement workout start from coach modal                        | `CoachModal.tsx`      | On “Start workout”, resolve workout id from `currentMessage.workout`, then navigate to workout session (e.g. create session from template and go to `/workout/session` or equivalent). Reuse same entry point as “Start workout” elsewhere. | M      | —      |
| Check against current active workout state (workout log delete) | `DataLogModal.tsx`    | Before delete, get “current active workout” (e.g. from context or DB flag). If log is that workout, show stronger warning or block; else show generic warning.                                                                              | S      | —      |
| Check against current active goal state (nutrition goal delete) | `DataLogModal.tsx`    | Before delete, get active nutrition goal (e.g. `useCurrentNutritionGoal` or `NutritionGoalService.getActive()`). If goal is the active one, show specific warning or block.                                                                 | S      | —      |
| Implement AI workout generation                                 | `DataLogModal.tsx`    | Integrate with your AI/backend: collect user preferences (duration, focus, equipment), call generation API, create workout template in DB, then navigate to edit or start.                                                                  | L      | —      |
| Implement template browsing functionality                       | `DataLogModal.tsx`    | Add a “Templates” screen/modal that lists workout templates (from DB or bundled). On select, create a copy or start workout from template; link from “Browse templates” button.                                                             | M      | —      |

---

## 3. Meal estimation & nutrition modals

| TODO                                           | Location                  | Plan                                                                                                                                                                                                              | Effort | Status |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| Implement camera retake functionality          | `MealEstimationModal.tsx` | Add optional callback prop e.g. `onRetake`. When “Retake” is pressed, call `onRetake()` and close modal; parent (camera screen) should reopen camera. If no parent support yet, document and call `onClose` only. | S      |        |
| Implement food search modal functionality      | `MealEstimationModal.tsx` | On “Add item”, open existing `FoodSearchModal` (or equivalent). On select, add food to estimation list with default quantity; merge into `estimationData` and update state.                                       | M      |        |
| Implement edit item modal for meal estimation  | `MealEstimationModal.tsx` | On edit, open a small modal/sheet with fields for name, quantity, unit; on save, update the item in local state (and optionally sync to AI estimation).                                                           | S      |        |
| Use ConfirmationModal + i18n for delete item   | `MealEstimationModal.tsx` | Replace `Alert.alert` with `ConfirmationModal`: add `deleteConfirmVisible` and `itemToDelete` state; use `t('meals.deleteItemConfirm')` (or similar) for title/message; on confirm, remove item from list.        | S      |        |
| Implement meal logging functionality           | `MealEstimationModal.tsx` | On confirm: map estimated items to nutrition log entries (food id or custom, portions, date/meal type). Call `NutritionService`/log API to create entries; show success snackbar and close.                       | M      |        |
| Implement generate meal with AI logic          | `MyMealsModal.tsx`        | Reuse or mirror Smart Camera / meal estimation flow: open camera or image picker, run AI meal recognition, then open meal estimation modal or save meal template for “My Meals”.                                  | L      |        |
| Implement manage categories logic              | `MyMealsModal.tsx`        | Add a “Categories” screen/modal: list meal categories (from DB or config), allow add/rename/delete/reorder. Persist via `MealService` or a small Category table; filter “My Meals” by category.                   | M      |        |

---

## 4. Home screen & notifications

| TODO                                                        | Location                 | Plan                                                                                                                                                                                            | Effort | Status |
| ----------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| Implement clear all notifications                           | `app/index.tsx`          | When you have a notifications store/API: add “Clear all” action that marks all as read or deletes. Wire `onClearAll` to that and refresh list. Until then, optional: clear local UI state only. | S      |        |
| Implement start workout action when notification has action | `NotificationsModal.tsx` | When a notification has `hasAction` (e.g. “Start workout”), resolve workout id from payload; on press, navigate to workout session (same as coach “Start workout”).                             | S      |        |

---

## 5. Services & data

| TODO                                                            | Location              | Plan                                                                                                                                                                                        | Effort | Status |
| --------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| Implement exercise usage tracking and frequency                 | `ExerciseService.ts`  | Add an “exercise_usage” or “workout_set_exercise” aggregation: count sets per exercise from workout logs. `getFrequentlyUsedExercises` should query by count and return top N.              | M      |        |
| Implement more sophisticated meal suggestions                   | `MealService.ts`      | Use recent nutrition logs, favorites, and time of day to score meals; return top N. Optionally add simple collaborative-style “often logged with” or tags.                                  | M      |        |
| Consider counter table for getMostEatenFoods                    | `NutritionService.ts` | Add a `food_log_count` table (or column) updated on log insert/delete, or a materialized view. `getMostEatenFoods` reads from it instead of full scan.                                      | M      |        |

---

## 6. Web platform (file utilities)

| TODO                                          | Location            | Plan                                                                                                                                                                                     | Effort |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Implement actual image saving logic for web   | `utils/file.web.ts` | Save to your backend or blob storage: upload `tempUri` (blob/file), get back persistent URL; return that URL. If web is read-only for now, keep returning `tempUri` and document.        | M      |
| Implement actual image deletion logic for web | `utils/file.web.ts` | If images are stored on your server, call delete API with `imageUri` (or id). No-op if web doesn’t persist images yet.                                                                   | S      |
| Implement actual image cropping logic for web | `utils/file.web.ts` | Use a web crop library (e.g. react-image-crop) or Canvas to crop; return blob/data URL or re-upload and return new URL. Match `openCropperAsync` contract (e.g. `{ path: croppedUrl }`). | M      |

---

## 7. Platform-specific (iOS)

| TODO                                           | Location                    | Plan                                                                                                                                                                                                                 | Effort |
| ---------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Implement clear app data functionality for iOS | `AdvancedSettingsModal.tsx` | On iOS, open app Settings (e.g. `Linking.openSettings()`) or in-app “Clear data” that wipes local DB/cache (same as Android flow but via your own clear function, since iOS has no direct “app data” system intent). | M      |

---

## 8. Theme & settings

| TODO                                                 | Location                 | Plan                                                                                                                                                                                        | Effort |
| ---------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Implement option to pick dark and light theme        | `theme.ts`               | Define a real `lightTheme` (and keep `darkTheme`) with distinct colors; expose a theme id in settings/context and apply it at app root so all `useTheme()` consumers get the right palette. | M      |
| Remove HAS_THEMES flag and enable theme picker       | `BasicSettingsModal.tsx` | Set `HAS_THEMES = true` once theme switching works; show the theme SegmentedControl and wire it to the same theme context/store used in `theme.ts`.                                         | S      |
| Actually implement light theme OR remove/hide option | `BasicSettingsModal.tsx` | Either implement light theme (see above) or hide/remove the theme control and keep system/default only until themes are ready.                                                              | S      |

---

## 9. Workout settings & navigation

| TODO                                         | Location                                                 | Plan                                                                                                                                                                                                              | Effort |
| -------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Uncomment workout settings once route exists | `workout-session.tsx`, `rest-over.tsx`, `rest-timer.tsx` | Add a `/workout-settings` (or equivalent) screen: rest duration, default units, sound/haptics, etc. Then uncomment `onWorkoutSettings={() => router.push('/workout-settings')}` in all three files.               | M      |

---

## 10. Import & retrospective modals (UI + usage)

| TODO                                                                          | Location                          | Plan                                                                                                                                                                                                                                              | Effort |
| ----------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Improve UI, remove mocked data, implement usage – RetrospectiveNutritionModal | `RetrospectiveNutritionModal.tsx` | Polish layout/UX per design; replace any mock entries with real data from `parseRetrospectiveNutrition` and NutritionService. Wire modal into coach or nutrition flow (e.g. “Log past day” entry point) and call `onNutritionEntered` to persist. | M      |
| Improve UI, remove mocked data, implement usage – ImportWorkoutsModal         | `ImportWorkoutsModal.tsx`         | Same idea: refine UI, use real parsed workouts from `processParsedWorkouts` and ExerciseService/WorkoutService; add entry point (e.g. Data Log or workouts screen) so users can open it and get `onWorkoutsImported` with real IDs.               | M      |
| Improve UI, remove mocked data, implement usage – ImportNutritionModal        | `ImportNutritionModal.tsx`        | Polish UI; use real parsed entries and NutritionService to save. Expose from coach or nutrition section so users can paste text and get logs created via `onNutritionImported`.                                                                   | M      |
| Improve UI, remove mocked data, implement usage – NutritionConfirmationModal  | `NutritionConfirmationModal.tsx`  | No mock data in props—caller passes real `entries`. Improve list/totals UI if needed; ensure it’s used after RetrospectiveNutritionModal or ImportNutritionModal as the confirmation step before saving.                                          | S      |

---

## 11. Generic edit modal & meal estimation screens

| TODO                                                     | Location                   | Plan                                                                                                                                                                                                                                              | Effort |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Improve Meals modal: add/remove foods                    | `GenericEditModal.tsx`     | For Meal entity edit: allow adding/removing foods (e.g. open FoodSearchModal to add, row actions to remove). Persist meal–food relations via MealService/ingredients; may require a dedicated “Edit meal ingredients” flow or inline list editor. | M      |
| Improve edit workout template modal                      | `GenericEditModal.tsx`     | For workout template edit: reuse or link to the same UI you use for building workouts (exercises, sets, order). Load template into that flow, save back via WorkoutService; avoid duplicating logic if a dedicated workout editor already exists. | M      |
| Remove mocks, check designs and use MealEstimationModal  | `MealEstimationModal.tsx`  | Ensure modal receives real AI estimation or user data (no hardcoded defaults for demos); align layout with designs. Then use it from SmartCameraModal or camera flow as the main meal-estimation step.                                            | S      |
| Remove mocks, check designs and use MealEstimationScreen | `MealEstimationScreen.tsx` | If this is a full-screen variant of the estimation flow: replace mock props with real data from parent/camera; align with designs. Either use it as the post-camera screen or deprecate in favor of MealEstimationModal.                          | S      |

---

## 12. UI polish & notification card

| TODO                                                  | Location                        | Plan                                                                                                                                                                                                             | Effort |
| ----------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Implement different styles based on notification type | `NotificationCard.tsx`          | Use `type` ('ai-insight' \| 'workout-reminder' \| 'workout-completed' \| 'kudos' \| 'weekly-report') to vary icon, background, border, or layout (e.g. workout cards show “Start” CTA, kudos show trophy style). | S      |
| Fix UI issue in WorkoutSummaryCelebration             | `WorkoutSummaryCelebration.tsx` | Identify and fix the specific issue (layout overflow, alignment, contrast, or animation). Document or add a comment with the fix so the TODO can be removed.                                                     | S      |

---

## 13. Data & external sources

| TODO                                                | Location                  | Plan                                                                                                                                                                                                                                               | Effort |
| --------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Import data from EuroFIR food composition databases | `database/models/Food.ts` | EuroFIR provides standardized food composition data. Plan: choose a subset (e.g. one country or generic), map their schema to your `Food`/micros model, write a seed script to fetch/parse and insert; optional: periodic sync or one-time import. | L      |

---

## 14. Tests

| TODO                          | Location                                 | Plan                                                                                                                                                                                                                            | Effort |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Implement edit mode save test | `hooks/__tests__/useWorkoutForm.test.ts` | Add a test that puts the form in edit mode (e.g. with existing workout id and initial values), changes fields, and asserts that save is called with the expected payload (and optionally that the mutation updates the record). | S      |

---

## Summary by effort

Suggested order: do all **S** in each area first (quick wins and unblocking), then **M** (features and data), then **L** (AI generation, full meal AI flow, EuroFIR import). Within that, prioritize: **exercise UI + ViewExerciseModal wiring** → **meal logging (estimation + SmartCamera)** → **nutrition goals + custom food persistence** → **notifications + coach start workout** → **DataLog dependency checks and templates** → **workout settings route + uncomment** → **theme (light/dark)** → **import/retrospective modal usage** → **GenericEditModal meals + workout** → **web file utils** → **iOS clear data** → **AI workout generation and meal AI** → **EuroFIR food data**.
