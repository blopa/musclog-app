# Musclog — Design System

The app uses a dark, high-contrast performance aesthetic built from green-black surfaces, emerald
actions, restrained supporting color, and dense data displays. `theme.tokens.js` and `theme.ts` are
the implementation sources of truth; this document describes how to use them.

## Theme status

Only the dark palette ships. `lightTheme` currently aliases `darkTheme`, even though a future light
palette is reserved in `theme.tokens.js`. Do not describe light/system selection as a visual feature
until a distinct palette is implemented and tested.

React components obtain dynamic tokens through `useTheme()` or `useThemeContext()`. NativeWind
classes compile against the static dark tokens. Avoid direct imports of `theme` in interactive
components; the local ESLint rule enforces the preferred access pattern.

## Color

### Core surfaces

| Role           | Token                                       | Current value |
| -------------- | ------------------------------------------- | ------------- |
| App background | `background.primary` / `swampGreen`         | `#091310`     |
| Neutral base   | `surfaceBlack`                              | `#0d1511`     |
| Card           | `background.card` / `charcoalGreen`         | `#111a15`     |
| Elevated card  | `background.cardElevated` / `gunmetalGreen` | `#152020`     |
| Primary text   | `text.primary` / `white`                    | `#dce5de`     |
| Primary action | `accent.primary` / `jade`                   | `#10b981`     |

Use semantic theme paths rather than copying these hex values. Raw values are listed only to make
the visual direction explicit.

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

## Review checklist

- Uses semantic tokens and existing shared components.
- Works at narrow and wide widths and with large text.
- Primary actions clear gesture-navigation, safe-area, and keyboard insets.
- Touch targets remain inside parent bounds.
- Status remains understandable without color.
- Numbers parse and format correctly in both comma- and period-decimal locales.
- Loading, empty, error, disabled, and offline states are designed—not left to defaults.
