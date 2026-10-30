# Unsitefication: making Musclog feel like a native app

Status: proposed — nothing here is implemented yet.
Scope: the iOS and Android app (`app/app/` and the components it renders). The marketing website
(`app/(website)/`, `components/website/`) is out of scope.

## 1. Problem

Several people have said the app "looks like a website". The audit (October 2026, against the
`kinetic-depth` captures in `screenshots/app-store/` and the code) found that the visual identity is
not the cause — themes, typography, the hero card and the colour system are fine. The cause is
**behaviour**: how screens open, move, close, confirm and respond to touch. Native apps communicate
through motion direction, gestures, system dialogs and haptics; Musclog mostly uses the patterns a
browser would use instead.

Most of it comes from a few shared files, so a small number of changes reach most of the app.

A second, smaller cause is **how space is spent** (U11). The screens are not overloaded — Home
shows about as much as a dedicated nutrition dashboard — but the information is split across many
separately boxed surfaces with gaps between them, so it reads as a web dashboard of cards rather than
a native screen of grouped lists.

### Baseline (measured 2026-10-27, `app/app` + `components`, excluding `.web.tsx`, website and test routes)

| Signal                                     | Count                                  |
| ------------------------------------------ | -------------------------------------- |
| Files rendering `<FullScreenModal`         | 84                                     |
| Files rendering `<BottomPopUp`             | 62                                     |
| Files rendering `<ConfirmationModal`       | 31                                     |
| Files rendering `<CenteredModal`           | 8                                      |
| `Alert.alert` call sites                   | 0                                      |
| Files using `expo-haptics` (outside utils) | 2 (`NavigationMenu`, rest timer)       |
| Files using `android_ripple`               | 4                                      |
| List rows with swipe actions               | 0                                      |
| Files importing `@expo/ui` in the app      | 0 (installed, used only by `widgets/`) |
| Root stack transition                      | `animation: 'fade'` for every route    |

Density baseline (measured 2026-10-27 on the `kinetic-depth` 6.7" captures, 1284×2778px = 428×926pt;
"gap" = rows between the header and the bottom bar that are plain background, so it excludes padding
inside a box):

| Screen   | Empty gap between surfaces | Notes                                                                        |
| -------- | -------------------------- | ---------------------------------------------------------------------------- |
| Home     | 23%                        | 8 separately bordered surfaces in the first viewport; 2 recent foods visible |
| Food     | 24%                        | first logged item starts about 55% of the way down the screen                |
| Progress | 13%                        | no chart in the first viewport                                               |
| Profile  | 27%                        | Age and Gender each get a ~96pt tile                                         |

Re-measure with the same method after each Phase 4 milestone; the targets are in U11.

Heuristic score (ux-heuristics): **6/10** — nothing blocks a task; deductions are platform
consistency, user control (dismiss, undo) and visibility of system status (feedback).

## 2. Goals and non-goals

**Goals**

- Navigation has direction: drill-down pushes, tasks present as sheets, and both dismiss with the
  platform gesture.
- Confirmations, menus and pickers use the platform's own surfaces.
- Every meaningful touch gives feedback appropriate to the platform (haptic, ripple, pressed state).
- Lists read as lists, not as stacks of cards.
- Each main screen has one job and one primary action.
- Space goes to content, not gaps and box padding: related rows share one surface, key figures are
  large and plain, and no number is shown twice with different meanings.

**Non-goals**

- No new component library. `@expo/ui` is already a dependency and may be used; nothing else is
  added without a separate decision.
- No change to themes, palettes, branding, the hero card, or the website. The one optional
  exception is trimming the hero card's four percentages (U11, open question 5), which needs a
  decision first.
- No feature removal. Things may move (into a header menu, a sheet, a row), never disappear.
- No change to the speed of workout logging. The inline set table, steppers, RIR quick-pick and
  rest timer stay as they are, except for added haptics (U9).

## 3. What stays dense on purpose

These are power-user surfaces, not web tells. Restyle containers if a phase touches them, but keep
the information and the tap count:

- **Live session set table** (`components/workout/session/InlineSetRow.tsx`): Previous / Weight /
  Reps / ✓ per row, 44pt targets, RIR quick-pick. This is the Strong/Hevy pattern lifters expect.
- **Hero card macro bars** (P / C / F / Fi) and the macro line on food rows. The percentages beside
  the bars are the one candidate for trimming (U11), because the bars already show them.
- **−/+ steppers** on Log set, Edit set and serving size: right for sweaty, one-handed entry.
- **Rest timer bar** and its controls.

## 4. Findings

Each finding has an ID used by the phases below. "Before" is what ships today; "After" is the
target.

### U1 — Every screen change is a cross-fade, like a page load

- **Evidence**: `app/app/_layout.tsx` sets `animation: 'fade', animationDuration: 200` in the root
  `Stack` `screenOptions`, so Settings, Weekly Review, Notes, Profile (from the avatar) and every
  other route fade in place.
- **Why it reads as web**: native apps show hierarchy with direction (push from the side, iOS edge
  swipe back). A directionless fade is what a browser does between pages.
- **Before**: all routes fade.
- **After**: drill-down routes use the platform default push (`animation: 'default'`). Switching
  between bottom-bar destinations uses `fade` or `none`. Because bottom-bar slots are
  user-configurable (`NAV_ITEM_KEYS`, `resolveScreenHeaderForm`), the rule is keyed on "is this a
  bottom-bar destination", never on a hard-coded list of screens.
- **To verify first (M0)**:
  - Does the iOS edge-swipe back gesture work under `fade` today?
  - What does Android back do after Home → Food → Workouts → Home? `NavigationMenu` uses
    `router.navigate` for most slots and `router.replace` for Food, so the back history may behave
    like browser history. Decide the intended behaviour (back from a root destination returns to
    Home, then exits) and pin it.

### U2 — Drill-down screens are full-screen modals that slide up but close with a back arrow

- **Evidence**: `components/modals/FullScreenModal.tsx` is an RN `Modal` with
  `animationType="slide"` and an `ArrowLeft` close button. 84 files use it — Food details, Add food
  to Breakfast, Exercises, Nutrition log, Past workout detail, Past workouts history, Body metrics,
  Log meal, Add entry, Select time. `app/app/index.tsx` alone imports about 14 modals.
- **Why it reads as web**: the motion says "sheet", the arrow says "page", and neither gesture
  works (no swipe down, no swipe back). It behaves like a web overlay with a fake back button.
- **Before**: slides up from the bottom, ← at top left, no gestures, not deep-linkable.
- **After**: every `FullScreenModal` use is classified as one of:
  - **Task** (compose or edit something, then leave): Log meal, Add entry, Create custom food,
    Create meal, Add exercise, Create workout, Edit personal info. On iOS present with
    `presentationStyle="pageSheet"` (supported by RN `Modal`; gives the card-stack look and
    swipe-to-dismiss). Header: **Cancel** (leading) and the commit action (trailing, e.g. **Add**,
    **Save**) where the form is short; long forms keep the bottom primary button. On Android, full
    screen with an ✕ close, not ←.
  - **Browse / detail** (look at or navigate through content): Exercises, Nutrition log, Past
    workouts history, Past workout detail, Body metrics history, Goals management. These become real
    routes under `app/app/` so they push, swipe back, and can be deep-linked.
- **Risks**: `pageSheet` must be checked against the nested-modal presenter rules in `FIXES.md` and
  the `local/no-sibling-modals` lint rule; keyboard avoidance inside a page sheet; `AppLockOverlay`
  must still cover it. Verify on a **release** build on both platforms.

### U3 — Bottom sheets have no grab handle and no drag-to-dismiss

- **Evidence**: `components/BottomPopUp.tsx` (62 files) has no gesture handling; the only way out is
  an ✕ button. Seen in Workout options, Add meal, Add food, Log set performance, Replace exercise,
  Edit set details.
- **Why it reads as web**: the "X-Button Sheet" tell. A native sheet shows a handle and follows the
  finger down.
- **After**:
  - `BottomPopUp` draws a grab handle and supports pan-to-dismiss (Gesture Handler is already mounted
    at the root and inside `Modal.ios.tsx`), with a velocity/distance threshold and spring back.
  - Pure action menus (`BottomPopUpMenu`: Workout options, Add meal, Add food) drop the ✕.
  - Form sheets (Log set performance, Edit set details) keep an explicit **Cancel**; dragging a sheet
    with unsaved input asks before discarding.
  - Inner scroll views must hand off to the dismiss gesture only when scrolled to the top.
- **Not in scope**: migrating all 62 sheets to `@expo/ui` `BottomSheet`. Enhance the shared shell in
  place; revisit `@expo/ui` only if the custom gesture proves unreliable.

### U4 — Confirmations are custom centred web dialogs

- **Evidence**: `components/modals/ConfirmationModal.tsx` in 31 files; `Alert.alert` nowhere. The
  default copy is "Confirm Action / Are you sure you want to proceed with this action?".
  `components/modals/EndWorkoutModal.tsx` is a centred card with its own ✕ and two equal-weight
  full-width buttons, one a red "Finish and discard".
- **Why it reads as web**: the hand-styled centred dialog is the most recognisable web-modal
  pattern, and it gives the destructive choice the same weight as the safe one.
- **After**:
  - **Binary confirmation** → native `Alert.alert` with a specific title ("Discard this workout?"),
    a `style: 'cancel'` button and a `style: 'destructive'` button.
  - **Several choices** (End workout) → an action sheet: **Finish and save**, **Discard workout**
    (destructive), **Cancel**. iOS: `ActionSheetIOS`; Android: a `BottomPopUpMenu`.
  - **Reversible deletes** (food log entry, note, metric entry) → delete immediately and show a
    snackbar with **Undo** (`context/SnackbarContext.tsx` already supports an action). No
    confirmation.
  - Irreversible deletes (delete all cycle data, clear app data, restore over the database) keep a
    confirmation.
  - The generic default copy is removed; every call site passes a specific title.
- **Web**: `Alert.alert` is a no-op on react-native-web. Keep `ConfirmationModal` as the
  `.web.tsx` fallback behind one shared `confirm()` helper, so call sites do not branch.

### U5 — Every list row is its own card with a ⋮ menu

- **Evidence**: food diary rows (`components/cards/FoodItemCard.tsx` and the diary in
  `app/app/nutrition/food.tsx`), Recent foods on Home, Nutrition log, Add exercise and Replace
  exercise render each row as a separate rounded, bordered box with a vertical ⋮ button. No list row
  has swipe actions (the one `Swipeable` match, `FoodInfoCard.tsx`, is a carousel). `ListGroup` /
  `ListRow` already exist and Settings uses them.
- **Why it reads as web**: the "Everything's a Card" tell. A vertical ⋮ is an Android/web idiom and
  looks foreign on iOS. About 3 food rows fit where a native grouped list shows 5.
- **After**:
  - One grouped surface per meal section (`ListGroup`), rows separated by hairlines.
  - **Tap** opens details. **Swipe left** reveals Delete (and Edit where it exists).
    **Long-press** opens a context menu with the same actions the ⋮ had.
  - Where a visible "more" button remains, iOS shows a horizontal `…`, Android keeps ⋮.
  - Exercise pickers (Add exercise, Replace exercise) become grouped rows with a trailing check;
    selection state stays visible.
- **Accessibility**: swipe actions must also be reachable through `accessibilityActions`, because
  screen-reader users cannot discover a swipe.

### U6 — Home and Food are stacks of dashboard cards with duplicated content and competing actions

- **Evidence**:
  - **Home** (`app/app/index.tsx`): hero card, stat strip, two large tiles (Start workout / Track
    food), Weekly Review card, recent-food cards, a dashed "Add food" button, recent workouts.
  - **Food** (`app/app/nutrition/food.tsx`): the same hero card, the same Weekly Review card, and a
    2×2 grid of outlined buttons (Scan barcode, AI camera, My meals, More options), then the diary.
  - When a review is due, the Weekly Review card appears on Home, Food and Workouts.
  - Home offers four ways to log food: the camera button, the Track food tile, "Add food", and the
    recent-food rows.
- **Why it reads as web**: a bento dashboard. Native screens have one job and one primary action.
- **After**:
  - **Home**: today's status (hero card + stat strip), then one next action (home action tiles),
    then recent items as a grouped list. The dashed "Add food" button goes; recent foods already log
    with one tap and the camera button is always present.
  - **Weekly Review**: the full card only on Home. Food and Workouts show at most a one-line row or a
    badge on the existing entry point (the summary card's menu item on Food).
  - **Food**: the summary shrinks to a compact bar once the diary scrolls under it. The 2×2 button
    grid is replaced by the camera button plus an **Add** row at the end of each meal section; My
    meals and More options move into the header menu.
- **Constraint**: `AGENTS.md` documents the Weekly Review entry points and the home actions
  persistence chain; update those rules in the same change.

### U7 — Progress opens on number tiles, not a chart, and some figures undermine trust

- **Evidence** (`app/app/progress.tsx`): range pills (7D … ALL) scroll sideways and clip "ALL";
  "Weekly averages" is a single switch in its own card; the first screen is centred stat tiles and
  the weight trend starts below the fold; "Empirical TDEE 582" sits next to "Statistical TDEE 2598"
  with no explanation.
- **Why it reads as web**: an analytics page of tiles is a web-dashboard idiom; native health apps
  lead with the chart. The 582 is also a real usability problem — it reads as a bug.
- **After**:
  - Range is a full-width `SegmentedControl` (six segments fit at 390pt).
  - The weight-trend chart is first.
  - Average intake renders as a `StatStrip`; the averages switch becomes a row inside that section.
  - Empirical TDEE shows "Not enough data yet" (with how much more is needed) instead of a
    low-confidence number. Define the confidence threshold next to the existing empirical-TDEE
    calculation, not in the screen.

### U8 — Forms are built like web forms

- **Evidence**: `components/modals/LogMealModal.tsx` and
  `components/modals/AddUserMetricEntryModal.tsx` put a label above a bordered box for every field.
  Date and time are tall cards with an icon circle and a pencil, and open a full-screen custom time
  wheel (`components/modals/TimePickerModal.tsx`: "Select time / Confirm time / Clear selection").
  On Log meal, the meal-type choice — the main decision — is hidden under the floating "Log meal"
  button.
- **Why it reads as web**: native forms are grouped rows ("Date — Today ›") with the system picker.
- **After**:
  - Field order follows importance: on Log meal, meal type comes right after serving size, as a
    `SegmentedControl` or chip row.
  - Date and time collapse into one row ("Today, 3:20 PM ›").
  - Date and time use `@expo/ui`'s DateTimePicker (compact on iOS, Material dialog on Android).
    `TimePickerModal` stays as the web implementation.
  - The bottom primary button stays for thumb reach, but the scroll content is padded so the button
    never covers a field.

### U9 — Touches get almost no tactile or visual feedback

- **Evidence**: haptics fire only in `components/NavigationMenu.tsx` and the rest timer. Completing a
  set (`InlineSetRow.tsx`, the app's most frequent action), logging food, steppers, toggles and
  finishing a workout are silent. `android_ripple` is set in 4 files; cards and chips use an
  opacity fade, which looks wrong on Android.
- **Why it reads as web**: a web page cannot vibrate. Silent buttons feel like clicks in a browser.
- **After**:
  - One helper, `utils/haptics.ts`, with semantic calls: `selection()`, `success()`, `warning()`,
    `impact(light | medium)`. No-op on web.
  - Wired into the theme primitives so callers do not repeat it: `Button`, `Chip`, `IconButton`,
    `SegmentedControl`, `ToggleInput`, steppers (`StepperInput`, `NewNumericalInput`).
  - Wired into key moments: set completed (`success`), set reopened (`selection`), food logged
    (`success`), workout finished (`success`), destructive action confirmed (`warning`).
  - Rest-timer haptics keep their existing settings (`restTimerHaptics`, `restHapticStrength`) and
    are not changed.
  - Android ripple on `IconButton`, `Chip`, the `card` variant of `ListRow`, and pressable
    `GenericCard`s; iOS keeps the pressed tint/opacity.

### U10 — Navigation chrome uses web and cross-platform glyphs

- **Evidence**:
  - `ScreenHeader` and the modal shells use Lucide `ArrowLeft` (←) for back on both platforms; iOS
    uses a chevron.
  - The vertical ⋮ menu appears on iOS too.
  - Profile and Progress show a back arrow when reached from the bottom bar or the avatar.
  - The camera button is an oversized circle that sticks up out of the tab bar.
  - Small targets: the "+1 / +2 / +10" chips on Add entry are about 36pt; "See all" and "History"
    are bare text links.
- **After**:
  - One platform glyph map (`components/theme/platformGlyphs.ts`): back = `ChevronLeft` on iOS,
    `ArrowLeft` on Android; more = horizontal `Ellipsis` on iOS, `EllipsisVertical` on Android;
    close = `X` on both. Used by `ScreenHeader`, `FullScreenModal`, `BottomPopUp`, `IconButton`
    "more" uses and the list rows from U5.
  - Re-check the root/pushed header form for Profile and Progress against how they were reached.
  - The centre camera button stays (it is core to the product) but sits flush with the bar height,
    without the overhang.
  - Every interactive element reaches 44×44pt, by padding or `hitSlop`.

### U11 — Information is split across too many boxes, and some of it contradicts itself

Density is a real part of the problem, but not because the screens show too much. They show about as
much as a dedicated nutrition dashboard. The issue is that the space is spent on gaps and per-box
padding while some figures get far more room than they need.

- **Evidence** (captures `01-home`, `02-food`, `03-progress`, `04-profile`; numbers in the section 1
  density baseline):
  - About a quarter of Home, Food and Profile is empty gap between boxes (23%, 24%, 27%), before
    counting each box's own padding.
  - Home's first viewport has 8 separately bordered surfaces: hero card, stat strip, two action
    tiles, Weekly Review card, two recent foods, and the dashed "Add food" button.
  - Density is uneven. The hero card packs 12 small numbers ("P 132/180g ▬ 73%" × 4), while a
    recent-food row spends 66pt on three facts (name, weight, kcal) plus a generic placeholder icon
    when there is no photo. On Progress, "Weekly weight change −0.27" gets a whole card; on Profile,
    "Age 36" and "Gender Male" get ~96pt tiles each.
  - The main content starts late: on Food the first logged item sits about 55% of the way down; on
    Progress there is no chart in the first viewport.
  - **Home contradicts itself at a glance.** The hero card says "1200 Remaining" (against the goal)
    and the stat strip under it says "112 kcal Surplus" (eaten against energy burned so far). Both
    are correct, but they read as opposites.
- **Why it reads as web**: a stack of equal bordered cards is the web dashboard layout. NN/g's
  guidance on cards is that they are "less scannable than lists" and fit fewer items per screen, and
  that cards should not be "a modern-looking replacement for a list of content" — which is exactly
  the diary, Recent foods and the exercise pickers. NN/g also says screen space "should be spent,
  not hoarded" and that higher density means "less need to move around", with the limit that an
  overloaded screen overwhelms. Apple's list guidance groups related rows in one inset section
  rather than boxing each row.
- **After**:
  - **Merge related surfaces.** Rows of the same kind share one grouped surface (U5). Single-number
    cards (weekly weight change, age, gender) become rows or one `StatStrip`.
  - **Home stat strip shows only what the hero card does not**: Burned so far and Balance, with each
    label saying what it compares against (for example "vs burned so far"). It no longer repeats
    Eaten. This removes the remaining-vs-surplus contradiction without hiding either fact.
  - **Rows pay for what they show.** A food row without a photo has no placeholder icon, and puts the
    calories on the right. Target row height is about 52pt (from 66pt).
  - **Lead with the content.** Food shows its diary first (summary compacts on scroll, U6); Progress
    shows the weight-trend chart first (U7).
  - **Optional**: drop the four percentages from the hero card (12 numbers to 8). The bars already
    carry them. Needs a decision first; see open question 5.
- **Targets** (re-measured with the section 1 method): empty gap at or below 15% on Home, Food and
  Profile; at least 4 recent foods visible on Home's first viewport; the first logged food on Food
  starts above 40% of the screen height; a Progress chart in the first viewport.
- **Do not**: shrink touch targets below 44pt to gain space, reduce type below the current minimum, or
  remove any figure the user can see today without giving it another home (a row, a sheet, a tap).
  Density that serves the workout set table (section 3) is not part of this finding.

## 5. Phases and milestones

Phases are ordered by leverage: Phase 0 changes shell files that every screen inherits. Each
milestone is shippable on its own and leaves the app consistent.

### Phase 0 — Shells and feedback (U1, U3, U9, U10)

**M0 — Device spike (no product change)**

- Answer the U1 verification questions on a physical iOS and Android device: edge-swipe back under
  `fade`, Android back history across bottom-bar switches.
- Prototype `pageSheet` on one task modal (Log meal) inside a release build, including a nested
  modal and the keyboard, to de-risk Phase 2.
- Output: findings written into this file (section 8) and, where they are incidents or
  workarounds, `FIXES.md`.

**M1 — Transitions**

- Root `Stack` uses the platform default push; bottom-bar destinations switch with `fade`/`none`.
- Android back from a root destination behaves as decided in M0.
- Done when: every pushed route slides on both platforms and swipes back on iOS; bottom-bar
  switches do not.

**M2 — Haptics and ripple**

- `utils/haptics.ts` added and wired into the primitives and key moments listed in U9.
- Android ripple on the listed primitives.
- Done when: completing a set, logging food and finishing a workout each produce one haptic on a
  device; no haptic fires twice for one action; web is unaffected.

**M3 — Platform glyphs and targets**

- `platformGlyphs.ts` used by `ScreenHeader`, `FullScreenModal`, `BottomPopUp` and "more" buttons.
- Camera button flush with the bar; undersized targets fixed.
- Done when: no screen shows ← or ⋮ on iOS; every interactive element measures ≥ 44pt.

**M4 — Sheet gestures**

- `BottomPopUp` gets a handle, pan-to-dismiss, unsaved-input guard; action menus lose the ✕.
- Done when: every `BottomPopUp` can be dragged closed, scroll content inside sheets still scrolls,
  and a sheet with typed input asks before discarding.

### Phase 1 — Native confirmations and undo (U4)

**M5 — `confirm()` helper**

- One helper: native `Alert` on iOS/Android, `ConfirmationModal` on web. Supports title, message,
  cancel label, confirm label, `destructive`.
- **End workout** becomes an action sheet (`ActionSheetIOS` / `BottomPopUpMenu`).

**M6 — Migrate call sites**

- All 31 `ConfirmationModal` call sites go through `confirm()` or become undo (below).
- Reversible deletes (food log, note, metric entry, saved-for-later item) switch to
  delete-then-undo snackbar.
- The generic "Confirm Action / Are you sure…" copy is removed from all locales.
- Done when: no native screen renders `ConfirmationModal` directly; every confirmation has a
  specific title; deleting a food log can be undone from the snackbar.

### Phase 2 — Modals: sheets for tasks, routes for browsing (U2)

**M7 — Classification**

- Every `FullScreenModal` call site is tagged **task** or **browse** in a table in this file
  (section 9), reviewed before any migration.

**M8 — Task modals become page sheets**

- `FullScreenModal` gains a `kind: 'task' | 'browse'` prop (default `browse` until migrated).
  `task` on iOS = `pageSheet` + Cancel/commit header; on Android = full screen + ✕.
- Migrate task modals in order: Log meal, Add entry, Create custom food, Create meal, Add exercise,
  Create workout, then the rest.
- Done when: every task modal swipes down to dismiss on iOS, shows Cancel, and passes the presenter
  rules in `FIXES.md` on a release build.

**M9 — Browse modals become routes**

- Order: Exercises, Nutrition log, Past workouts history, Past workout detail, Body metrics history,
  Goals management.
- Each new route: `ScreenHeader` (outside `AreaLockGate` with the matching `lockArea` where the
  content is gated), listed in the Phase 8 header test, deep-linkable, existing modal entry points
  replaced with `router.push`.
- Done when: those screens push from the side, swipe back on iOS, and Android back returns to the
  caller with its scroll position intact.

### Phase 3 — Lists, not cards (U5)

**M10 — Swipeable grouped row**

- A `ListRow` variant (or a thin wrapper around it) with swipe actions (Gesture Handler
  `ReanimatedSwipeable`), long-press context menu, `accessibilityActions`, and the platform "more"
  glyph.

**M11 — Food diary**

- Each meal section is one `ListGroup`; rows use the swipe variant; ⋮ menus removed from rows.
- Done when: a meal with 5 items fits in the space 3 used to; delete and edit are reachable by
  swipe, long-press and screen reader.

**M12 — Remaining lists**

- Recent foods (Home), Nutrition log, Add exercise, Replace exercise, exercise library.

### Phase 4 — Screen by screen (U6, U7, U8, U11)

**M13 — Home**

- Remove the dashed "Add food" button; recent foods as a grouped list; Weekly Review full card on
  Home only.
- Stat strip shows Burned so far and Balance with labels that name their comparison; no Eaten.
- Food rows without a photo drop the placeholder icon; calories on the right.
- Done when: Home's first viewport shows status, one action row, and the start of recent items, with
  no duplicated entry point; at least 4 recent foods visible; empty gap at or below 15%; the
  remaining-vs-surplus pair no longer reads as a contradiction.

**M14 — Food**

- Compact summary bar on scroll; 2×2 grid replaced by per-meal **Add** rows; My meals / More
  options in the header menu; Weekly Review reduced to the existing menu entry.
- Done when: the first logged food starts above 40% of the screen height and the empty gap is at or
  below 15%.

**M15 — Progress**

- `SegmentedControl` for range; chart first; averages as `StatStrip`; empirical-TDEE confidence
  guard; the single-number "Weekly weight change" card merged into the strip.

**M16 — Forms**

- Log meal and Add entry reordered; combined date/time row; `@expo/ui` DateTimePicker on native;
  bottom padding so the primary button never covers a field.

**M17 — Profile**

- Weight, Body fat, Age and Gender become grouped rows or one `StatStrip` instead of four ~96pt
  tiles; smaller avatar block; Management stays a `ListGroup`.
- Done when: the empty gap is at or below 15% and every figure shown today is still shown.

**M18 — Density check and optional hero trim**

- Re-measure all four screens with the section 1 method in at least `kinetic-depth` and
  `kinetic-light`, record the numbers in section 8, and fix any screen above target.
- If open question 5 is answered yes, drop the hero card's four percentages and update
  `DESIGN.md` and the `DailySummaryCard` tests.
- Done when: every target in U11 is met, or the miss is recorded with a reason.

## 6. Requirements for every milestone

These come from `AGENTS.md` and apply to each milestone, not just the last one:

- **Tests**: behaviour changes get tests. Add an `Unsitefication` block to
  `components/__tests__/deslopGuards.test.ts` per phase, so the old pattern cannot return, e.g.:
  - Phase 0: the root stack does not set `animation: 'fade'` globally; `ScreenHeader` /
    `FullScreenModal` read the back glyph from `platformGlyphs.ts`.
  - Phase 1: no native file renders `ConfirmationModal` directly.
  - Phase 2: a ceiling on `FullScreenModal` call sites without a `kind`, lowered as files migrate.
  - Phase 3: no list row in the migrated screens renders a vertical-ellipsis menu.
  - Phase 4: the home stat strip does not render the Eaten figure the hero card already shows.
- **Checks**: `npx tsc --noEmit`, `npm run lint:eslint`, `npm run check-translations`,
  `npm run check-locale-consistency`, and the relevant Jest suites. (Avoid `npm run lint:all`: it
  stages files and dirties `app.json` / iOS.)
- **Translations**: new or changed copy (confirmation titles, Undo, Cancel/Add) lands in all five
  locales.
- **Docs in the same change**: `DESIGN.md` (Buttons, Cards and modals, Home, Inputs sections),
  `AGENTS.md` (Weekly Review entry points, modal rules), `FIXES.md` for any device-specific
  workaround found, `CURRENT_FEATURES.md` when a user-visible flow changes (swipe to delete, undo).
- **Screenshots**: re-run `npm run screenshots` and compare against the baseline captures.
- **Device check**: gestures, haptics, transitions and sheets cannot be judged from web screenshots.
  Each milestone is checked on a physical iOS and Android device; Phase 2 on a **release** build.
- **Themes**: verify in at least one dark (`kinetic-depth`) and one light (`kinetic-light`) theme.
- **Workout logging speed**: no milestone adds a tap to logging a set, starting a rest, or logging a
  recent food.

## 7. Risks

| Risk                                                                 | Mitigation                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pageSheet` conflicts with nested-modal presenter rules (`FIXES.md`) | M0 spike on a release build before M8; keep `kind` defaulting to the current behaviour |
| Pan-to-dismiss fights inner scroll views in sheets                   | Hand off only at scroll top; test long sheets (Replace exercise, Edit set details)     |
| Swipe actions are invisible to screen readers                        | `accessibilityActions` mirror every swipe and long-press action                        |
| `Alert` is a no-op on web                                            | `confirm()` falls back to `ConfirmationModal` on web                                   |
| Turning modals into routes breaks app-lock gating                    | New routes sit inside `AreaLockGate`; extend `appLockCoverage.test.ts`                 |
| Haptics feel excessive                                               | Only semantic moments, never on scroll or re-render; see open question 3               |
| Back-history changes surprise existing users                         | Decide in M0, pin with a test, note in the release's What's new if it is visible       |

## 8. Open questions and M0 findings

1. Does iOS edge-swipe back work under the global `fade` today? _(M0)_
2. What should Android back do from a non-Home bottom-bar destination — go to Home, or back through
   tab history? _(M0; recommendation: Home, then exit)_
3. Should there be one app-wide "Haptic feedback" setting, or do we rely on the system setting plus
   the existing rest-timer settings? _(recommendation: rely on system settings first, add a toggle
   only if users ask)_
4. Is `@expo/ui` DateTimePicker stable enough on SDK 58 for both platforms, or is
   `@react-native-community/datetimepicker` needed? Adding a dependency needs a separate decision.
5. Should the hero card drop the four macro percentages (12 numbers to 8)? The bars already show
   them, but some users may read the numbers. _(recommendation: yes; check with a few users first)_

## 9. Modal classification (filled in at M7)

| Component | Kind (task / browse) | Target | Milestone |
| --------- | -------------------- | ------ | --------- |
|           |                      |        |           |

## 10. Sources

- NN/g, [Cards: UI-Component Definition](https://www.nngroup.com/articles/cards-component/)
- NN/g, [Utilize Available Screen Space](https://www.nngroup.com/articles/utilize-available-screen-space/)
- NN/g, [Dashboards: Making Charts and Graphs Easier to Understand](https://www.nngroup.com/articles/dashboards-preattentive/)
- Apple HIG, [Lists and tables](https://developer-rno.apple.com/design/human-interface-guidelines/components/layout-and-organization/lists-and-tables)
