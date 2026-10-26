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
should read through `gradients.colorfulCard` alone. The ramp is single-hue: `brandDeep` → `brandPrimary`
→ `brandVivid`, each mixed with `surfaceCard` by the theme's `colorfulCardBlend`, so every theme's
hero belongs to its own palette. It used to start on `statusIndigo`, which opened Home with the same
periwinkle sweep in every theme, orange Varia included; `utils/__tests__/dailySummaryCardTheme.test.ts`
now fails if a stop drifts more than 25° of hue from the theme's accent. The dark palettes and
Kinetic Blush keep a saturated sweep; Kinetic Light collapses its stops to the flat card surface,
which renders exactly like an ordinary card. The component must not derive this presentation decision from `themeMode`; another
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

The app uses the platform's system font. It was weighed against a display or monospaced face for
the numbers and rejected: tabular figures (below) give the system font the alignment a monospace
would, without bundling a font or a second voice. The token scale is:

| Token       |  Size | Typical use                                                         |
| ----------- | ----: | ------------------------------------------------------------------- |
| `xxs`       |    10 | Badges and dense chart labels; the floor, nothing smaller           |
| `xs`        |    12 | Captions, metadata, stat labels                                     |
| `sm`        |    14 | Supporting text, controls, chip and button labels                   |
| `base`      |    16 | Body text, inputs, list-row and card titles                         |
| `lg`        |    18 | Section headings, pushed-screen and modal titles                    |
| `xl`        |    20 | The title of a record (a food, a past workout)                      |
| `2xl`–`4xl` | 24–36 | Root-screen titles (`2xl`) and the one figure a card exists to show |
| `5xl`+      |   48+ | Only the hero number of a dedicated input or timer                  |

**Roles, not sizes.** A page title is `text-2xl font-bold` (root) or `text-lg font-semibold`
(pushed, and every modal shell's title). A section heading inside a screen or modal is
`text-lg font-semibold` — the old `text-2xl font-bold` section heading competed with the page
title. A card or list-row title is `text-base`, semibold on a card and medium in a grouped list.

**The weight ladder stops at bold.** 400 for body, 500 for labels, list rows and unselected
options, 600 for titles, buttons and emphasis, 700 only for page titles and display figures.
`font-black`/`font-extrabold` (800/900) are gone, and text at `xs`–`base` is at most semibold — a
row of bold 12pt microtext was the densest source of visual noise. **No negative tracking**:
`tracking-tight(er)` and `letterSpacing.tight` squeezed every large number and title, which reads as
a template; the system font is already spaced for its size. `deslopGuards.test.ts` (Phase 10) holds
all three at zero.

**Numbers are tabular** (`tabular-nums`, or `fontVariant: ['tabular-nums']` in a style) wherever
they line up or change in place: stat strips, the set table, macro rows, card figures and every
clock. A countdown in proportional figures shifts sideways every second; the rest and work timers
are guarded.

**Labels are sentence case.** A small heading above a group of content is `SectionLabel`
(`text-sm font-semibold text-text-secondary`, optional `tone="accent"` for the one live-state label
on a screen, optional icon). Tracked all-caps is reserved for unit and weekday abbreviations;
everything else — eyebrows, column headers, badges, button labels, menu titles — is sentence case
with no letter-spacing, in the copy as well as the classes (`"DATA PORTABILITY"` is now
`"Data portability"`). Units are lowercase: `kcal`, not `Kcal` or `KCAL`. Sentence-case labels are
wider than tracked caps in Russian and Dutch, so let them wrap rather than truncate.
`deslopGuards.test.ts` holds `uppercase`, wide `tracking-*` and all-caps en-us copy at zero.

Use large numeric type for the one value a card is meant to communicate. Preserve readable labels
and units; a large number without context is not a useful hierarchy.

## Spacing, shape, and touch

Spacing follows a 4-point base scale: 4, 8, 12, 16, 20, 24, 32, and 48. Use
`theme.spacing.padding`, `.gap`, and `.margin` instead of introducing near-duplicate literals.
Screens are compact: a 16pt side inset, 16pt between the blocks of a screen, 24pt before a new
section, 8pt between a section heading and its content, 8pt between controls in a row.

Onboarding content uses a 24-point horizontal inset (`px-6`). In cycle setup, keep the
horizontal inset and top padding on an inner `View` inside `KeyboardAwareScrollView`,
so the heading and every form section align with the bottom action button on web and native.
The shared cycle setup form leaves 12 points (`mt-3`) between the unknown-cycle-length
option and the cycle/period numeric inputs.

**Radii are named by role**, once, in `theme.shape.js`, which both `tailwind.config.js` and
`theme.ts` read:

| Role      | px  | Class             | For                                                                |
| --------- | --- | ----------------- | ------------------------------------------------------------------ |
| `tag`     | 4   | `rounded-tag`     | Status badges ("Ready to review", "Set 2 of 3"), skeleton bars     |
| `inner`   | 6   | `rounded-inner`   | Something inset a few points inside a control (keeps curves equal) |
| `control` | 8   | `rounded-control` | Buttons, inputs, chips, filter tabs, list rows, tiles, icon wells  |
| `card`    | 12  | `rounded-card`    | Cards, list groups, dialogs, callouts and info panels              |
| `sheet`   | 16  | `rounded-t-sheet` | The top corners of a bottom sheet                                  |
| `full`    | —   | `rounded-full`    | Circles only: avatars, dots, round FABs, thin progress tracks      |

They are pixels on purpose. Tailwind's size-named radii are rem-based and NativeWind resolves `rem`
to 14 on native and 16 on web, so `rounded-2xl` used to be 14 on a phone and 16 in a browser. App
code uses only the role classes (`deslopGuards.test.ts`, Phase 10); the size names remain for the
website. In a style object read `theme.borderRadius.control`/`.card`/…; the old size keys
(`md`, `lg`, …) are aliases onto the roles for existing call sites. A pill — `rounded-full` on
something with text in it — is not part of the language: chips, segments and badges are
rectangles with restrained corners.

Borders are 1pt hairlines (`border-ink/10`, `background.ink5` on cards); surfaces separate by tonal
layering before outlines, and outlines before shadows. A shadow is for something that floats over
content (the snackbar, text over the camera), never for a card, button or segmented track.

Interactive mobile controls need an effective target of at least 44×44 points, preferably 48×48.
Dense controls may draw smaller and pad their hit area with `hitSlop` (`Chip` and filter tabs draw
36pt, `IconButton sm` 36pt, a segment 40pt, each padded to 44–48). Expand targets with internal
padding or `hitSlop`; on iOS, negative margins and out-of-bounds `hitSlop` can be clipped by the
parent; see `FIXES.md`.

## Components

### Buttons

- Primary: a flat `accent.primary` fill (`variant="accent"`, the default) with `text.onAccent`.
  `gradientCta` still marks the ONE primary action of a screen (a screen that would show two
  demotes the second to `accent`), but it is drawn flat like `accent`: every button is flat, so
  hierarchy comes from fill versus outline, not from a gradient. `gradients.cta` stays in the
  palette for the later colour work and is read by no component. Buttons carry no shadow or glow,
  and their labels are never letter-spaced (tracking made "Scan Barcode" wrap).
- Sizes are fixed heights from one table, `components/theme/buttonMetrics.ts`, which `Button.tsx`
  and `Button.web.tsx` both read (they used to carry two copies that had drifted): `xs` 36 (dense
  rows only), `sm` 44, `md` 48, `lg` 52, `xl` 56, all semibold on the control radius. Outline,
  dashed and secondary buttons draw a 1pt border. The web button's label is a react-native-web
  `Text`, because a `<button>` does not inherit the page font. Selected options in a list signal selection with the 2px accent border and a check, not a
  halo. Every segmented control variant marks its selected segment with a solid `accent.primary`
  fill and `text.onAccent`, and `text.secondary` for unselected options. A segment icon that changes colour uses the
  render-function form, `(selected) => …`, with those two inks — a static accent icon vanishes on
  the selected fill.
- Every button is on the control radius (8); see the radius table under Spacing, shape, and touch.
  Android buttons show a ripple bounded to the button.
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
| A row that opens something (history entry, sheet action, rule summary)  | `ListRow` (`card` / `filled`; `grouped` inside a `ListGroup`)              |
| A list of settings, menu items or destinations                          | `ListGroup` of `ListRow variant="grouped"` (or `SettingsCard` rows)        |
| A small heading above a group of content                                | `SectionLabel`                                                             |
| A screen's title, back button and header actions                        | `ScreenHeader` (see Screen headers)                                        |
| Two to five mutually exclusive options shown side by side               | `SegmentedControl` — one form per screen (see below)                       |
| A number the user types, kept as their own text                         | `NumericTextField` (`hero` / `field` / `cell`)                             |
| A number the control owns (portion, plate weight)                       | `StepperInput` / `StepperInlineInput`                                      |
| A search box or any labeled text field                                  | `TextInput` (`label=""` + a `Search` icon for search); never a raw input   |

**`SegmentedControl`: full width or `pill`, never both on one screen.** (`pill` names the compact form; it is drawn on the control radius like the full-width track, not as a capsule.) The full-width variants
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

**Lists are grouped, not a card per row.** `ListGroup` is one `card`-radius (12) surface holding rows
separated by hairlines, with an optional `SectionLabel` title above and footer text below; the rows
draw no surface of their own. A row's icon is naked (20px, `text.secondary`): no tinted square or
circle behind it, and no per-row color — the rainbow of chips the menus used to carry encoded
nothing. The icon turns `accent.primary` only on the picked choice of a picker (`selected`), and
`status.error` on a destructive row, which also moves to the end of the list. **A chevron means the
row pushes a screen or opens a sheet with more choices** (`showChevron` on a `BottomPopUpMenu`
item); a row that acts immediately (Delete, Duplicate, Share) has none, and a picker row shows a
check on its current choice instead. A row that shows its current value ("Unrated") passes it as
`ListRow`'s `value`, which sits before the chevron; `trailing` replaces the chevron, and a value in
its place reads as a label (the workout's "Effort and details" row did exactly that). `BottomPopUpMenu` renders its items this way, `SettingsCard`
is a row (stack it inside a `ListGroup`), and Settings, the Profile management list, the account
menu and the Add Food tracking methods all use it. A menu item's `iconBgColor` is typed `never`, so
a leftover tint fails the build. A list that IS the sheet or menu (`BottomPopUpMenu`, the
account menu) is `ListGroup flush`: no surface of its own, rows bleed through the sheet's 24pt
padding so the press highlight spans the sheet, and each row pads its content by 24 so the icons
and titles sit on the sheet title's line. Do not draw a rounded group inside a sheet — a card
inside the sheet's own padding read as inset twice. The rounded `ListGroup` is for lists on a
screen (Settings, the Profile management list).

Radio controls (`OptionsSelector` and `Chip`) expose `aria-checked` explicitly as well as native
accessibility state; React Native Web does not translate `accessibilityState.checked` by itself.
Switches need an accessible label. The shared `WeekdayChoiceChips` uses abbreviated day labels
visually and full weekday names for assistive technology.

### Screen headers

Every screen header is `components/theme/ScreenHeader.tsx`, rendered inside `MasterLayout` (which
owns the top inset) and above the screen's scroll view, so the way back never scrolls away. It has
two forms:

- **root**: a large (`2xl`, bold) title with trailing actions, for a screen that is one of the bottom
  bar's slots right now. The highlighted tab already says where you are.
- **pushed**: a back button, an `lg` semibold title and trailing actions, for every other screen. Back goes
  to the previous screen, or to Home when the screen was opened cold (a deep link, a reload).

A screen that shows the bottom bar passes its `destination` and the header picks the form from the
user's slots (`resolveScreenHeaderForm`), since the same screen can be a tab for one person and a
pushed screen for another. A screen that hides the bar (Progress, Settings) passes none and is
always pushed. Trailing actions are ghost `IconButton`s or `MenuButton`s with an accessible label.
`subtitle` is one line on where in the screen's content you are (Cycle's phase, the reviewed
week); `center` replaces the title with a control that already says that (Food's day navigator),
while the title stays the screen-reader heading. The header sits outside `AreaLockGate`, so back
works behind a lock; pass `lockArea` and it shows only the title and back while that area is
locked. Do not hand-roll a screen title or back arrow; `deslopGuards.test.ts` lists the screens on
it.

Lists whose length is not bounded (histories, search, saved meals) are a `FlatList` or
`SectionList` that loads the next page from `onEndReached`, never a `ScrollView` with a "Load more"
button. A list made of several separately paginated sections (food search) pages only its last
section on scroll and gives each section above it an inline "Load more from …" row.

### Cards and modals

Cards should have one job: a concise heading, one primary value or action, and supporting detail.
Avoid stacking several unrelated dashboards into one surface.

`components/cards/GenericCard.tsx` has exactly two surface styles, plus one documented brand
exception — see `components/cards/cardSurface.ts` for the resolver and
`components/cards/__tests__/cardSurface.test.ts` for the contract it's held to:

- **`flat`** (default) — `background.card` + an `ink/5` hairline, no shadow. Use for almost every
  card: lists, stats, settings rows.
- **`raised`** — `background.cardElevated` + the same hairline, no shadow: the tonal step lifts it. Reserve for the one
  emphasis/hero card on a screen. It is illegal inside `BottomPopUp` or `CenteredModal` — their
  sheet surface is already `cardElevated`, so a raised card disappears into it, and Android
  elevation can leak through a `SurfaceColorProvider` fade (see `AGENTS.md`).
- **`hero`** — the `colorfulCard` gradient fill. Reserved for `DailySummaryCard`; do not add a
  second consumer without updating this section.

**Gradients carry meaning or they go.** A `LinearGradient` is allowed for a photo or camera scrim,
a fade to the surface behind it (sticky footers, collapsed previews, filter rows), the `hero` card
and the slider track. Buttons are flat, `gradientCta` included. Washes, icon tiles, chat bubbles, progress
fills and summary panels are flat: the token they imitated (`accent.primary`, `accent.primary10`,
`background.card`). `gradients.cta` is read only inside `components/theme/`; a hand-rolled gradient
button goes through `Button`. `components/__tests__/deslopGuards.test.ts` holds the file allowlist,
so a new gradient fails CI until it is added there with a reason.

One radius throughout: `theme.borderRadius.card` (12), the `rounded-card` class.
Do not introduce a third style, a per-card radius, or a gradient card fill outside `hero` — a
`GenericCard` call covers the case, and a hand-rolled surface should be migrated to it rather than
copied.

A row of small figures read side by side — today's energy under the home card, the weekly-average
macros inside it — is always `components/StatStrip.tsx`: hairline-divided cells, the number first
and its sentence-case label under it (`text-xs`, no tracking). The component reads no theme of its own; the caller passes a
`StatStripPalette` so the same row works on a plain card and on the hero gradient. Do not draw a
second variant of this row.

On the hero gradient that palette's fill is `colorfulCard.panel`, the one translucent surface that
sits on the gradient itself. It washes away from the card's ink — towards the scrim under light
ink, towards white under dark ink — so an inset panel can never read worse than the bare card
underneath it. Do not substitute a fixed scrim: `background.scrim30` darkened the four dark-ink
themes into a grey slab and dropped their supporting ink under AA.

Use the existing `FullScreenModal`, `CenteredModal`, `BottomPopUp`, and platform variants. A modal
that opens another modal must follow the presenter rules in `FIXES.md`; visual nesting and React
tree ownership are separate concerns. All three shells title the modal at `text-lg font-semibold`,
the same as a pushed screen header, with a 36pt control-radius close button (a dialog's sits on its
`card` radius). Modal headers sit on the modal's own surface — none of the
shared shells route a header through a gradient; a purple-to-transparent wash was a copy-pasted
pattern across eight files and added nothing over the surface color.

### Home

Home opens on the day it is about: the avatar on the left and a date heading ("Monday, Oct 19")
aligned to the right.
The avatar is the way into the account menu and carries an accessible label; it stays on the left
so it lines up with the avatar the account menu itself opens with. No time-of-day
greeting and no version string; the version lives in Settings > About. The home action tiles are
compact (64pt, the icon beside a short label, `rounded-control`), with no tinted icon circle and
no faded watermark copy of the icon; the selection, picker and reconciliation rules in `AGENTS.md`
are unchanged. Home shows a compact Weekly Review card while a week is waiting (or half
reviewed); otherwise it is one line naming the next review (`WeeklyReviewCard compact quietUntilReady`).
Cycle shows the cycle day once, inside the wheel, with a one-word title and the phase as its
subtitle.

### Empty states, decoration and motion

- An empty state is a plain icon (40 to 48pt, `text.tertiary`, no tinted circle), one line on
  what belongs here, one on how to add it, and a `secondary` button. `gradientCta` only when the
  empty state is the screen and its button is that screen's one primary action. When the empty
  state is the whole screen (Notes), pass `bare` so there is no card around the only thing on the
  page.
- A dashed outline means "this slot is empty, fill it": an empty meal, a list with no sets yet.
  Under a list that already has entries, "Add …" is a `TextButton` with a plus icon, not another
  dashed bar.
- No decoration that conveys nothing: no background blobs or blurred glows, no floating icon
  clusters around an illustration, no gradient icon tiles. Onboarding shows the real app mark
  (`assets/logo.png`), not a placeholder glyph.
- App-owned visuals are Lucide icons, never emoji: moods, equipment, source headings and the notes
  marker are icons sized and tinted from theme tokens, and data strings (such as an exercise row's
  description) stay plain text, with a flag like `hasNotes` telling the UI which icon to draw.
  Translations carry no emoji either, and shared text (the workout summary) uses translated
  labels. Coach messages (`coach.json`, `utils/prompts.ts`) and user-authored text keep theirs.
- Decorative loops are not allowed. An infinite animation is a progress indicator (a spinner, a
  skeleton) and runs on the native driver; a pulsing glow, a floating trophy or a pulsing "live"
  dot is removed rather than moved to another thread. `TextInput`'s border colour is the one
  JS-driven animation, because colour cannot use the native driver.
  `deslopGuards.test.ts` holds the loop allowlist, `useNativeDriver: false`, blur and the dashed
  count.

### Inputs

- Numeric controls use the shared steppers/pickers and locale-aware parsing.
- A centered input never gets a native `placeholder`: on Android it put the caret at the far edge
  of an empty field on first focus. `NumericTextField` draws its placeholder as an overlay and hides
  it while focused; reuse it rather than re-centering a raw `TextInput`.
- **An input is outlined, never a fill alone.** `TextInput`, `PickerButton`, `NumericInput` and a
  surfaced `NumericTextField` all draw an `ink/10` border (accent while focused). A fill is no edge
  where it matches what is behind it: sheets are `cardElevated`, which was `NumericTextField`'s
  only surface, so the set-details effort fields rendered as floating labels.
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
- Sentence case for headings, buttons and menu items ("Track by meal type", "Create workout
  template"). Proper nouns keep their capitals (Health Connect, Open Food Facts, Weekly Review,
  theme names).
- No em dashes in copy: use a comma, a colon, parentheses or two sentences. The dash survives only
  as a value placeholder (an empty pace, the "not logged" mark in a legend).
- No exclamation marks except a genuine celebration (a goal achieved). Confirmations read flat
  ("Meal saved."), and the UI makes no marketing claims ("2M+ items").
- Sparkles means AI. It marks an AI affordance (already gated on `isAiConfigured`) and nothing
  else: automatic targets use a trend icon, What's new a megaphone.
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

The session follows a set table, not a form. **Inline**: one card per exercise — thumbnail, name, muscle · equipment, a done/total badge — then the guidance block (badge, method, one-sentence reason, "Why?", "Use the plan's"), labeled action chips in one horizontal scrolling row, and rows of `Set · Last time · weight · reps · ✓` sharing one set of column widths with their header. Below 400 effective points (viewport width divided by font scale), show Last time as a labeled full-width line beneath each row; never truncate the previous load and reps. Set numbers count within the exercise; a warm-up is a "W". A numeric value the app calculated is accent-tinted **and** underlined until the user types over it. **Guided**: the exercise photo as a hero under a gradient, the name at 3xl, a "Set 2 of 3" badge, two large stepper fields (direct entry plus −/+ by the load step), and one primary "Complete set"; context cards (fueling, cycle) follow the set instead of pushing it down. Both views share `SessionTopBar` (back, title, elapsed time and progress, a two-option view toggle on its own row under the progress bar) and the pinned `RestTimerBar`, which expands to a large panel automatically in Guided and on tap in Inline. Content is capped at 720 px so tablets keep the table legible. Session feedback is an optional action on the summary, with ratings and notes retained in the form when saving fails.

"Why?" is a sheet, not a stack of buttons: method and reason first, then a small inputs table (rule, plan, last time, today), then action rows with icons and one-line hints (Use the plan's, Plate calculator, Edit gym, Edit workout and rules; Edit target only when the equipment cannot build the load). The rule editor is the same pattern: radio cards that each explain their method in a sentence, with the chosen card expanding to its settings. An exercise row in the workout editor names its rule and opens that sheet on tap.

Home shows the Weekly Review card below actions while a week is waiting, and a one-line entry naming the next review otherwise, with active-workout Resume more prominent. Workouts begins with Today before the library: an in-progress workout is an accent card with a progress bar, a primary Resume and a small destructive Discard link — never the other way round; otherwise today's workout with "Preview and start", gym and starting-target chips, and workouts already trained today shown as done. Food shows the review card while a review is due (and on empty or fasting days); otherwise the way in is the "Weekly Review" item of the summary card's menu, whose supporting line says where today's targets come from ("Daily automatic targets · since …"). The targets chip and the "Dynamic" badge that used to sit above the card took a fifth of the first screen to say what that one line says. Preserve the default navigation slots; the optional checkin slot retains its key and carries a due indicator.

Weekly Review leads with the week and a Training / Nutrition progress pair, then the two sections. Training: a `StatStrip` (workouts, working sets, volume in the user's unit), the week's workouts, records as trophy rows, and "Next up" with preview and editor actions; upcoming targets are collapsed by default. Nutrition: a `StatStrip` of the evidence (trend weight, food days, weigh-ins), a Current / Recommended table with signed deltas, the reason, then one primary "Apply targets starting tomorrow" over "Keep current" and "Edit". Missing evidence makes "Keep targets while collecting data" the primary action with shortcuts to log. Review day and reminder live in a settings card below, history last. Opening or canceling a sheet never acknowledges a review. Training acknowledgement never gates progression. Respect themes, exercise units, local decimal separators, safe areas and keyboard clearance.

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
Android Nutrition is 4×2 (the iOS medium footprint) and the camera 1×1. iOS supports small/medium nutrition
and a small camera widget. Colors and translated copy are supplied from the app’s selected palette
and language, respecting iOS tinting. Empty/initial widgets invite opening Musclog; cached values
retain their date, and the iOS midnight timeline replaces expired values with a refresh prompt.
Widget timelines and foreground refresh are subject to the operating system’s rendering schedule.

Widgets are left-aligned and lead with one large figure. iOS Nutrition draws the calorie figure inside
a progress ring (small: ring only; medium: ring beside one labelled bar per macro), the camera
shortcut is the camera artwork alone on a white tile, like an app icon (accent tile with a white
symbol until the artwork is copied), and Cycle shows the day count large under the
brand line, or only the brand line and a quiet arrow while a cycle or whole-app lock is on. Widget layouts are
serialized and evaluated in the extension, so a layout function may use only its imports and locals,
and `widgetFamily` from the environment chooses small versus medium. Android Nutrition mirrors the iOS
medium layout — date over a calorie ring, then a labelled bar per macro on a translucent `track` —
and its root stays a button because that is the interaction target behind the deep link. The widget
runtime ignores weights, so the ring column has a fixed width and the macro column, as the row's last
child, fills the rest; a value is pushed to the far edge by stacking a full-width, end-aligned row over
its label in a `Box`. The runtime draws a ring at a fixed 32dp and ignores its `strokeWidth`: the
box-filling, thin, 12-o'clock-start ring comes from `plugins/withWidgetProgressRing.js`, which
overrides peek-glance's `peek_determinate_circular_progress` layout and drawable by resource name. The camera artwork sits on a white tile
because it is drawn for a white page. `widgets/__tests__/androidWidgetLayout.test.ts` evaluates each
Android layout and fails on a view or modifier the runtime would silently ignore (such as `weight`) or
a macro column left narrower than 110dp on the 250dp minimum footprint.
The camera artwork is at most 512px: WidgetKit refuses
to archive an image larger than the widget (`imageTooLarge`) and keeps showing the last good render.
