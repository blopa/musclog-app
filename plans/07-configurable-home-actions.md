# Configurable Home quick actions

## Goal

Let the user choose which quick-action buttons appear on Home (for example: Scan barcode, AI photo,
Log weight, Add note, Log walk/run) instead of the two fixed buttons.

## What already exists

- [app/app/index.tsx](../app/app/index.tsx) (around line 469) renders two hardcoded
  `ActionButton`s: `variant="workout"` → `/app/workout/workouts`, and `variant="food"` → opens
  `AddFoodModal`.
- [components/ActionButton.tsx](../components/ActionButton.tsx) only knows
  `'workout' | 'food'` variants, with per-variant colors/icons in a local `variantConfig`.
- The navigation-slot system is the model to copy (`AGENTS.md` → "Navigation destinations are
  table-driven"): `NAV_ITEM_KEYS` in `constants/settings.ts` with a derived type, `Record<…>`
  registries, `NavItemKeyList`, availability in one function (`isNavItemAvailable`), and a picker
  in `VisualSettingsModal`.
- `HOME_SUMMARY_CARD_SETTING_TYPE` shows how a Home layout choice is stored
  (`SettingsService` getter/setter + `useSettings`).
- Actions that already have an entry point on Home: `openCamera({ mode: 'barcode-scan' })` and
  `'ai-meal-photo'` via `useSmartCamera`, the food search modal, My Meals, the notes screen, and the
  weight entry in `DailySummaryBottomMenu`.

## Design

1. **Registry** (`constants/homeActions.ts` for keys, `components/home/homeActions.ts` for
   presentation):
   - `HOME_ACTION_KEYS` lists `start_workout`, `track_food`, `scan_barcode`, `ai_photo`,
     `log_weight`, `my_meals`, `add_note` and `log_cardio` (`as const`), with `HomeActionKey`
     derived from it.
   - `HOME_ACTIONS: Record<HomeActionKey, { labelKey, icon, tone }>`, so the compiler forces every
     key to have its config.
   - `isHomeActionAvailable(key, { isAiConfigured, platform })`: `ai_photo` needs
     `isAiConfigured` (the AI-affordance rule in `AGENTS.md`), camera actions are hidden on
     web if the camera isn't supported there, and `log_cardio` is hidden until plan 08 ships.
2. **Behavior**: `index.tsx` keeps a `Record<HomeActionKey, () => void>` of handlers, because the
   handlers need Home's state setters and router. The typing forces a handler for every action.
3. **ActionButton**: generalize `variant` into `tone` (`'workout' | 'food' | 'neutral' | 'accent'`)
   plus an `icon` prop, keeping the existing two tones pixel-identical.
4. **Setting**: `HOME_ACTIONS_SETTING_TYPE` stores an ordered JSON array. A pure
   `parseHomeActions(raw)` drops unknown keys (the stored list may come from a newer build via
   backup/optical restore), removes duplicates, clamps to 1–4 items, and falls back to
   `['start_workout', 'track_food']` so nothing changes for existing users.
5. **Layout**: a 2-column grid; one row for 2 actions, two rows for 3–4. Unavailable actions are
   skipped at render time but kept in the stored setting, so turning AI on brings the button back.
6. **Picker**: in `VisualSettingsModal`, a "Home quick actions" row opening a sheet with ordered
   checkboxes (max 4) and drag-to-reorder. Reuse the existing reorder component if one exists
   (exercise reordering uses drag and drop).

## Tests

- `constants/__tests__/homeActions.test.ts`: registry covers every key; `parseHomeActions` handles
  unknown keys, duplicates, empty, too many, and non-JSON input.
- `isHomeActionAvailable`: AI gating, cardio gating.
- A Home render test for the default configuration, to confirm the two current buttons are
  unchanged.

## Docs and translations

- Labels for each new action + the settings picker in all locales.
- `AGENTS.md`: a short paragraph next to the nav-destination rule ("Home actions are table-driven:
  add a key, the compiler asks for the rest").
- `CURRENT_FEATURES.md` → Dashboard & Home Screen and Profile & Settings.
