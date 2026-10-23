# Musclog de-slop plan

This is the plan for removing the generic "AI-generated" look from the Musclog app without
breaking its brand, its workflows or its accessibility. It is split into independent phases.
Each phase is small enough to review in one sitting, ships on its own, and leaves the app in a
releasable state.

Companion file: [`design-baseline.json`](./design-baseline.json) holds the audit scores and the
finding list. Every finding there carries the `phase` that closes it. Update its `status` to
`fixed` in the same commit that closes the finding, and refresh the scores when a phase ships.

## Contents

- [Where we start](#where-we-start)
- [What we keep](#what-we-keep)
- [Ground rules for every phase](#ground-rules-for-every-phase)
- [Phase overview](#phase-overview)
- [Phase 0: Correctness fixes](#phase-0-correctness-fixes)
- [Phase 1: Buttons and shape](#phase-1-buttons-and-shape)
- [Phase 2: Gradients and the indigo leak](#phase-2-gradients-and-the-indigo-leak)
- [Phase 3: Rows, menus and settings](#phase-3-rows-menus-and-settings)
- [Phase 4: Labels and microtext](#phase-4-labels-and-microtext)
- [Phase 5: Home and the hero surfaces](#phase-5-home-and-the-hero-surfaces)
- [Phase 6: Empty states, illustrations and decorative motion](#phase-6-empty-states-illustrations-and-decorative-motion)
- [Phase 7: Copy](#phase-7-copy)
- [Phase 8: Screen headers and wayfinding](#phase-8-screen-headers-and-wayfinding)
- [Phase 9: Lists](#phase-9-lists)
- [Phase 10: Device verification, store assets and close-out](#phase-10-device-verification-store-assets-and-close-out)
- [Open decisions](#open-decisions)
- [Appendix A: Audit findings](#appendix-a-audit-findings)
- [Appendix B: Gradient inventory](#appendix-b-gradient-inventory)
- [Appendix C: How to re-run the audit](#appendix-c-how-to-re-run-the-audit)

## Where we start

Audit of 2026-10-19, app version 2.14.0, using the `mobile-design-review` and `deslop-ui`
skills. The live pass ran on the Expo web build at 390x844 (no emulator was available), on
Kinetic Depth plus partial passes on Light, Volt and Varia.

| Score         | Value  | Meaning                                                                          |
| ------------- | ------ | -------------------------------------------------------------------------------- |
| Design Score  | **B**  | Capped at B while a high-impact finding is open                                  |
| AI Slop Score | **A-** | Counts only the numbered tells in the mobile catalog; it understates the problem |

| Category            | Grade | Category             | Grade |
| ------------------- | ----- | -------------------- | ----- |
| Navigation & IA     | B     | States               | A-    |
| Screen anatomy      | C+    | Interaction & motion | A-    |
| Typography          | B     | Forms & input        | A     |
| Color & theming     | B     | Performance          | A-    |
| Surfaces & grouping | C+    | Copy & content       | C+    |

**Diagnosis.** The design system is not the problem; `DESIGN.md` already forbids most of what the
skills flag. The slop comes from a handful of shared components whose defaults the rules still
permit, and they are multiplied across the app:

- `BottomPopUpMenu`: 37 menus, 186 items, each with a tinted icon chip, a title, a description
  and a chevron.
- `SettingsCard`: 35 call sites, one card per setting.
- `Button`: 319 call sites. The default fill is a gradient, the md/lg sizes carry a colored glow
  shadow, every label is letter-spaced, and the radius is 20 to 24.
- 343 `uppercase` and 241 `tracking-*` class usages, mostly hand-written eyebrow labels.
- The Daily Summary hero gradient starts on `statusIndigo` in every theme
  (`theme.tokens.js:142-146`), so the most recognizable AI color signature sits at the top of
  Home and Food whichever palette the user picks.

Because the slop lives in shared components, most phases are component edits that change many
screens at once, not screen rewrites.

## What we keep

These are deliberate and must survive every phase:

- **The six named themes** (Kinetic Depth, Light, Shock, Volt, Blush, Varia), their accent hues,
  and the rule that a theme ships on the app, the website and the Game Boy together.
- **Navigation structure**: four destinations plus the fixed camera button, user-configurable
  slots, route names and deep links. No phase renames a route or a theme token.
- **The workout session** (`WorkoutTrainingView`, the set table, Guided view, `RestTimerBar`,
  "Why?" sheet). It is the strongest screen in the app; only Phase 0 touches it.
- **`StatStrip`**, the Weekly Review structure, the cycle calendar, and skeleton loading states.
- **Accessibility wins already in place**: AA text contrast on every surface, radio semantics on
  choices, labelled switches, `aria-checked` on web.
- **One-time milestone confetti** (deduplicated per activity; it earns its place).

## Ground rules for every phase

1. **One phase per pull request**, released on its own. A phase may be split into several commits
   (`style(design): FINDING-NNN ...`), but it merges as a unit.
2. **No navigation, route or token-name changes** unless the phase says so explicitly.
   `theme.registry.js` values may change; key names may not.
3. **Before/after screenshots** on web at 390x844 for every screen the phase touches, in Kinetic
   Depth and Kinetic Light at minimum, attached to the pull request. Phases that touch colors
   check all six themes.
4. **Guard tests.** Phase 1 adds `components/__tests__/deslopGuards.test.ts`, which reads source
   files the same way `themeControls.test.ts` does. Every later phase adds its rule there. Counts
   are ratchets: an allowlist or a maximum that can only go down, so a regression fails CI
   instead of waiting for the next audit.
5. **Docs in the same change**, per `AGENTS.md`: `DESIGN.md` for any rule a phase changes,
   `CURRENT_FEATURES.md` if a user-visible feature changes, `FIXES.md` for real bugs fixed.
6. **Verification before merge** (do not use `npm run lint:all`, which stages the tree and
   rewrites `app.json` and the iOS project):

   ```bash
   npx tsc --noEmit --skipLibCheck
   npx eslint <changed files>
   npx prettier --check <changed files>
   npx jest <test paths> --selectProjects node   # path first, or the flag swallows it
   npm run check-palette                          # phases that touch colors or tokens
   npm run check-translations && npm run check-locale-consistency   # phases that touch copy
   ```

7. **Translations**: any copy change lands in all five locales (`en-us`, `es-es`, `nl-nl`,
   `pt-br`, `ru-ru`). Non-English wording changes are flagged in the pull request for review.
8. **Baseline**: mark the closed findings `fixed` in `design-baseline.json` in the same change.

## Phase overview

| Phase | Title                                          | Closes                       | User-visible        | Risk   | Effort   | Depends on |
| ----- | ---------------------------------------------- | ---------------------------- | ------------------- | ------ | -------- | ---------- |
| 0     | Correctness fixes                              | 001, 008, 010, 011, 020, 023 | Yes (bug fixes)     | Low    | 0.5 day  | None       |
| 1     | Buttons and shape                              | 004, 005                     | Yes, app-wide       | Medium | 1 day    | None       |
| 2     | Gradients and the indigo leak                  | 002                          | Yes, app-wide       | Medium | 1 day    | 1          |
| 3     | Rows, menus and settings                       | 003, 013, 014                | Yes, app-wide       | Medium | 2 days   | 1          |
| 4     | Labels and microtext                           | 007                          | Yes, subtle         | Low    | 1.5 days | None       |
| 5     | Home and the hero surfaces                     | 009, 022                     | Yes, Home and Cycle | Medium | 1.5 days | 1, 2       |
| 6     | Empty states, illustrations, decorative motion | 006, 015, 019, 021           | Yes                 | Low    | 1 day    | 1          |
| 7     | Copy                                           | 017, 018                     | Yes, wording        | Low    | 1 day    | None       |
| 8     | Screen headers and wayfinding                  | 012                          | Yes                 | Medium | 1.5 days | 4          |
| 9     | Lists                                          | 016                          | No (performance)    | Medium | 1.5 days | None       |
| 10    | Device verification, store assets, close-out   | Unverified list              | Store listing       | Low    | 1 day    | All        |

Phases 0, 4, 7 and 9 have no dependencies and can ship in any order. The suggested order front
loads the changes with the biggest visual return per line changed: 0, 1, 2, 3, then the rest.

Each phase below follows the same template: **Goal**, **Why**, **Scope**, **Changes**,
**Out of scope**, **Acceptance criteria**, **Guards**, **Docs**, **Risk and rollback**, and a
**Release note** line for the changelog or What's New.

---

## Phase 0: Correctness fixes

**Goal.** Fix the real defects the audit found before any visual work, so the redesign phases
only change appearance.

**Why.** FINDING-001 is the only high-impact finding and the reason the Design Score is capped at
B. The others are layout bugs that read as carelessness, not style.

**Scope and changes.**

| Finding                    | Where                                                                                                                                      | Change                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 Raw i18n keys          | `lang/locales/*/workout.json` (`workout.exerciseTypes`), `utils/exerciseTranslation.ts:52-63`                                              | Add `plate_machine` and `cardio` labels in all five locales. Add a test that loads `data/exercisesData.json`, collects every distinct `equipmentType` and `mechanicType`, and asserts `i18n.exists(getExerciseTypeTranslationKey(value))` for each locale. `check-translations` cannot catch this because the key is built at runtime. |
| 010 Profile grid overflow  | `app/app/profile.tsx:420-433`                                                                                                              | Remove one of the two negative margins (`-mx-2` on the row and `marginHorizontal: -8` per item) so the grid aligns with the 16px gutter.                                                                                                                                                                                               |
| 011 Interface spacing      | `components/modals/VisualSettingsModal.tsx`                                                                                                | Give each section a top margin larger than the gap between its heading and its own control (proximity: 24 above, 8 below).                                                                                                                                                                                                             |
| 008 Truncated macro labels | Daily Summary hero macro row (`components/cards/DailySummaryCard/`)                                                                        | Let the label shrink before it truncates: drop the letter case trick, use the short label (`P`, `C`, `F`, `Fi`) consistently, or wrap value under label. Today Home shows `P C F Fi` while Food shows `P.. CA.. FATS FIB..` from the same component at the same width.                                                                 |
| 020 Workouts chip row      | `components/workout/WorkoutLibraryContent.tsx` filter chips                                                                                | Align the first chip to the 16px gutter and add the existing edge fade (`hidesContentToTheRight` pattern from the session chip row).                                                                                                                                                                                                   |
| 023 Chart axis overlap     | Progress charts (`components/progress/WeightTrendChart.tsx`, `BodyMetricsCharts.tsx`, `NutritionCharts.tsx` and their `.web.tsx` siblings) | Thin the tick labels by available width so adjacent dates never overlap (`10/12 10/13`).                                                                                                                                                                                                                                               |

**Out of scope.** Any color, radius, copy or component API change.

**Acceptance criteria.**

- Inline workout session shows "Plate Loaded Machine" (or the agreed label) for Leg Press.
- Profile stat cards line up with the cards below them at 390 and 430 widths.
- Food and Home hero cards show identical, untruncated macro labels at 390 width.

**Guards.** The exercise-type label test above, in `utils/__tests__/exerciseTranslation.test.ts`.

**Docs.** `FIXES.md` entry for the missing labels (why the static checker missed it).

**Risk and rollback.** Low; each fix is local. Revert per commit.

**Release note.** "Fixed missing equipment names in the workout session and several alignment
issues."

---

## Phase 1: Buttons and shape

**Goal.** Make `Button` and the app's corner radii read as one deliberate system instead of
component-library defaults with glow.

**Why.** FINDING-004 and 005. `Button` is used 319 times, so this phase changes the feel of the
whole app from five or six files. The glow shadow under the primary button, the gradient as the
default fill, the uniform letter-spacing and the 20 to 24 radius are each a recognized tell, and
together they are the house style of generated UI. `DESIGN.md` already says radii are 12 for
controls and 16 for cards; the code drifted.

**Scope.** `components/theme/Button.tsx`, `components/theme/Button.web.tsx`, `theme.ts`
(`shadows`, `borderRadius`), `components/ActionButton.tsx`, and the four selected-option sites
that reuse `shadows.accentGlow`:
`components/OptionsSelector.tsx:66`, `components/home/HomeActionsPicker.tsx:127`,
`components/modals/FilterWorkoutsModal.tsx:279`,
`components/theme/OptionsMultiSelector/OptionsMultiSelector.tsx:338`.

**Changes.**

1. **Remove the glow.** Size configs `md`, `lg` and `xl` use `shadows.none` (or `shadows.sm` for
   `accent` on light themes if contrast against the surface needs it). Delete the `roseGlow`
   default for `discard`/`rose`. Selected options in the four sites above signal selection with
   the 2px accent border and check icon they already have, not a halo.
   Keep `theme.shadows.accentGlow` and `accentGlowLarge` defined until the guard shows zero
   consumers, then remove them in the same phase.
2. **Flat accent fill by default.** `variant="accent"` (48 sites, and the default) becomes a solid
   `accent.primary` fill. `gradientCta` (79 sites) keeps the gradient and becomes what it was
   meant to be: the one primary action per screen. Audit the 79 `gradientCta` sites and demote
   to `accent` wherever a screen has more than one (e.g. empty states, sheets with a primary
   already in the footer).
3. **Labels.** Remove `className="tracking-wide"` (`Button.tsx:355`) and
   `letterSpacing: '0.05em'` (`Button.web.tsx:308`). This also fixes "Scan Barcode" and
   "More Options" wrapping on Food. Keep `fontWeight` bold for `md` and up; use semibold for `xs`
   and `sm`.
4. **Radius lock.** `xs` and `sm` use `borderRadius.md` (12); `md`, `lg` and `xl` use
   `borderRadius.lg` (16). `ActionButton` drops `rounded-3xl` (30) for `rounded-2xl` (16).
   Record the scale in `DESIGN.md`: 8 for chips inside dense rows, 12 for inputs and buttons,
   16 for cards and sheets, `full` only for circles, avatars and true pills (filter chips,
   segmented pill).
5. **Press feedback.** While in the component, add `android_ripple` bounded to the button on
   Android (0 uses in the app today) and keep the current scale feedback on iOS and web.

**Out of scope.** Button API (props stay identical), `SegmentedControl` (its selected gradient is
reviewed in Phase 2), home tile layout (Phase 5).

**Acceptance criteria.**

- No button in the app renders a colored shadow.
- At most one gradient button visible on any screen in the Phase 1 screenshot set.
- "Scan Barcode" and "More Options" render on one line at 390 width in English.
- `npm run check-palette` passes; button label contrast unchanged (solid accent fills already
  meet `text.onAccent` 4.5:1 per `DESIGN.md`).

**Guards** (`deslopGuards.test.ts`, created here):

- No `shadows.accentGlow`, `shadows.accentGlowLarge` or `shadows.roseGlow` anywhere in `app/` or
  `components/`.
- No `tracking-` class or `letterSpacing` in `components/theme/Button*.tsx`.
- `rounded-3xl` count in `app/` and `components/` (excluding `components/website/`) may not grow
  (ratchet from today's 7, target 0).
- `variant="gradientCta"` count may not grow (ratchet).

**Docs.** `DESIGN.md` Buttons section: replace "Primary: emerald or the approved emerald-to-teal
gradient" with the flat-default / one-gradient-CTA rule, and the radius scale above.

**Risk and rollback.** Medium: app-wide visual change. Pinned tests likely to need updates:
`components/__tests__/themeControls.test.ts`. Rollback is a single revert of the phase.

**Release note.** "Cleaner buttons across the app."

---

## Phase 2: Gradients and the indigo leak

**Goal.** Gradients only where they carry meaning (a photo scrim, a camera overlay, the single
primary action, the one hero card), and no indigo unless the data is indigo.

**Why.** FINDING-002. The hero gradient mixes `statusIndigo` into its first stop, so even the
orange Varia theme opens Home with a periwinkle sweep. There are 59 `LinearGradient` usages in 32
files; the catalog ceiling is one decorative gradient per app.

**Scope.** `theme.tokens.js` (`colorfulCardStart/Middle/End`), `theme.registry.js`
(`colorfulCardBlend`), `components/cards/GenericCard.tsx`, the decorative gradient sites listed
in [Appendix B](#appendix-b-gradient-inventory).

**Changes.**

1. **Hero card from the brand hue only.** Rebuild `colorfulCardStart` as a mix of `surfaceCard`
   with `brandDeep` (not `statusIndigo`), so the card is a single-hue tonal ramp: deep brand to
   vivid brand. Kinetic Light keeps its flat stops. Each theme's hero then belongs to its own
   palette. Re-run the colorful-card ink contrast (`colorfulCardInk`,
   `colorfulCardPanel`) through `npm run check-palette`.
2. **Decorative gradients out.** Replace each "remove" row in Appendix B with a flat surface or
   the token it imitates. In particular:
   - `HealthConnectIllustration` (indigo to brand tile), `NutritionGoalsBody` (indigo wash),
     `RestTimer` (accent to purple wash), `TimePickerModal` (secondary to tertiary),
     `TrackingMethodButton` (per-method icon gradient), `ViewExerciseModal` `blueEmerald` and
     `workout.iconGradient`, `CoachModal` chat bubble gradient.
3. **Hand-rolled gradient buttons through `Button`.** Nine sites draw `gradients.cta` themselves
   (`landing.tsx`, `nutrition-goals-results.tsx`, `PreRegistrationIntro`,
   `SmartCameraModePicker`, `FoodNotFoundModal`, `PastWorkoutDetailModal`,
   `BarcodeTextSearchSheet`, `AINutritionTrackingContextModal` x2). Replace each with
   `<Button variant="gradientCta" />` or `accent`, so Phase 1's rules apply to them.
4. **Colored headline words.** "Your **Nutrition Plan**" tints one word in indigo
   (`nutrition-goals-results.tsx`). Use solid `text.primary`; `DESIGN.md` already bans gradient
   glyphs and this is the same move.
5. **Segmented control.** Decide whether the selected segment keeps `gradients.cta`. Default
   recommendation: solid accent, consistent with Phase 1. See [Open decisions](#open-decisions).

**Out of scope.** Macro colors (protein stays indigo: it is data color, documented and stable
across charts), photo and camera scrims, `Slider` track.

**Acceptance criteria.**

- In all six themes, no hero card pixel row contains indigo unless the theme's brand is indigo.
- `LinearGradient` usages in `app/` and `components/` (excluding `components/website/`) drop from
  59 to the "keep" set in Appendix B.

**Guards.**

- `theme.tokens.js` must not reference `statusIndigo` inside `colorfulCard*` (string test, or
  better, a unit test asserting the hue of `colorfulCardStart` is within N degrees of
  `brandPrimary` per theme, extending `utils/__tests__/dailySummaryCardTheme.test.ts`).
- Allowlist of files permitted to import `LinearGradient`; a new file fails.
- No `gradients.cta` reference outside `components/theme/`.

**Docs.** `DESIGN.md` "The Daily Summary card" paragraph and a new "Gradients" subsection with
the allowlist rule. Website theme showcase assets and `screenshots/themes/` need regenerating at
Phase 10 (the hero card is in them).

**Risk and rollback.** Medium. Colorful-card ink contrast is pinned by
`dailySummaryCardTheme.test.ts` and the palette audit; run both. Rollback per commit.

**Release note.** "Each theme's colors now carry through the summary card."

---

## Phase 3: Rows, menus and settings

**Goal.** Replace the "card per row, tinted icon chip, title, description, chevron" pattern with
grouped native-style lists. This is the single largest source of the generated look.

**Why.** FINDING-003, 013, 014. `BottomPopUpMenu` renders 186 items across 37 menus with a colored
chip each (`iconBgColor` is a required prop); `SettingsCard` renders the Settings screen as ten
stacked cards; `ManagementItem`, `TrackingMethodButton` and `UserMenuModal` repeat it. The chip
colors (orange, green, indigo, yellow, purple) do not encode categories, which also breaks the
"one accent" lock. The small grouped block at the bottom of Settings (Terms, Privacy, Support) is
already the better pattern and is the model here.

**Scope.** New `components/theme/ListGroup.tsx`; `components/BottomPopUpMenu.tsx`;
`components/cards/SettingsCard.tsx`; `components/ManagementItem.tsx`;
`components/TrackingMethodButton.tsx`; `components/theme/ListRow.tsx`;
`components/modals/UserMenuModal.tsx`; `components/modals/AddFoodModal.tsx`;
`app/app/settings.tsx`; `app/app/profile.tsx`.

**Changes.**

1. **`ListGroup` primitive** in `components/theme/`: one rounded (16) surface containing rows
   separated by hairlines (`border-ink/10`, `StyleSheet.hairlineWidth`), an optional group title
   above it, optional footer text below. Rows: icon (naked, 20px, `text.secondary`; `accent` only
   when the row is the selected choice; `status.error` for destructive), title, optional one-line
   subtitle, trailing slot. Minimum row height 52, full-row press feedback (ripple on Android).
2. **Chevron means "pushes a screen or opens a sheet with more choices".** Rows that act
   immediately (Delete, Duplicate, Share) get no trailing chevron. Rows with a switch get the
   switch only.
3. **`BottomPopUpMenu`** renders its `items` as a `ListGroup`. `iconBgColor` becomes optional and
   ignored, then is removed from all 186 items in a follow-up commit in the same phase (pure
   deletion; mechanical). `description` becomes optional; drop it where it restates the title
   ("Edit: Edit this item"). Destructive items move to the end of the list, in error color.
4. **`SettingsCard`** keeps its props but renders as a row; `app/app/settings.tsx` wraps its rows
   in `ListGroup`s. Regroup and rename the top level so names stop overlapping
   (FINDING-013). Proposed, to confirm in [Open decisions](#open-decisions):
   - **You**: Profile and units (was Basic Settings)
   - **App**: Appearance and home (was Interface), Notifications
   - **Training**: Workout settings, Sensors
   - **Nutrition and health**: Nutrition and charts (the nutrition half of App Preferences),
     Cycle
   - **AI**: AI settings
   - **Data**: Backups and data (was Local Data Settings)
   - **About**: What's new, Help and feedback, Terms, Privacy, Support, version
     Only labels and grouping change; every row opens the same modal it opens today.
5. **Profile "Management"**, **account menu** (`UserMenuModal`) and **Add Food** sheet use
   `ListGroup`. The Add Food meal-type tiles drop their per-meal colors (one neutral icon color,
   accent on press). "AI Camera" stops being the odd one out: same row anatomy as its siblings, no
   gradient chip, no arrow instead of chevron.
6. **`ListRow`** gains a `grouped` variant used inside `ListGroup`, so existing `card`/`filled`
   consumers are unaffected.

**Out of scope.** Changing what any menu item does, the navigation slot system, the
`NAV_DESTINATIONS` table.

**Acceptance criteria.**

- Settings, Profile, the account menu, Add Food and any five sampled `BottomPopUpMenu` menus show
  no tinted icon squares.
- Settings root fits in about 1.5 screens at 390x844 (today: one long column of 10 cards plus a
  links card).
- Every row still has an accessible label (title, plus subtitle via `accessibilityHint`).

**Guards.**

- No `iconBgColor` in `BottomPopUpMenuItem` type or any call site.
- `SettingsCard` / `ManagementItem` / `TrackingMethodButton` source contains no fixed-size tinted
  icon container (assert the absence of `iconDark`/`iconDarker` backgrounds there).
- Ratchet: count of `h-1[0-2] w-1[0-2] ... rounded-* bg-` icon-chip class combinations in
  `app/` and `components/` (excluding website) may not grow; today 33.

**Docs.** `DESIGN.md` Components table: add `ListGroup`, describe the chevron rule and the icon
color rule. `CURRENT_FEATURES.md` if the settings names change.

**Risk and rollback.** Medium. Many screens change appearance, but no behavior does. Watch
`components/__tests__/themeControls.test.ts`, `appLockCoverage.test.ts` (Settings lock entry) and
any test that queries menus by text. Ship the `BottomPopUpMenu` rendering change and the
`iconBgColor` deletion as separate commits so the deletion can be reverted alone.

**Release note.** "Simpler menus and a reorganized Settings screen."

---

## Phase 4: Labels and microtext

**Goal.** One component for small section labels, with all-caps reserved for the few places it
carries meaning.

**Why.** FINDING-007. There are 343 `uppercase` and 241 `tracking-*` usages, mostly hand-written
variants of the same eyebrow (`text-xs font-bold uppercase tracking-wider` x24,
`... tracking-widest` x22, `text-[10px] font-bold uppercase ...` x17). Reflexive tracked caps on
every eyebrow is a top-tier tell, and twelve near-identical spellings also mean nobody can change
the style in one place.

**Scope.** New `components/theme/SectionLabel.tsx`; `components/StatStrip.tsx:76`;
`components/theme/ListRow.tsx` (`overline`); `app/app/settings.tsx:119`; then the files with the
most occurrences: `PastWorkoutDetailModal` (12), `CurrentGoalsCard` (9), `CheckinDetailsModal`
(8), `ProgressInsightsSection` (7), `AISettingsModal` (7), `ExerciseGoalDetailModal` (6),
`ExerciseTransitionScreen` (6), and the rest by count.

**Changes.**

1. **`SectionLabel`**: `text-sm font-semibold text-text-secondary`, sentence case, no tracking.
   Optional `tone="accent"` for the one live-state label per screen ("Workout in progress",
   "Today"). Optional `icon`.
2. **Policy** (record in `DESIGN.md`): uppercase stays only for (a) single-letter or unit
   abbreviations (`P`, `KCAL` may become `kcal`; see Open decisions), (b) the weekday initials in
   calendars. Everything else is sentence case.
3. **Migrate in two commits**: the components above first (they cover the most screens), then the
   remaining files mechanically. The `StatStrip` label becomes `text-xs text-text-tertiary`
   sentence case; `DESIGN.md` currently prescribes uppercase there and must change with it.

**Out of scope.** Font family, type scale tokens.

**Acceptance criteria.**

- `uppercase` in `app/app` and `components/` (excluding `components/website/` and `app/app/test/`)
  at or below an agreed allowlist (target under 20 occurrences, all justified).
- No `tracking-wider` or `tracking-widest` outside the allowlist.

**Guards.** Ratchet test with the current count as the ceiling at phase start, lowered to the
final number at phase end. A new `uppercase` or `tracking-wide*` class fails CI unless the file is
on the allowlist.

**Docs.** `DESIGN.md` Typography: the label policy and `SectionLabel`; `StatStrip` paragraph.

**Risk and rollback.** Low; text styling only. Check Russian and Dutch at 390 width: sentence
case labels are wider than tracked caps in some locales.

**Release note.** "More readable labels."

---

## Phase 5: Home and the hero surfaces

**Goal.** Home opens on the day's data and the one action the user came for, without greeting
copy, decorative tiles or repeated promotion.

**Why.** FINDING-009, 022. The first screen today is: a "Good Afternoon, Alex Johnson" greeting,
the hero card, a three-figure stat strip, two 180px tiles ("Start Workout", "Track Food") with
faded watermark icons, and the Weekly Review card. The two tiles duplicate the Workouts and Food
tabs and the camera button that are already on screen, and take about a quarter of the first
viewport. The same Weekly Review card also appears on Workouts and Food.

**Scope.** `app/app/index.tsx` (greeting at lines 196-205), `components/home/` (`HomeActionsRow`,
`DailyHomeSummary`, `DailyHomeFooter`), `components/ActionButton.tsx`,
`components/cards/WeeklyStreakCard.tsx`, `app/app/cycle.tsx`.

**Changes.**

1. **Header.** Replace the greeting with the date ("Monday, Oct 19") or nothing; keep the avatar
   as the account-menu entry and add an accessible label to it. Drop the version string from the
   Home header (it belongs in Settings > About, where it already is).
2. **Home actions.** `ActionButton` loses the watermark icon and its tinted circle, becomes a
   compact tile (about 88 to 100px, icon and label in a row or stacked small), radius 16. Keep the
   whole home-actions system (`HOME_ACTION_KEYS`, picker, reconciliation): only the tile changes,
   so the tests in `components/home/__tests__/` keep passing. The grid arithmetic stays in
   `HomeActionsRow`.
3. **Weekly Review card.** On Home, show it only while a review is due or in progress, like Food
   already does; otherwise a one-line entry. This needs a product decision because `DESIGN.md`
   says "Home shows a compact permanent Weekly Review card". See Open decisions.
4. **Cycle.** Show the cycle day once (keep the ring, drop the "Day 15/28" badge or vice versa)
   and shorten the title so it fits on one line ("Cycle" with the phase as subtitle).

**Out of scope.** Changing which summary card is shown (`HOME_SUMMARY_CARD_SETTING_TYPE`), the
stat strip logic, nutrition ownership (`homeNutritionOwnership.test.ts` must keep passing).

**Acceptance criteria.**

- At 390x844 in Kinetic Depth, the first viewport shows the hero card, the stat strip, the home
  actions and the start of the next section.
- No greeting text; no watermark icon.

**Guards.** `ActionButton.tsx` contains no absolutely positioned icon; `app/app/index.tsx` no
longer references `home.greeting.*` (and the keys are removed from all locales).

**Docs.** `DESIGN.md` Home paragraphs; `CURRENT_FEATURES.md` if the Weekly Review card behavior
changes.

**Risk and rollback.** Medium: Home is the most-seen screen. Ship behind no flag; revert is one
commit per item.

**Release note.** "A tidier Home screen."

---

## Phase 6: Empty states, illustrations and decorative motion

**Goal.** Remove decoration that conveys nothing, and move whatever motion remains off the JS
thread.

**Why.** FINDING-006, 015, 019, 021.

**Scope and changes.**

| Item                                        | Where                                                                                                                                   | Change                                                                                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty state template                        | `components/theme/EmptyStateCard.tsx` (4 consumers)                                                                                     | Icon at 40 to 48px with no 160px tinted circle; default button `secondary`, not `gradientCta`; no card wrapper when the empty state is the whole screen (Notes).                                        |
| Landing blobs                               | `app/app/onboarding/landing.tsx`                                                                                                        | Remove the dark circle and green capsule shapes (`gradients.landingBackground` is already flat). Replace the star-in-a-square placeholder with the real app mark (`assets/logo.png` or the theme icon). |
| Health Connect illustration                 | `components/HealthConnectIllustration.tsx`                                                                                              | Drop the gradient shield tile and the scattered floating icons; show the Health Connect / Health logo or the four data-type rows only.                                                                  |
| Gemini illustration, pre-registration intro | `components/GoogleGeminiIllustration.tsx`, `components/PreRegistrationIntro.tsx`                                                        | Same test: keep only what explains the feature.                                                                                                                                                         |
| Glow pulses                                 | `app/app/workout/rest-over.tsx:65-76`, `components/WorkoutSummaryCelebration.tsx:50-66`                                                 | Remove the infinite glow loops. If a single entrance animation is wanted, use Reanimated with `useReducedMotion` respected.                                                                             |
| Dashed "Add" bars                           | 10 files using `DashedButton` / `variant="dashed"` (`MealSection`, `index.tsx`, `WorkoutLibraryContent`, `WorkoutTrainingView`, modals) | Keep dashed only for a genuinely empty slot (an empty meal, an empty plan). Permanent "Add food to Lunch" under a filled section becomes a `TextButton` with a plus icon.                               |

**Out of scope.** Milestone confetti; the camera viewfinder frame animation.

**Acceptance criteria.** No `Animated.loop` driving opacity or shadow outside
`components/theme/SkeletonLoader.tsx`; no absolutely positioned decorative shapes on onboarding.

**Guards.** No `useNativeDriver: false` outside `components/theme/TextInput.tsx` (color
interpolation, documented exception). `DashedButton` usage ratchet.

**Docs.** `DESIGN.md`: empty-state rule, motion rule ("decorative loops are not allowed").

**Risk and rollback.** Low.

**Release note.** "Lighter onboarding and empty screens."

---

## Phase 7: Copy

**Goal.** Product voice that is direct and calm everywhere, per `DESIGN.md` Product tone.

**Why.** FINDING-017, 018.

**Changes.**

1. **Em dashes.** 57 `—` occurrences in `lang/locales/en-us/*.json` (excluding `website.json`).
   Keep the ones that are a value placeholder (`cardio.noPace`, the "not logged" legend marks);
   rewrite the rest with a comma, colon, parentheses or two sentences. Example:
   `emptyStates.notes.description` "Jot down what you're making — 70g of broccoli, a recipe idea —
   and track it whenever you're ready." becomes "Jot down what you're cooking, like 70g of
   broccoli or a recipe idea, and track it when you're ready." Same pass in the other four
   locales (each has its own dash usage).
2. **Exclamations.** 33 en-us strings end in `!` ("Fuel your body!", "Great work!",
   "Complete!", Loggy's welcome). Keep at most the genuine celebrations (a goal achieved); rewrite
   the rest flat.
3. **Marketing claims in UI.** "Search our database of 2M+ items" (`food.json:291`) becomes a
   description of what happens ("Open Food Facts, USDA and your foods").
4. **Casing.** Sentence case for headings, buttons and menu items ("Track by meal type", not
   "Track by Meal Type"; "Create workout template"). Record the rule in `DESIGN.md`.
5. **Sparkles means AI.** 42 `Sparkles` usages in 26 files. Keep it only on AI affordances (which
   are already gated on `isAiConfigured`); replace it on non-AI meanings: "Automatic starting
   targets" (use a trending or gauge icon), "What's new" (use a gift or megaphone icon), and any
   others the sweep finds.
6. **Coach intro.** Shorten Loggy's welcome messages to two sentences each.

**Out of scope.** Website copy (`website.json`), legal text.

**Acceptance criteria.** `npm run check-translations` and `check-locale-consistency` pass; no
em dash in en-us outside the placeholder allowlist.

**Guards.** Locale test: en-us strings may not contain `—` except allowlisted keys; ratchet on
strings ending in `!`; `Sparkles` import allowlist.

**Docs.** `DESIGN.md` Product tone: casing and punctuation rules.

**Risk and rollback.** Low; copy only. Translator review for non-English.

**Release note.** "Clearer wording throughout."

---

## Phase 8: Screen headers and wayfinding

**Goal.** One header component, so every screen shows where you are and how to get back, in the
same place and the same style.

**Why.** FINDING-012. Each top-level screen hand-rolls its title (`text-4xl font-bold` in
Profile, Notes, Workouts; a two-line title on Cycle), Progress alone uses the native stack header
(small title, platform back), and Profile, Cycle and Notes, which open from the account menu,
show no back affordance and no selected tab. On device, Android's back button and iOS swipe-back
may cover it, but the screen itself gives no cue.

**Scope.** New `components/theme/ScreenHeader.tsx`; `app/app/progress.tsx`, `profile.tsx`,
`notes.tsx`, `cycle.tsx`, `weekly-review.tsx`, `workout/workouts.tsx`, `settings.tsx`,
`nutrition/food.tsx` (day navigator stays, rendered in the header's center slot).

**Changes.**

1. **`ScreenHeader`** with two forms: `root` (large title, left aligned, trailing actions; used by
   the four nav destinations) and `pushed` (back button, title, trailing actions; used by screens
   reached from the account menu or another screen). Safe-area aware, 44pt targets, a header
   `accessibilityRole`.
2. Profile, Progress, Cycle, Notes and Weekly Review use `pushed`. Progress moves off the native
   stack header so it matches the others.
3. Settings already has a back header; move it onto the component.

**Out of scope.** Route names, `NAV_DESTINATIONS`, slot configuration, deep links. Do not touch
the account menu's ordering (`USER_MENU_ORDER`).

**Acceptance criteria.** Every screen in the audit list passes the Trunk Test (what screen, where,
how back) on web and on one Android device.

**Guards.** A test asserting each listed route file renders `ScreenHeader`, modeled on
`appLockCoverage.test.ts`.

**Docs.** `DESIGN.md` new "Screen headers" subsection; `AGENTS.md` if the header becomes a rule for
new screens.

**Risk and rollback.** Medium: touches many route files. Depends on Phase 4 for the label style
used in subtitles.

**Status.** Done. `components/theme/ScreenHeader.tsx` is on all eight screens. Root or pushed is
not fixed per screen: it depends on whether the screen is in one of the user's bottom-bar slots
(`resolveScreenHeaderForm`), because slots are configurable and Profile can be either. Food is a
root whose day navigator fills the `center` slot. The header sits outside each screen's
`AreaLockGate`, so back works behind a lock, and hides its subtitle and actions while that area is
locked. Back falls back to Home when there is no history. Pinned by
`components/__tests__/screenHeaderForm.test.ts` and the Phase 8 block in `deslopGuards.test.ts`.

**Release note.** "Consistent screen headers with a back button where you need one."

---

## Phase 9: Lists

**Goal.** Virtualize every list whose length is not bounded.

**Why.** FINDING-016. History and search lists render `ScrollView` plus `.map()` with a "Load
more" button; only four files use `FlatList`. Not a visual tell, but the catalog lists it, and a
long history on a mid-range Android phone is where it shows.

**Scope.** `components/modals/PastWorkoutsHistoryModal.tsx`, `BodyMetricsHistoryModal.tsx`,
`FoodSearchModal.tsx`, `MyMealsModal.tsx`, `PastWorkoutsHistoryModal` section list. The food
diary (one day, bounded) and fixed option lists stay as they are.

**Changes.** `FlatList` / `SectionList` with stable keys, memoized rows and `onEndReached`
pagination replacing the "Load more" button where the data source already paginates.
`KeyboardAwareScrollView` rules from `AGENTS.md` still apply inside modals with inputs.

**Acceptance criteria.** Scroll a 500-entry workout history and a 200-result food search on a
release Android build without blank cells or dropped frames.

**Guards.** None automatic; listed in the Phase 10 device checklist.

**Risk and rollback.** Medium: pagination behavior changes. Keep the existing tests for the
history and search hooks green, and add one per converted list for "next page loads on scroll".

**Status.** Done. `PastWorkoutsHistoryModal` (`SectionList`), `BodyMetricsHistoryModal` and `MyMealsModal` (`FlatList`, `onEndReached` paging, "Load more" buttons gone). `FoodSearchModal` renders a `FlatList` over a flat row model (`components/modals/foodSearchRows.ts`, pure, pinned by `foodSearchRows.test.ts`). It stacks up to three paginated sources, and only the last one can page on scroll: the end of a middle section is never the end of the list. So the tail section loads from `onEndReached`, and a section above it keeps an inline "Load more from …" row. A source's error now follows the pages it already loaded instead of replacing them. The `loadMore` translation keys of the first three converted lists are unused; `loadMoreFavorites` and `loadMoreMeals` were removed with this change.

**Release note.** "Faster history and search lists."

---

## Phase 10: Device verification, store assets and close-out

**Goal.** Verify everything the web-only audit could not, refresh public assets, and record the
new baseline.

**Changes and checks.**

1. **Device pass** (release builds: `npm run build-android-apk-local`, plus an iOS build):
   - Keyboard: submit buttons visible with the keyboard open in onboarding, Create Custom Food,
     set details sheet.
   - Font scale 1.3x and 2.0x: tab labels, `Button`, `StatStrip`, `ScreenHeader`. Add
     `maxFontSizeMultiplier` (about 1.3) to fixed-height chrome text; there are 0 uses today.
   - Android edge-to-edge insets on every scrollable and the camera bar.
   - Touch targets at least 44x44 on kebab (`MenuButton`) and `IconButton ghost`.
   - Scroll performance on the Phase 9 lists.
   - All six themes on Home, Food, Workouts, Settings, session.
2. **Store and website assets**: regenerate `screenshots/` (`npm run screenshots`), the theme
   showcase images in `screenshots/themes/`, and the website's theme showcase.
3. **What's New**: if Phases 3 and 5 ship in the same release, add one page under
   `data/whatsNew/` (all five locales, registered in `releases.ts`) describing the new menus and
   Home.
4. **Re-run the audit** ([Appendix C](#appendix-c-how-to-re-run-the-audit)), refresh
   `design-baseline.json`, and lead the pull request with the delta table.

**Acceptance criteria.** Design Score A- or better with no open high findings; every item in the
baseline's `unverified` list either verified or carried forward with a reason.

**Release note.** None (verification and assets).

---

## Open decisions

Decide these before the phase that needs them. Each has a recommendation.

| #   | Question                                                                               | Needed by | Recommendation                                                                                                   |
| --- | -------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| D1  | Does the selected `SegmentedControl` segment keep the gradient?                        | Phase 2   | **Decided:** solid accent; the gradient is reserved for `gradientCta`.                                           |
| D2  | Hero card: tonal single-hue gradient, or flat like Kinetic Light?                      | Phase 2   | **Decided:** tonal single-hue; it keeps the card as the one expressive element per screen.                       |
| D3  | Settings top-level grouping and names                                                  | Phase 3   | **Decided:** the seven groups in Phase 3, step 4.                                                                |
| D4  | Unit abbreviations in caps (`KCAL`) or lowercase (`kcal`)?                             | Phase 4   | **Decided:** lowercase `kcal`, matching the stat strip.                                                          |
| D5  | Home header: date, nothing, or keep a greeting?                                        | Phase 5   | **Decided:** date.                                                                                               |
| D6  | Weekly Review card on Home: permanent or only while due?                               | Phase 5   | **Decided:** only while due, plus a one-line entry otherwise; consistent with Food.                              |
| D7  | Should the Home action tiles stay at all, given the nav bar has the same destinations? | Phase 5   | **Decided:** keep them, compact. The picker offers actions the nav bar does not have (AI camera, notes, cardio). |

## Appendix A: Audit findings

Impact: **high** breaks usability or trust; **medium** visibly wrong but recoverable;
**polish** taste-level. "UX" marks a real usability problem, "Look" an aesthetic one.

| ID  | Impact | Kind | Finding                                                                                                   | Phase |
| --- | ------ | ---- | --------------------------------------------------------------------------------------------------------- | ----- |
| 001 | high   | UX   | Raw i18n keys (`workout.exerciseTypes.plate_machine`, `cardio`) shown in the session                      | 0     |
| 002 | medium | Look | Hero gradient starts on `statusIndigo` in every theme                                                     | 2     |
| 003 | medium | Look | Card-stack + icon-chip rows (`BottomPopUpMenu`, `SettingsCard`, `ManagementItem`, `TrackingMethodButton`) | 3     |
| 004 | medium | Look | `Button`: gradient default, glow shadows, radius 20-24, tracked labels                                    | 1     |
| 005 | medium | Look | Radius drift from `DESIGN.md`                                                                             | 1     |
| 006 | medium | Look | Landing blobs, watermark icons, floating illustration icons                                               | 6     |
| 007 | medium | Look | Reflexive uppercase tracked microtext (343 / 241 usages)                                                  | 4     |
| 008 | medium | UX   | Truncated macro labels; letter-spaced button labels wrap                                                  | 0     |
| 009 | medium | Both | Home: greeting, duplicate destination tiles, permanent review card                                        | 5     |
| 010 | medium | UX   | Profile stat grid overflows the gutter                                                                    | 0     |
| 011 | medium | UX   | Interface settings: inverted heading proximity                                                            | 0     |
| 012 | medium | UX   | Inconsistent screen headers; no back cue on account-menu screens                                          | 8     |
| 013 | medium | UX   | Overlapping Settings group names                                                                          | 3     |
| 014 | medium | Look | Rainbow icon chips without categorical meaning                                                            | 3     |
| 015 | medium | Both | Infinite JS-thread glow pulses                                                                            | 6     |
| 016 | medium | UX   | Unvirtualized history and search lists                                                                    | 9     |
| 017 | medium | Look | Em dashes, exclamations, marketing claim in UI copy                                                       | 7     |
| 018 | medium | Look | Sparkles used for non-AI meanings                                                                         | 7     |
| 019 | medium | Look | Template empty state                                                                                      | 6     |
| 020 | polish | UX   | Workouts chip row misaligned and clipped                                                                  | 0     |
| 021 | polish | Look | Dashed "Add" bars for permanent actions                                                                   | 6     |
| 022 | polish | Look | Cycle day shown twice; title wraps                                                                        | 5     |
| 023 | polish | UX   | Progress chart axis labels overlap                                                                        | 0     |

**Dismissed checks** (with reasons) are recorded in `design-baseline.json` under `dismissed`.

## Appendix B: Gradient inventory

The 32 files that render `LinearGradient` today (excluding the website), with the default
decision for Phase 2. "Verify" means the default is a guess from the color tokens and must be
confirmed on screen before changing.

| File                                                    | What it draws                              | Decision                                     |
| ------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| `components/theme/Button.tsx`                           | `gradientCta`, `secondaryGradient` fills   | Keep `gradientCta` only (Phase 1)            |
| `components/cards/GenericCard.tsx`                      | `hero` variant (Daily Summary)             | Keep, single-hue (Phase 2)                   |
| `components/theme/SegmentedControl.tsx`                 | Selected segment                           | D1                                           |
| `components/theme/Slider.tsx`                           | Track fill                                 | Keep                                         |
| `components/workout/session/GuidedExerciseView.tsx`     | Photo scrim                                | Keep                                         |
| `components/workout/session/ExerciseHeader.tsx`         | Photo fade to surface                      | Keep                                         |
| `components/cards/DetailedItemCard.tsx`                 | Photo scrim                                | Keep                                         |
| `components/cards/ChatWorkoutCard.tsx`                  | Photo scrim                                | Keep                                         |
| `components/modals/ExerciseGoalCreationModal.tsx`       | Backdrop fade                              | Keep, verify                                 |
| `components/modals/SmartCameraShell.tsx`                | Camera overlay                             | Keep                                         |
| `components/SmartCameraFrame.tsx`                       | Scan line                                  | Keep                                         |
| `components/BottomButtonWrapper.tsx`                    | Fade above sticky footer                   | Keep                                         |
| `components/cards/CaloriesRemainingCard.tsx`            | Progress fill                              | Verify; prefer solid                         |
| `components/modals/ViewExerciseModal.tsx`               | Photo scrim; `blueEmerald`; `iconGradient` | Keep scrim, remove the other two             |
| `components/HealthConnectIllustration.tsx`              | Indigo to brand tile                       | Remove (Phase 6)                             |
| `components/GoogleGeminiIllustration.tsx`               | Illustration                               | Remove or simplify (Phase 6)                 |
| `components/NutritionGoalsBody.tsx`                     | Indigo wash                                | Remove                                       |
| `components/RestTimer.tsx`                              | Accent to purple wash                      | Remove                                       |
| `components/modals/TimePickerModal.tsx`                 | Secondary to tertiary                      | Remove                                       |
| `components/TrackingMethodButton.tsx`                   | Per-method icon gradient                   | Remove (Phase 3)                             |
| `components/modals/CoachModal.tsx`                      | Chat bubble gradient                       | Remove; solid bubble                         |
| `components/modals/CircadianScienceModal.tsx`           | Accent wash                                | Remove                                       |
| `components/cards/FoodNutritionSectionCard.tsx`         | Verify                                     | Verify                                       |
| `components/ExerciseTransitionScreen.tsx`               | Verify                                     | Verify                                       |
| `components/modals/PastWorkoutDetailModal.tsx`          | Hand-rolled `gradients.cta`                | Route through `Button`                       |
| `components/modals/FoodNotFoundModal.tsx`               | Hand-rolled `gradients.cta`                | Route through `Button`                       |
| `components/modals/BarcodeTextSearchSheet.tsx`          | Hand-rolled `gradients.cta`                | Route through `Button`                       |
| `components/modals/AINutritionTrackingContextModal.tsx` | Hand-rolled `gradients.cta` x2             | Route through `Button`                       |
| `components/SmartCameraModePicker.tsx`                  | Hand-rolled `gradients.cta`                | Route through `Button` or `SegmentedControl` |
| `components/PreRegistrationIntro.tsx`                   | Hand-rolled `gradients.cta`                | Route through `Button`                       |
| `app/app/onboarding/landing.tsx`                        | Background + hand-rolled CTA               | Flat background; `Button`                    |
| `app/app/onboarding/nutrition-goals-results.tsx`        | Hand-rolled `gradients.cta`                | Route through `Button`                       |

## Appendix C: How to re-run the audit

1. Start the web build: `NODE_OPTIONS=--max-old-space-size=10240 npm run web` (Metro runs out of
   memory without the larger heap after many reloads; do not set `CI=1`).
2. Seed demo data: open `http://localhost:8081/app/onboarding/landing?demoModeEnabled=true`.
   Visiting other onboarding routes afterwards can reset the database; re-seed if screens empty.
3. Capture at 390x844 (Chrome headless over CDP, or `npm run screenshots`): Home, Workouts, Food,
   Progress, Profile, Settings and its Interface modal, Notes, Weekly Review, Cycle, the workout
   session in Inline and Guided, Coach chat, the Add Food sheet, the account menu, onboarding
   landing, quick setup, training setup, nutrition results, Health Connect.
4. Repeat Home, Food, Workouts and Settings in Kinetic Light and one more dark theme.
5. Run the grep checklist from `.claude/skills/_shared/references/tells.md` and the guard tests.
6. Score with the rubric in `.claude/skills/_shared/references/review-rubric.md` and refresh
   `design-baseline.json`; the delta table goes first in the pull request.
