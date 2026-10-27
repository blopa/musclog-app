# Visual System

Use this when the task involves visual direction, layout, palette, surfaces, imagery, iconography, shape, or perceived quality.

## Visual Direction

Choose a visual language from product context:

| Context | Good direction | Avoid by default |
| --- | --- | --- |
| Trust and risk | orderly grids, explicit states, stable color | playful bounce, mystery meat icons |
| Personal wellbeing | soft contrast, supportive copy, calm hierarchy | sterile dashboards, harsh warning colors |
| Performance and fitness | bold contrast, large metrics, quick controls | delicate type, low outdoor contrast |
| Commerce and editorial | product imagery, strong detail pages, confident CTAs | crowded cards, weak product inspection |
| Productivity | quiet surfaces, dense lists, predictable affordances | decorative gradients, excessive animation |
| Media | immersive content, scrims, strong playback affordances | heavy chrome, generic thumbnails |

## Bias Correction

Avoid unsupported defaults:

- Purple/blue glow gradients unless the brand or brief calls for that exact direction.
- Decorative mesh backgrounds behind ordinary app screens.
- Card-inside-card nesting.
- Pills/tags that do not add decision-making value.
- Generic avatar, thumbnail, and chart placeholders.
- Static centered web-style hero screens where an app-native task flow is needed.
- Copy that describes features instead of helping the user act.

## Hierarchy Before Decoration

When a screen feels weak, improve fundamentals before adding effects:

1. Real content and task-specific copy.
2. Layout grouping.
3. Spacing.
4. Type scale and weight.
5. Contrast.
6. Color.
7. Depth/materials.
8. Motion.

Borders, shadows, gradients, and animation should not compensate for unclear information hierarchy.

## Color Discipline

- One primary brand accent is a strong default. Broader palettes are fine when defined as semantic roles or an existing design system.
- Do not use semantic colors as decoration.
- Do not mix warm and cool neutral systems accidentally.
- Check contrast in both light and dark modes.
- Prefer platform semantic colors for native code unless brand tokens are required.
- For token examples, read `references/typography-color.md`.

## Dark Mode

Dark mode is a separate design, not an inverted light theme.

- Choose true black only when battery, OLED aesthetics, or media immersion justify it.
- Use near-black surfaces when readability and depth matter more than maximum OLED savings.
- Raise contrast for text and controls without making every border bright.
- Ensure image scrims, charts, maps, and shadows are redesigned for dark mode.
- On Android, dynamic color can alter accent roles; test generated schemes.

## Surfaces and Depth

Depth should explain hierarchy:

- Background: full-screen base.
- Surface: grouped content, inputs, list containers.
- Elevated: modal, sheet, popover, floating controls.

Use cards when containment clarifies the task. Use separators, whitespace, or typography when containment would add noise.

Blur/glass:

- Good for iOS tab bars, sheet headers over content, media overlays, and transient layers.
- Weak for ordinary repeated cards or dense forms.
- Must include contrast protection for text.

Shadows:

- Use one elevation scale.
- Tint or soften shadows to the environment.
- Avoid stacking shadowed containers.
- On Android Material 3, tonal elevation often matters more than drop shadow.

## Imagery

Use real or contextually meaningful imagery:

1. User-provided assets.
2. Product/domain-specific images from the app data.
3. Generated or searched assets when the task allows it.
4. Seeded placeholders only as temporary scaffolding.

For text over images:

- Add a scrim or gradient.
- Check contrast at multiple crop positions.
- Avoid dark, blurred, generic stock imagery when the user needs to inspect the subject.

For implementation details, read `references/react-native-implementation.md`.

## Iconography

- Use one icon family per surface unless platform divergence is deliberate.
- iOS-native work: prefer SF Symbols / `expo-symbols` where available.
- Android-native work: prefer Material Symbols or Material Icons.
- Cross-platform custom apps: use an installed family such as Phosphor, Tabler, or the repo's existing icon system.
- Keep sizes on a 4pt rhythm: 16, 20, 24, 28, 32.
- Pair icon-only controls with accessible names and visible affordance.

## Shape and Radius

Pick a radius system and apply it consistently:

| System | Use for |
| --- | --- |
| Sharp | utilities, technical tools, data-dense enterprise |
| Soft | most consumer and productivity apps |
| Round | social, playful, wellness, friendly apps |
| Mixed with rule | e.g. cards 16, inputs 12, primary buttons pill |

Document intentional exceptions. Random radius variation reads as accidental.

## Layout

Use mobile-native hierarchy:

- Content first, action reachable.
- Bottom anchored CTAs for linear flows.
- Sticky controls only when repeated access matters.
- Lists for repeated scanning, grids for visual comparison, carousels only when horizontal browsing is core.
- Featured items may break grid rhythm, but maintain predictable scroll and tap behavior.

For small screens, asymmetric or editorial layouts must collapse into stable single-column patterns without horizontal scroll.

## Visual Review

Before shipping:

- Does the five-second screen test pass: place, purpose, priority, next action, state?
- Does the screen have a clear primary job?
- Are accent, radius, spacing, and icon choices consistent?
- Are cards and effects communicating hierarchy rather than decoration?
- Is the content realistic?
- Does dark mode feel intentionally designed?
- Does the screen still work with large text and long strings?
