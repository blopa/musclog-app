# Musclog — Design System

The app uses a high-contrast performance aesthetic built from tinted surfaces, vivid actions,
restrained supporting color, and dense data displays. `theme.registry.js` is the theme catalogue;
`theme.tokens.js` and `theme.ts` derive the two runtime representations from it. This document
describes how to use them.

## Theme status

Four named palettes ship: Kinetic Depth is the dark emerald reference design, Kinetic Light is the
same structure re-picked for a bright ground, Kinetic Shock is a dark rose-led alternative, and
Kinetic Volt pairs warm near-black surfaces with electric yellow accents.
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

The Daily Summary card reads `theme.components.dailySummaryCardBackground`: Kinetic Depth, Kinetic
Shock, and Kinetic Volt select `gradients.colorfulCard`, while Kinetic Light selects the standard
card surface. The component must not derive this presentation decision from `themeMode`; another
light theme may legitimately choose a gradient. Its foreground uses the matching `colorfulCard` ink
tokens: white in Kinetic Depth and Kinetic Shock, warm black in Kinetic Volt, and opaque deep
green-slate in Kinetic Light.

### Role tokens

A few primaries keep their job across themes instead of their lightness, and reading them by name is
what keeps a theme switch from inverting something that should not move:

| Token                                    | Job                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| `text.onAccent` / `inkOnAccent`          | Ink printed on a solid brand or status fill          |
| `shadow` / `scrimBase`                   | Backdrops, camera scrims, drop shadows — dark always |
| `background.alwaysWhite`                 | Fixed-white fills: slider and switch thumbs          |
| `text.onColorful`, `overlay.onColorful*` | Ink on a colorful gradient or a photo                |
| `background.separatorLight`              | Image placeholder and separator fill                 |

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

| Role           | Token                                       | Kinetic Depth | Kinetic Light | Kinetic Shock | Kinetic Volt |
| -------------- | ------------------------------------------- | ------------- | ------------- | ------------- | ------------ |
| App background | `background.primary` / `surfaceBase`        | `#091310`     | `#fafcfb`     | `#160b14`     | `#151208`    |
| Card           | `background.card` / `surfaceCard`           | `#131d18`     | `#eef2f0`     | `#21101e`     | `#201b0c`    |
| Elevated card  | `background.cardElevated` / `surfaceRaised` | `#1b2721`     | `#e0e7e3`     | `#2d1829`     | `#2c2510`    |
| Tinted overlay | `background.overlay` / `surfaceTint`        | `#0c2419`     | `#dff0e7`     | `#351226`     | `#30270a`    |
| Accent surface | `border.accent` / `surfaceAccent`           | `#1c3829`     | `#c6e6d4`     | `#51203f`     | `#4a3b08`    |
| Hairline       | `border.dashed` / `borderHairline`          | `#2c3a32`     | `#c2cfc8`     | `#503248`     | `#4a4126`    |
| Primary text   | `text.primary` / `textPrimary`              | `#dce5de`     | `#0f1a16`     | `#f5e4ef`     | `#f6f0d5`    |
| Primary action | `accent.primary` / `brandPrimary`           | `#29a577`     | `#0e7a54`     | `#e85d9e`     | `#f5c842`    |

Accents get _darker_ on light, not lighter: every brand and status hue in the light palette clears
4.5:1 as text on `surfaceBase` and `surfaceCard`, and carries white ink at 4.5:1 or better when it is
used as a solid fill. Copying a dark-theme accent into the light palette is the mistake that makes an
emerald button vanish.

Use semantic theme paths rather than copying these hex values. Raw values are listed only to make
the visual direction explicit.

### Naming

A semantic key names the **role** it resolves to, never a hue. With one palette `status.emerald`
was harmless; with four it was a lie — the same key is emerald on Kinetic Depth and pink on Kinetic
Shock. So the tree reads `status.brandVivid`, `text.tertiary`, `background.scrim30`,
`overlay.ink70`, and a key like `status.teal400` or `background.gray800` should not come back. The
one exception is `avatar.*` / `avatarBg.*`, which are keyed by the persisted `AvatarColor` enum
rather than by palette role.

`npm run check-palette` enforces this across all four themes: it fails if a hue-named token swings
more than 40 degrees of hue between themes, which is exactly how `status.emerald` went wrong. It
also enforces the color rules below. `utils/__tests__/themeSelection.test.ts` covers the same
ground from the test suite.

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

Standard radii are 12 for inputs/general controls, 16 for primary cards, and `full` for circular or
pill elements. Borders should be subtle; surface separation should usually come from tonal layering
before outlines or heavy shadows.

Interactive mobile controls need an effective target of at least 44×44 points, preferably 48×48.
Expand targets with internal padding. On iOS, negative margins and out-of-bounds `hitSlop` can be
clipped by the parent; see `FIXES.md`.

## Components

### Buttons

- Primary: emerald or the approved emerald-to-teal gradient, with high-contrast text.
- Secondary: low-emphasis surface or outline treatment.
- Destructive: red/rose and explicit action copy.
- Disabled: visually subdued and non-interactive; never communicate disabled state by opacity alone
  when the label would become unreadable.

Use the shared components under `components/theme/` before adding a local button or input style.
Every pressable should cover its visible surface and provide feedback through state, haptics where
appropriate, or both.

### Cards and modals

Cards should have one job: a concise heading, one primary value or action, and supporting detail.
Avoid stacking several unrelated dashboards into one surface.

Use the existing `FullScreenModal`, `CenteredModal`, `BottomPopUp`, and platform variants. A modal
that opens another modal must follow the presenter rules in `FIXES.md`; visual nesting and React
tree ownership are separate concerns.

### Inputs

- Numeric controls use the shared steppers/pickers and locale-aware parsing.
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
- Menstrual-cycle and recovery guidance should be framed as context, not deterministic instruction.

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
- Works in all themes: check Kinetic Light, Kinetic Shock, and Kinetic Volt, and confirm nothing
  relies on a literal `text-white` or an emerald-only accent.
- Loading, empty, error, disabled, and offline states are designed—not left to defaults.
