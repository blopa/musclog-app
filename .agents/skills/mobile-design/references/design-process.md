# Design Process

Use this file first on every task. Its job is to prevent default mobile UI and force the design to follow the user, platform, and product context.

## Core Frame

Mobile is not a small desktop. It is personal, interrupted, thumb-driven, variable in network quality, and constrained by system UI, keyboards, sensors, and accessibility settings.

Before designing, identify:

- User: ability, familiarity, emotional state, privacy expectations.
- Context: one-handed use, movement, glare, noise, connectivity, interruption risk.
- Category: finance, health, fitness, social, commerce, productivity, media, utility, education, creative.
- Platform: iOS, Android, cross-platform, tablet/foldable, or web-to-mobile.
- Task success: the concrete outcome the user is trying to complete.
- Constraints: existing brand, codebase patterns, installed packages, performance budget, app store requirements.

## Design Read

State one sentence before code or critique:

`Reading this as: <category> for <audience/context>, with a <visual direction> interface, targeting <platform>.`

Examples:

- `Reading this as: a banking flow for anxious first-time investors, with a calm/trustworthy interface, targeting iOS and Android.`
- `Reading this as: a run-tracking app for outdoor use, with a bold high-contrast interface, targeting Android-first.`
- `Reading this as: a premium recipe app for home cooks, with a warm editorial interface, targeting iOS-first.`

## Ask vs Decide

Ask one question only when the answer materially changes the implementation and cannot be inferred safely. Good questions are narrow:

- `Is this screen iOS-only, Android-only, or cross-platform?`
- `Should I preserve the existing brand palette or propose a new one?`
- `Is this Expo managed or a bare/native workflow?`

Decide when the risk is low and the local codebase provides a pattern:

- Use existing token names and component primitives.
- Match the repo's navigation library.
- Use the installed icon and animation libraries.
- Preserve existing radius, spacing, and typography unless the task is a redesign.

## Category Heuristics

These are starting points, not rules.

| Category | Design posture | Watch for |
| --- | --- | --- |
| Finance / banking | Calm, structured, explicit feedback | Overplayful motion, hidden risk, weak trust cues |
| Health / wellness | Supportive, readable, reassuring | Shame language, cold clinical styling, inaccessible text |
| Fitness / sport | High contrast, fast scanning, strong hierarchy | Low outdoor contrast, tiny controls during movement |
| Social / community | Expressive, reactive, identity-rich | Sterile layout, unclear privacy and moderation states |
| Commerce / luxury | Image-led, editorial, decisive CTAs | Cluttered grids, weak product inspection, fake imagery |
| Productivity / tools | Efficient, dense, predictable | Decorative motion, excessive cards, low keyboard support |
| Media / entertainment | Immersive, content-first | Heavy chrome, generic thumbnails, poor loading states |
| Kids / education | Clear, forgiving, playful | Tiny controls, punitive errors, unbounded stimulation |

## Trust, Emotion, and Recovery

Choose an intended feeling only when it helps the user finish the task: confidence before a payment, control during a permission request, relief after recovery, or momentum when a setup step completes. Earn that feeling with clarity, feedback, and a visible next action, not celebration layered over uncertainty.

For high-value moments, define the trigger, the observable state change, the feedback, and the recovery or next step.

| Moment | Design for | Avoid |
| --- | --- | --- |
| Finance confirmation | Confidence and control | Ambiguous labels, hidden fees, celebratory motion before completion |
| Health result or reminder | Reassurance and agency | Alarming color/copy without a clear action or escalation path |
| Permission request | Informed consent | System prompt without prior value or a usable decline path |
| Checkout failure | Recovery | Dead ends, lost cart data, blame-oriented copy |
| Onboarding completion | Momentum | Blocking confetti or a vague success state with no next action |
| Social safety/privacy action | Safety and ownership | Invisible audience, moderation, or undo state |

Do not manufacture urgency, use variable rewards, or conceal meaningful consequences to create engagement. In risky or irreversible flows, lower visual variance and motion rather than trying to make the moment feel exciting.

## Design Read Cascade

Turn the design read into concrete choices. Use this as a starting table, then adapt to the local app.

| Read | Type | Color | Radius | Motion | Iconography | Layout |
| --- | --- | --- | --- | --- | --- | --- |
| Fintech, professional, iOS | SF Pro, strong numeric hierarchy | cool neutrals, restrained accent, clear status colors | soft 12-16 | low, structural | SF Symbols | lists, summaries, explicit confirmations |
| Health/wellness, consumer | system or friendly rounded sans | warm neutrals, sage/blue/soft accent | soft/round 16-24 | gentle | rounded platform icons | guided cards, supportive empty/error states |
| Fitness, outdoor | bold system/custom sans, large metrics | high contrast, dark/light outdoor-safe accent | medium 12-20 | snappy | bold simple icons | large controls, bottom actions, glanceable stats |
| Social/community | expressive but readable | warmer palette, identity colors with restraint | round 20+ | reactive | custom or platform icon set (SF/Material) | avatar/content-led feed, visible privacy states |
| Commerce/luxury | editorial display plus readable body | monochrome or rich brand accent | soft 12-20 | smooth | minimal line icons | image-led detail, strong checkout path |
| Productivity/tool | system sans, compact hierarchy | neutral roles, functional accent | sharp/soft 4-12 | minimal | platform or utilitarian icons | dense lists, toolbars, separators over cards |
| Media/entertainment | content-led type, bold titles | dark/media-first, scrims | medium | cinematic but restrained | platform/media icons | full-bleed media, playback controls, carousels only when useful |
| Kids/education | friendly rounded type | saturated but controlled | round 20+ | playful, forgiving | chunky/custom | large targets, clear progress, positive recovery |

Vibe modifiers:

- Premium: reduce color count, increase spacing precision, use fewer but better materials.
- Playful: increase radius and spring response, but keep navigation predictable.
- Calm: lower contrast harshness without failing accessibility; slow noncritical motion.
- Bold: larger type, stronger contrast, more decisive CTAs.
- Editorial: imagery and type carry personality; avoid overdecorated components.
- Native: prefer platform typography, icons, transitions, and semantic colors.

## User-Centered Mobile Realities

- Primary actions usually belong in the lower half, especially for repeated one-handed use.
- Destructive actions should be protected from accidental thumb-zone activation.
- Users scan first; strong headings and visible state transitions matter.
- The keyboard can cover a large portion of the screen; forms need scroll and focus management.
- Offline, slow network, denied permissions, and interrupted sessions need designed states.
- Accessibility settings are normal user preferences, not edge cases.

## Usability Shortcuts

Use the five-second test: users should quickly understand where they are, what the screen is for, what matters most, what they can tap next, and whether anything needs attention.

If a screen feels weak, repair in this order: content, layout grouping, spacing, type, contrast, color, depth, motion. Do not use gradients, shadows, or animation to compensate for unclear hierarchy.

Prefer conventional patterns for risky or familiar flows: back behavior, forms, checkout, permissions, destructive actions, privacy, and settings. Spend novelty on brand expression, content presentation, empty states, and non-critical delight.

Make copy name outcomes: `Pay $42.18`, `Save draft`, `Retry upload`, `Use current location`, `Delete workout`.

## Dials

This section is the canonical definition of the design dials. `SKILL.md` and `references/motion-haptics.md` carry short summaries that mirror it; edit the semantics here and keep those in sync.

Set dials after the design read:

| Dial | Low | High |
| --- | --- | --- |
| `DESIGN_VARIANCE` | platform-native, expected | distinctive, editorial, experimental |
| `MOTION_INTENSITY` | instant state changes | choreographed transitions and physical feedback |
| `VISUAL_DENSITY` | spacious and guided | compact, operational, repeat-use |

Dial guidance:

- Safety-critical, financial, health, auth, permissions: lower variance and motion.
- Repeated operational work: higher density, lower decorative motion.
- Consumer discovery, fitness, social, media: more expression if hierarchy stays clear.
- Premium/minimal: low density does not mean empty; precision in spacing, type, and materials carries the design.

### Dial Translation

`DESIGN_VARIANCE`

| Value | Changes in output |
| --- | --- |
| 1-3 | Strict platform defaults, system font, standard navigation, minimal custom surfaces |
| 4-6 | Custom tokens, clear brand accent, modest layout variation, one distinctive detail |
| 7-8 | Custom typography or imagery, varied compositions, stronger material/shape choices |
| 9-10 | Experimental structure or interaction; only for creative briefs with explicit tolerance |

`MOTION_INTENSITY`

| Value | Changes in output |
| --- | --- |
| 1-3 | Native transitions, press opacity/scale, no decorative motion |
| 4-6 | Spring press states, sheet/list continuity, restrained skeleton transitions |
| 7-8 | Shared-element moments, parallax, richer success/empty-state animation |
| 9-10 | Choreographed motion system; require reduced-motion fallback and profiling |

`VISUAL_DENSITY`

| Value | Changes in output |
| --- | --- |
| 1-3 | Large whitespace, few choices per screen, strong guided CTA |
| 4-6 | Standard app density, lists/forms with comfortable spacing |
| 7-8 | Compact operational rows, more data per screen, separators over large cards |
| 9-10 | Expert/cockpit UI; dense controls, strong grouping, careful accessibility testing |

Implementation implications:

- High variance should not break small-screen stability.
- High motion should increase verification burden.
- High density requires stronger typography, spacing tokens, and focus order.
- Low density still needs real content and state handling.

## Output Expectations

When generating or revising UI:

- Explain decisions through the user and platform, not taste alone.
- Use concrete content and data. Avoid placeholder people, fake round numbers, and generic copy.
- Keep visual systems internally consistent: radius, spacing, type scale, color roles, icon family.
- Include all states needed for the workflow.
- Verify or clearly state what was not verified.
