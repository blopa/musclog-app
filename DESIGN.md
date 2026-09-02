# Musclog — Design System

The app uses a high-contrast performance aesthetic built from green-tinted surfaces, emerald
actions, restrained supporting color, and dense data displays. `theme.tokens.js` and `theme.ts` are
the implementation sources of truth; this document describes how to use them.

## Theme status

Both palettes ship. Dark is the reference design; light is the same structure re-picked for a bright
ground. Users choose Appearance — System, Light or Dark — under Settings → Interface, and the
preference is stored in the settings table, so writing that row re-themes the app.

Both halves of the styling system follow that choice:

- React components read dynamic tokens through `useTheme()` or `useThemeContext()`.
- NativeWind `className` colors resolve to CSS custom properties, written into `:root` (light) and
  `.dark:root` (dark) by the base plugin in `tailwind.config.js`. `ThemeProvider` pushes the stored
  preference into NativeWind's color scheme, which swaps the whole set at runtime on native and web.

Avoid direct imports of `theme` in interactive components; the local ESLint rule enforces the
preferred access pattern.

### Surfaces that do not follow the theme

Some surfaces are not the app's background: a camera viewfinder, a photo, or a scrim over either.
Their content is white-on-dark whatever the user picked, so they pin their own palette with
`ForcedDarkTheme` / `ForcedDarkThemeScope`
(`context/ForcedThemeContext.tsx`) rather than hand-picking tokens. Use the scope form around a
whole component — a component reads `useTheme()` during its own render, so a provider wrapped around
its output cannot reach its inline styles.

Text drawn on a colorful gradient uses the fixed-white tokens (`text.onColorful`,
`overlay.onColorful*`), never the on-surface ink.

The Daily Summary card uses its `gradients.colorfulCard` surface in dark mode and the standard card
surface in light mode. Its foreground uses the matching `colorfulCard` ink tokens: white in dark
mode and opaque deep green-slate in light mode.

### Role tokens

A few primaries keep their job across themes instead of their lightness, and reading them by name is
what keeps a theme switch from inverting something that should not move:

| Token                                    | Job                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| `text.black` / `inkOnAccent`             | Ink printed on a solid brand or status fill          |
| `shadow` / `scrimBase`                   | Backdrops, camera scrims, drop shadows — dark always |
| `background.white`                       | Fixed-white fills: slider and switch thumbs          |
| `text.onColorful`, `overlay.onColorful*` | Ink on a colorful gradient or a photo                |
| `background.separatorLight`              | Image placeholder and separator fill                 |

The `ink` Tailwind color is the on-surface ink at an alpha — `border-ink/10`, `bg-ink/5`. Use it for
hairlines and washes instead of a literal `border-white/10`, which only reads on a dark ground.

## Color

The primary palette is 23 colors plus a short tail of role primaries, defined once per theme in
`kineticDepth` / `kineticDepthLight` and grouped by role rather than by hue name: six surfaces, three
text steps, six brand greens, and eight status hues. Everything else — the semantic token tree, the
Tailwind colors, the CSS variables — is derived from a palette by `createColors` and
`createThemeColors`, so both themes stay the same shape by construction. Anything softer than a
primary is derived too: `addOpacityToHex` for translucent washes, `mixHex` for opaque tinted
surfaces. A new hex value in either palette should be rare and deliberate.

### Core surfaces

Surfaces form a four-step tonal ladder plus two tinted branches. Each step of the ladder is at least
1.09x contrast from the one below it, which is the point at which a layer edge is actually visible
without a border. The ladder inverts between themes: elevation moves _away_ from the base, which is
lighter on dark and darker on light.

| Role           | Token                                       | Dark      | Light     |
| -------------- | ------------------------------------------- | --------- | --------- |
| App background | `background.primary` / `surfaceBase`        | `#091310` | `#fafcfb` |
| Card           | `background.card` / `surfaceCard`           | `#131d18` | `#eef2f0` |
| Elevated card  | `background.cardElevated` / `surfaceRaised` | `#1b2721` | `#e0e7e3` |
| Tinted overlay | `background.overlay` / `surfaceTint`        | `#0c2419` | `#dff0e7` |
| Accent surface | `border.accent` / `surfaceAccent`           | `#1c3829` | `#c6e6d4` |
| Hairline       | `border.dashed` / `borderHairline`          | `#2c3a32` | `#c2cfc8` |
| Primary text   | `text.primary` / `textPrimary`              | `#dce5de` | `#0f1a16` |
| Primary action | `accent.primary` / `brandPrimary`           | `#29a577` | `#0e7a54` |

Accents get _darker_ on light, not lighter: every brand and status hue in the light palette clears
4.5:1 as text on `surfaceBase` and `surfaceCard`, and carries white ink at 4.5:1 or better when it is
used as a solid fill. Copying a dark-theme accent into the light palette is the mistake that makes an
emerald button vanish.

Use semantic theme paths rather than copying these hex values. Raw values are listed only to make
the visual direction explicit.

### Text contrast

The three text steps all clear WCAG AA on every surface above, in both themes: `text.primary` at 12:1
or better, `text.secondary` at 5.8:1, and `text.tertiary` at 4.6:1. `text.tertiary` is the floor — do
not introduce a dimmer neutral for label or caption text.

A handful of saturated accents (`accent.tertiary`, `status.indigo`, `rose.brand`) sit between 3:1
and 4.5:1 on the darker surfaces. They are fine for icons, chart series, borders and large type,
which need 3:1, but should not be used for body copy.

### Functional color

- Emerald/green: primary actions, completion, positive progress.
- Red/rose: destructive actions and errors.
- Amber/orange: warnings, energy, and attention without failure semantics.
- Blue/teal: information, hydration, and secondary data.
- Indigo/violet: supporting series, recovery, and AI accents.

Macro colors must remain stable across cards and charts:

- Protein: indigo.
- Digestible carbs: emerald.
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
- Works in both themes: check a switch to Light, and confirm nothing relies on a literal `text-white`
  or a dark-only accent.
- Loading, empty, error, disabled, and offline states are designed—not left to defaults.
