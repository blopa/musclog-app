# Musclog — Design System

The app uses a high-contrast performance aesthetic built from tinted surfaces, vivid actions,
restrained supporting color, and dense data displays. `theme.registry.js` is the theme catalogue;
`theme.tokens.js` and `theme.ts` derive the two runtime representations from it. This document
describes how to use them.

## Theme status

Five named palettes ship: Kinetic Depth is the dark emerald reference design, Kinetic Light is the
same structure re-picked for a bright ground, Kinetic Shock is a dark rose-led alternative, Kinetic
Volt pairs warm near-black surfaces with electric yellow accents, and Kinetic Blush is a bright pink
ground with a raspberry accent.
Users choose one of them, or System, under Settings → Interface → Appearance. System resolves to
Kinetic Light or Kinetic Depth from the device's light/dark setting. The preference is stored in the
settings table, so writing that row re-themes the app.

Both halves of the styling system follow that choice:

- React components read dynamic tokens through `useTheme()` or `useThemeContext()`.
- NativeWind `className` colors resolve to CSS custom properties. `ThemeProvider` publishes the
  selected named palette's variable set on its root View (and on `:root` for web portals), while
  NativeWind's binary color scheme remains responsible only for `dark:` variants. The light/dark
  defaults in `tailwind.config.js` cover pre-provider rendering.

Avoid direct imports of `theme` in interactive components; the local ESLint rule enforces the
preferred access pattern.

### Surfaces that do not follow the theme

Some surfaces are not the app's background: a camera viewfinder, a photo, or a scrim over either.
Their content is white-on-dark whatever the user picked, so the camera surface pins Kinetic Depth
with `ThemeScope` from `context/ThemeContext.tsx`. A scope changes the context value and NativeWind
variables together; do not add a second forced-theme context or hand-pick a parallel set of tokens.
Components outside the viewfinder keep following the user's selected theme.

Text drawn on a colorful gradient uses the dedicated `colorfulCard` ink tokens, never a literal
white or the regular on-surface ink.

The Daily Summary card always renders the `colorful-gradient` background; a theme says how that
should read through `gradients.colorfulCard` alone. The three dark palettes and Kinetic Blush keep a
saturated sweep; Kinetic Light collapses its stops to the flat card surface, which renders exactly
like an ordinary card (`gradients.landingBackground` uses the same flat-gradient idiom). The component must not derive this presentation decision from `themeMode`; another
light theme may legitimately choose a gradient — Kinetic Blush does. Its foreground uses the matching
`colorfulCard` ink tokens: white in Kinetic Depth and Kinetic Shock, warm black in Kinetic Volt, and opaque deep
green-slate in Kinetic Light.

### Role tokens

A few primaries keep their job across themes instead of their lightness, and reading them by name is
what keeps a theme switch from inverting something that should not move:

| Token                                      | Job                                                  |
| ------------------------------------------ | ---------------------------------------------------- |
| `text.onAccent` / `inkOnAccent`            | Ink printed on a solid brand or status fill          |
| `shadow` / `scrimBase`                     | Backdrops, camera scrims, drop shadows — dark always |
| `background.alwaysWhite`                   | Fixed-white fills: slider and switch thumbs          |
| `text.alwaysWhite`, `overlay.alwaysWhite*` | Ink over a photo, camera preview or brand gradient   |
| `background.separatorLight`                | Image placeholder and separator fill                 |

The `ink` Tailwind color is the on-surface ink at an alpha — `border-ink/10`, `bg-ink/5`. Use it for
hairlines and washes instead of a literal `border-white/10`, which only reads on a dark ground.

## Color

The primary palette is 23 colors plus a short tail of role primaries, defined once per theme in
`THEME_DEFINITIONS` (`theme.registry.js`) and grouped by role rather than by hue name: six surfaces,
three text steps, six brand colors, and eight status hues. The registry also owns each theme's mode
and component-level presentation choices. Everything else — the semantic token tree, Tailwind
colors, CSS variables, runtime theme map, and `ThemeId` union — is derived from that catalogue, so
adding a theme cannot silently omit one styling path. Anything softer than a primary is derived too:
`addOpacityToHex` for translucent washes, `mixHex` for opaque tinted surfaces. A new hex value in a
palette should be rare and deliberate.

### Core surfaces

Surfaces form a four-step tonal ladder plus two tinted branches. Each step of the ladder is at least
1.09x contrast from the one below it, which is the point at which a layer edge is actually visible
without a border. The ladder inverts between themes: elevation moves _away_ from the base, which is
lighter on dark and darker on light.

| Role           | Token                                       | Kinetic Depth | Kinetic Light | Kinetic Shock | Kinetic Volt | Kinetic Blush |
| -------------- | ------------------------------------------- | ------------- | ------------- | ------------- | ------------ | ------------- |
| App background | `background.primary` / `surfaceBase`        | `#091310`     | `#fafcfb`     | `#160b14`     | `#151208`    | `#fff7fa`     |
| Card           | `background.card` / `surfaceCard`           | `#131d18`     | `#eef2f0`     | `#21101e`     | `#201b0c`    | `#fbe9f1`     |
| Elevated card  | `background.cardElevated` / `surfaceRaised` | `#1b2721`     | `#e0e7e3`     | `#2d1829`     | `#2c2510`    | `#f2d6e3`     |
| Tinted overlay | `background.overlay` / `surfaceTint`        | `#0c2419`     | `#dff0e7`     | `#351226`     | `#30270a`    | `#fadeeb`     |
| Accent surface | `border.accent` / `surfaceAccent`           | `#1c3829`     | `#c6e6d4`     | `#51203f`     | `#4a3b08`    | `#eec0d6`     |
| Hairline       | `border.dashed` / `borderHairline`          | `#2c3a32`     | `#c2cfc8`     | `#503248`     | `#4a4126`    | `#d9b3c5`     |
| Primary text   | `text.primary` / `textPrimary`              | `#dce5de`     | `#0f1a16`     | `#f5e4ef`     | `#f6f0d5`    | `#2b101d`     |
| Primary action | `accent.primary` / `brandPrimary`           | `#29a577`     | `#0e7a54`     | `#e85d9e`     | `#f5c842`    | `#c2185b`     |

Accents get _darker_ on light, not lighter: every brand and status hue in the light palette clears
4.5:1 as text on `surfaceBase` and `surfaceCard`, and carries white ink at 4.5:1 or better when it is
used as a solid fill. Copying a dark-theme accent into the light palette is the mistake that makes an
emerald button vanish.

Use semantic theme paths rather than copying these hex values. Raw values are listed only to make
the visual direction explicit.

### Naming

A semantic key names the **role** it resolves to, never a hue. With one palette `status.emerald`
was harmless; with five it was a lie — the same key is emerald on Kinetic Depth and pink on Kinetic
Shock. So the tree reads `status.brandVivid`, `text.tertiary`, `background.scrim30`,
`overlay.ink70`, and a key like `status.teal400` or `background.gray800` should not come back. The
one exception is `avatar.*` / `avatarBg.*`, which are keyed by the persisted `AvatarColor` enum
rather than by palette role.

The rules live in `theme.audit.js`, once. It fails if a hue-named token swings more than 40 degrees
of hue between themes — exactly how `status.emerald` went wrong — and it enforces the color rules
below. `npm run check-palette` prints the report and
`utils/__tests__/themeSelection.test.ts` asserts the same function in CI, so the report and the gate
cannot drift apart.

### Text contrast

The three text steps all clear WCAG AA on every surface that carries body copy — `background.primary`,
`.card`, `.cardElevated` and `.overlay` — in all themes: `text.primary` at 10:1 or better,
`text.secondary` at 5.8:1, and `text.tertiary` at 4.6:1. `text.tertiary` is the floor — do not
introduce a dimmer neutral for label or caption text.

The accent surface is the exception. It is the lightest and most saturated step of the dark ladder,
built for borders and image wells, and on Kinetic Depth `text.tertiary` lands at 3.82:1 on it.
Neither value can move: lifting `text.tertiary` to clear it pushes tertiary to 6.17:1 on the card,
collapsing it into `text.secondary`, and darkening the surface drops its seam against
`background.cardElevated` to 1.03x, which is invisible. **So the accent surface takes `text.primary`
or `text.secondary` ink only** — both clear 4.5:1 on it in every theme.

A handful of saturated accents (`accent.tertiary`, `status.indigo`, `rose.brand`) sit between 3:1
and 4.5:1 on the darker surfaces. They are fine for icons, chart series, borders and large type,
which need 3:1, but should not be used for body copy.

### Functional color

- The active palette's brand hue (emerald, pink, or yellow): primary actions, completion, positive progress.
- Red/rose: destructive actions and errors.
- Amber/orange: warnings, energy, and attention without failure semantics.
- Blue/teal: information, hydration, and secondary data.
- Indigo/violet: supporting series, recovery, and AI accents.

Macro colors must remain stable across cards and charts:

- Protein: indigo.
- Digestible carbs: the palette's brand hue.
- Fat: amber.
- Fiber: pink.

Do not rely on color alone for status. Pair it with a label, icon, pattern, or value, and maintain at
least WCAG AA contrast for normal text.

## Typography

App headings and display text use solid `text.primary` ink across all themes, including Workouts,
Notes, Health Connect onboarding, workout summaries, and rest-complete messages. Do not use
gradient-filled glyphs.

The app currently relies mainly on platform/system fonts; do not document an unbundled typeface as
part of the brand. The token scale is:

| Token       |  Size | Typical use                       |
| ----------- | ----: | --------------------------------- |
| `xxs`       |    10 | Badges and dense chart labels     |
| `xs`        |    12 | Captions and metadata             |
| `sm`        |    14 | Supporting text and controls      |
| `base`      |    16 | Body text and inputs              |
| `lg`–`xl`   | 18–20 | Section headings                  |
| `2xl`–`5xl` | 24–48 | Screen headings and primary stats |
| `6xl`–`8xl` | 60–96 | Rare hero values                  |

Use large numeric type for the one value a card is meant to communicate. Preserve readable labels
and units; a large number without context is not a useful hierarchy.

## Spacing, shape, and touch

Spacing follows a 4-point base scale: 4, 8, 12, 16, 20, 24, 32, and 48. Use
`theme.spacing.padding`, `.gap`, and `.margin` instead of introducing near-duplicate literals.

Onboarding content uses a 24-point horizontal inset (`px-6`). In cycle setup, keep the
horizontal inset and top padding on an inner `View` inside `KeyboardAwareScrollView`,
so the heading and every form section align with the bottom action button on web and native.
The shared cycle setup form leaves 12 points (`mt-3`) between the unknown-cycle-length
option and the cycle/period numeric inputs.

Standard radii are 12 for inputs/general controls, 16 for primary cards, and `full` for circular or
pill elements. Borders should be subtle; surface separation should usually come from tonal layering
before outlines or heavy shadows.

Interactive mobile controls need an effective target of at least 44×44 points, preferably 48×48.
Expand targets with internal padding. On iOS, negative margins and out-of-bounds `hitSlop` can be
clipped by the parent; see `FIXES.md`.

## Components

### Buttons

- Primary: emerald or the approved emerald-to-teal gradient, with high-contrast text. The
  `gradientCta` button variant draws `gradients.cta`, which is that emerald-to-teal gradient (the
  same stops as `gradients.accent`); it was indigo-to-green, which this rule does not allow.
  Both gradients keep `text.onAccent` at least 4.5:1 across their sweep: the token generator
  blends an unsafe deep stop towards the vivid stop. Every full-width segmented control variant
  marks its selected segment with this same gradient and `text.onAccent` (the `pill` with the flat
  accent and the same ink), and `text.secondary` for unselected options. A segment icon that
  changes colour uses the render-function form, `(selected) => …`, with those two inks — a static
  accent icon vanishes on the selected fill.
- One primary action per screen. When a screen has a hero (the Workouts screen's Today card), the
  cards below it use their standard, secondary treatment rather than a second filled button.
- Secondary: low-emphasis surface or outline treatment.
- Destructive: red/rose and explicit action copy.
- Cycle period actions ("My period started" / "ended") use `Button`'s `rose` / `roseOutline`
  variants: the brand rose without `discard`'s destructive meaning. They were hand-rolled
  `TouchableOpacity`s before.
- Disabled: visually subdued and non-interactive; never communicate disabled state by opacity alone
  when the label would become unreadable.

Use the shared components under `components/theme/` before adding a local button or input style.
Every pressable should cover its visible surface and provide feedback through state, haptics where
appropriate, or both. Pick by what the control is, not by how it looks today:

| Control                                                                 | Component                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Labeled action (primary, secondary, outline, destructive)               | `Button`                                                                   |
| Text-only secondary action ("Show all", "Edit goal", a quiet "Discard") | `TextButton` (`tone`: `accent` / `danger` / `muted`)                       |
| Icon-only action (steppers, prev/next, back, more, remove ×)            | `IconButton` (`filled` / `elevated` / `ghost`; `media` over a photo)       |
| One choice among several, or a compact action pill                      | `Chip` (`outline` for choices, `solid` for actions and the weekday picker) |
| A row that opens something (history entry, sheet action, rule summary)  | `ListRow` (`card` / `filled`)                                              |
| Two to five mutually exclusive options shown side by side               | `SegmentedControl` — one form per screen (see below)                       |
| A number the user types, kept as their own text                         | `NumericTextField` (`hero` / `field` / `cell`)                             |
| A number the control owns (portion, plate weight)                       | `StepperInput` / `StepperInlineInput`                                      |
| A search box or any labeled text field                                  | `TextInput` (`label=""` + a `Search` icon for search); never a raw input   |

**`SegmentedControl`: full width or `pill`, never both on one screen.** The full-width variants
(`elevated`, `outline`, `gradient` differ only in their track) are for a choice that switches what
a screen shows or is the main field of a form or sheet. `pill` is for a choice that sits inline
beside other content (the workout session's view toggle), where it hugs its options, or a
secondary preference in a list of settings (every choice in the notification settings), where it
takes `fullWidth` so it lines up with the cards and toggles around it — a hugging pill there
leaves a ragged right edge. The notification settings once mixed four
pills with one full-width control, which looked like a view switcher and made the same kind of
choice read as two different controls. Every variant is a `radiogroup` of `radio`s for screen
readers.

A raw `Pressable` is right only for a composite surface that is itself the control — a card, a table
cell (the set table's number, previous and check cells), a thumbnail, a radio card that hosts its own
fields (`ProgressionRuleEditor`), a row whose whole surface toggles a panel (`RestTimerBar`,
`GuidanceSummary`) — never for something one of these already draws. `components/__tests__/themeControls.test.ts`
lists the screens that have been moved onto them.

Radio controls (`OptionsSelector` and `Chip`) expose `aria-checked` explicitly as well as native
accessibility state; React Native Web does not translate `accessibilityState.checked` by itself.
Switches need an accessible label. The shared `WeekdayChoiceChips` uses abbreviated day labels
visually and full weekday names for assistive technology.

### Cards and modals

Cards should have one job: a concise heading, one primary value or action, and supporting detail.
Avoid stacking several unrelated dashboards into one surface.

`components/cards/GenericCard.tsx` has exactly two surface styles, plus one documented brand
exception — see `components/cards/cardSurface.ts` for the resolver and
`components/cards/__tests__/cardSurface.test.ts` for the contract it's held to:

- **`flat`** (default) — `background.card` + an `ink/5` hairline, no shadow. Use for almost every
  card: lists, stats, settings rows.
- **`raised`** — `background.cardElevated` + the same hairline + `shadows.md`. Reserve for the one
  emphasis/hero card on a screen. It is illegal inside `BottomPopUp` or `CenteredModal` — their
  sheet surface is already `cardElevated`, so a raised card disappears into it, and Android
  elevation can leak through a `SurfaceColorProvider` fade (see `AGENTS.md`).
- **`hero`** — the `colorfulCard` gradient fill. Reserved for `DailySummaryCard`; do not add a
  second consumer without updating this section.

One radius throughout: `theme.borderRadius.lg` (16), the same value as Tailwind's `rounded-2xl`.
Do not introduce a third style, a per-card radius, or a gradient card fill outside `hero` — a
`GenericCard` call covers the case, and a hand-rolled surface should be migrated to it rather than
copied.

A row of small figures read side by side — today's energy under the home card, the weekly-average
macros inside it — is always `components/StatStrip.tsx`: hairline-divided cells, the number first
and its uppercase label under it. The component reads no theme of its own; the caller passes a
`StatStripPalette` so the same row works on a plain card and on the hero gradient. Do not draw a
second variant of this row.

On the hero gradient that palette's fill is `colorfulCard.panel`, the one translucent surface that
sits on the gradient itself. It washes away from the card's ink — towards the scrim under light
ink, towards white under dark ink — so an inset panel can never read worse than the bare card
underneath it. Do not substitute a fixed scrim: `background.scrim30` darkened the four dark-ink
themes into a grey slab and dropped their supporting ink under AA.

Use the existing `FullScreenModal`, `CenteredModal`, `BottomPopUp`, and platform variants. A modal
that opens another modal must follow the presenter rules in `FIXES.md`; visual nesting and React
tree ownership are separate concerns. Modal headers sit on the modal's own surface — none of the
shared shells route a header through a gradient; a purple-to-transparent wash was a copy-pasted
pattern across eight files and added nothing over the surface color.

### Inputs

- Numeric controls use the shared steppers/pickers and locale-aware parsing.
- A centered input never gets a native `placeholder`: on Android it put the caret at the far edge
  of an empty field on first focus. `NumericTextField` draws its placeholder as an overlay and hides
  it while focused; reuse it rather than re-centering a raw `TextInput`.
- Store metric values and convert only at the display/input boundary.
- Keep units next to values and use the unit helpers; never hardcode `kg`, `lb`, `g`, or `oz`.
- Error text should explain how to recover, not just state that input is invalid.

## Data visualization

- Use the same macro colors everywhere.
- Show raw measurements and the smoothed trend when both matter; distinguish them by weight,
  opacity, point treatment, and labels rather than color alone.
- A chart needs a concise title, unit, time range, empty state, and accessible summary.
- Avoid false precision. Confidence or uncertainty should be visible for modeled values.
- Prefer one headline chart with drill-down over a wall of equally weighted graphs.

## Product tone

- Performance-oriented without gender stereotypes or bodybuilding clichés.
- Direct and calm. Avoid guilt, punishment, and alarmist red states for ordinary target variance.
- Explain AI estimates and calculated health metrics at the point of use.
- Keep core logging fast and usable offline; optional AI should not block a manual path.
- Menstrual-cycle guidance is context, not instruction. The app never prescribes training from a cycle phase (the evidence does not support universal rules); it reports observations from the person's own records, always with how many cycles they rest on and the days behind them.
- A modeled value shows its uncertainty (a range and a confidence line), and a logged fact is never drawn the same way as an estimate.
- Cycle calendars never rely on color alone: each kind of mark has its own shape (filled, outlined, dashed, bar, dot), a word in the legend, and a spoken description per day.

## Website

The public website is a normal React web UI using HTML elements and Tailwind classes. It shares the
brand palette but not the mobile component primitives. Use semantic elements, visible keyboard focus,
responsive content width, and plain `<a href>` links for website navigation unless a documented
router exception applies.

Narrow viewports get the primary navigation from the header's burger menu, not from a duplicated set
of links in the footer. The footer is for secondary and legal links only. A new primary destination
belongs in both the desktop nav bar and the burger menu.

## Review checklist

- Uses semantic tokens and existing shared components.
- Works at narrow and wide widths and with large text.
- Primary actions clear gesture-navigation, safe-area, and keyboard insets.
- Touch targets remain inside parent bounds.
- Status remains understandable without color.
- Numbers parse and format correctly in both comma- and period-decimal locales.
- Works in all themes: check Kinetic Light, Kinetic Shock, Kinetic Volt and Kinetic Blush, and confirm nothing
  relies on a literal `text-white` or an emerald-only accent.
- Loading, empty, error, disabled, and offline states are designed—not left to defaults.

## Everyday progression and Weekly Review

Keep plan, targets, previous performance, editable actual values, source labels, explanation and undo together. Inline cards and Guided presentation use the same controller; switching changes presentation only. Completing a set saves immediately, while effort/partials live in an optional sheet. Keep the rest timer visible during editing and browsing. Finish Workout is explicit even when every set is resolved. Keep Guidance, Warm-up, Swap, Notes and More labeled. Lasting changes use the explicitly labeled workout editor.

The session follows a set table, not a form. **Inline**: one card per exercise — thumbnail, name, muscle · equipment, a done/total pill — then the guidance block (badge, method, one-sentence reason, "Why?", "Use the plan's"), labeled action chips in one horizontal scrolling row, and rows of `Set · Last time · weight · reps · ✓` sharing one set of column widths with their header. Below 400 effective points (viewport width divided by font scale), show Last time as a labeled full-width line beneath each row; never truncate the previous load and reps. Set numbers count within the exercise; a warm-up is a "W". A numeric value the app calculated is accent-tinted **and** underlined until the user types over it. **Guided**: the exercise photo as a hero under a gradient, the name at 4xl, a "Set 2 of 3" pill, two large stepper fields (direct entry plus −/+ by the load step), and one gradient "Complete set"; context cards (fueling, cycle) follow the set instead of pushing it down. Both views share `SessionTopBar` (back, title, elapsed time and progress, a two-option view toggle on its own row under the progress bar) and the pinned `RestTimerBar`, which expands to a large panel automatically in Guided and on tap in Inline. Content is capped at 720 px so tablets keep the table legible. Session feedback is an optional action on the summary, with ratings and notes retained in the form when saving fails.

"Why?" is a sheet, not a stack of buttons: method and reason first, then a small inputs table (rule, plan, last time, today), then action rows with icons and one-line hints (Use the plan's, Plate calculator, Edit gym, Edit workout and rules; Edit target only when the equipment cannot build the load). The rule editor is the same pattern: radio cards that each explain their method in a sentence, with the chosen card expanding to its settings. An exercise row in the workout editor names its rule and opens that sheet on tap.

Home shows a compact permanent Weekly Review card below actions, with active-workout Resume more prominent. Workouts begins with Today before the library: an in-progress workout is an accent card with a progress bar, a gradient Resume and a small destructive Discard link — never the other way round; otherwise today's workout with "Preview and start", gym and starting-target chips, and workouts already trained today shown as done. Food shows the review card while a review is due and otherwise the "Weekly targets · since …" line, which is itself the way in. Preserve the default navigation slots; the optional checkin slot retains its key and carries a due indicator.

Weekly Review leads with the week and a Training / Nutrition progress pair, then the two sections. Training: a `StatStrip` (workouts, working sets, volume in the user's unit), the week's workouts, records as trophy rows, and "Next up" with preview and editor actions; upcoming targets are collapsed by default. Nutrition: a `StatStrip` of the evidence (trend weight, food days, weigh-ins), a Current / Recommended table with signed deltas, the reason, then one gradient "Apply targets starting tomorrow" over "Keep current" and "Edit". Missing evidence makes "Keep targets while collecting data" the primary action with shortcuts to log. Review day and reminder live in a settings card below, history last. Opening or canceling a sheet never acknowledges a review. Training acknowledgement never gates progression. Respect themes, exercise units, local decimal separators, safe areas and keyboard clearance.

### Cycle journal completion

- Keep daily logging first; optional presets add fields progressively and preserve existing favorites. Daily-life impact uses labelled choices, and missing observations remain distinct from explicit zero/none.
- Unknown cycle length never displays a fallback denominator or a precise date as personal knowledge. Historical prediction ranges and retrospective checks state that they are heuristic, not medical validation.
- Trends are available without bleeding dates. Plots use separate recorded points rather than joining missing days; the accompanying dated values are accessible and editable. Search stays on-device and says that all words must match.
- Pregnancy/loss/surgery/menopause contexts use quiet, neutral wording and retain history. Educational links name NHS/RCOG and identify English content; avoid diagnostic conclusions and phase-based prescriptions.
- Restore is available before setup. Import mapping previews before any write, rejects ambiguity, and keeps the user's selected column names on error. Sharing starts with no fields selected and clearly describes a readable, non-revocable static file.
- Health imports show source alongside values and never masquerade as manual logs. Health exports explain the receiving store and the explicitly omitted sensitive fields before confirmation.
- Backups are manual: explain the encryption-password recovery requirement, last-prepared status and the need to save the file outside the app. Optional reminders never create or upload backups.

## Home screen widgets

Nutrition Progress shows the data date, consumed/target calories, and protein, digestible-carbohydrate,
and fat progress. Bars are bounded to 0–100%; missing goals never appear as fabricated zero targets.
Android retains the compact 4×1 nutrition and 1×1 camera sizes. iOS supports small/medium nutrition
and a small camera widget. Colors and translated copy are supplied from the app’s selected palette
and language, respecting iOS tinting. Empty/initial widgets invite opening Musclog; cached values
retain their date, and the iOS midnight timeline replaces expired values with a refresh prompt.
Widget timelines and foreground refresh are subject to the operating system’s rendering schedule.
