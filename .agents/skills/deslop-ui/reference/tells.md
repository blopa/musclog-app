# The tells: catalog and review checklist

Each entry is `Tell → why it reads AI → fix (and "fine when" if it has a legitimate use)`.
Read every entry through the core principle: the problem is reflexive, meaningless use, not
the element itself. Keep all generated copy em-dash-free.

## Tier 1: almost always slop

The reflex itself is the problem. These are very hard to justify.

### Chrome and components

- **Single-side accent bar.** A colored left or top border on cards *and on list rows* (the
  status-page incident-row look). Reads as a lazy stand-in for hierarchy that almost never
  looks intentional. Fix: convey state or category with a status dot, a label, or a
  full-surface tint. Earn a border only when it is part of a real, consistent system.
- **Blinking / pulsing status indicator.** The green "Live" dot with a pulse animation.
  Decorative motion masquerading as signal; on everything it is just noise. Fix: a static dot
  plus a clear label. Reserve a pulse for genuinely live, real-time state, used sparingly.
- **All-caps letter-spaced microtext** used as a reflexive eyebrow/label default. Fine when
  it is a deliberate, consistent part of a real established brand type system. Slop when it is
  sprinkled on every eyebrow. Fix: normal case, with hierarchy from weight, size, and color.
- **Dots as filler separators.** `Tier ∞ • All Access`, `Kiosk · Station 2` as decorative
  punctuation. Fine when separating genuinely peer metadata compactly. Slop when standing in
  for layout. Fix: spacing or stacking instead.
- **Excessive rounded corners.** Large radius on every surface, pills for everything. Uniform
  softness erases hierarchy and reads templated. Fix: commit to a radius scale tied to the
  aesthetic. Some things should be square.
- **Obvious nested containers.** Card inside card inside card. Every border adds a box the
  eye must parse and none of them adds meaning. Fix: flatten; group with space and type, not
  more borders.
- **Glowing gradient orb / sphere "mascot."** The abstract consciousness blob. Fix: if a
  brand mark is needed, design a real one; otherwise drop it.
- **`∞` and gratuitous emoji flourishes** (`Tier ∞`, 😇, ✨) used as a substitute for real
  personality. Fix: let voice and content carry personality, not symbols.
- **⌘K / shortcut hint pills as pure decoration** (`Ask anything… ⌘K`, `EXECUTE ⌘↵`). Fine
  when the shortcut actually exists and is discoverable. Slop when it is chrome.
- **Pill-shaped gradient CTA buttons** as the default button style. Fix: a button style that
  fits the system; reserve emphasis for the one primary action.

### Color and background

- **Purple / neon gradients on dark.** The default AI palette family: purple-to-blue,
  cyan-on-dark, neon glow. Fix: commit to a context-driven palette. Dark themes are fine when
  the product calls for them; pick restrained accents and skip the glow.
- **Gradient text headline.** `background-clip: text` on the hero H1. Currently the single
  most recognizable tell in generated UI. Fix: solid color; let typeface, size, and weight
  carry the impact.
- **Blurred gradient blobs.** Oversized `blur-3xl` color circles absolutely positioned behind
  the hero. Fix: a background either reinforces the brand or stays plain.
- **Dot-grid or grid-line background** with a radial fade mask. The default "technical"
  texture. Same test: brand reinforcement or nothing.
- **Spotlight hero.** Radial glow from top center on a dark page. Same family as the blobs.
- **Colored glow shadow under the primary CTA.** Fix: emphasis through contrast, size, and
  placement, not luminescence.
- **Default-dark with glassmorphism.** Dark by reflex, frosted-glass layers everywhere. Fix:
  choose light or dark from the product's context; reserve blur and translucency for UI that
  genuinely layers over content (overlays, sticky headers over scrolling media).
- **Sparklines and mini-charts as decoration.** Charts that measure nothing. Fix: if it is
  not visualizing real data a user needs, remove it.

### House defaults and unmade decisions

Every generator has a house style, and slop points in two opposite directions: loud defaults
(the gradient maximalism above) and quiet ones. The quiet tells:

- **The unmodified component-library look.** Stock component-kit output shipped as the
  design: neutral gray palette (zinc/slate), muted gray secondary text, thin borders on every
  surface, the library's default font, no color commitment anywhere. The tell is the absence
  of decisions. A component library is a starting point; fix by making the decisions it
  deferred: palette, type, radius, density, one distinctive move.
- **Borrowed design-language bleed.** The UI reads as another company's design system
  (a corporate design language's shadows, shapes, and signature color) rather than this
  product's. Fine when the product genuinely lives inside that ecosystem and must match it.
  Slop when it is just what the generator absorbed. Fix: derive the visual language from this
  product's brand and context.
- **Stock-photo hero reflex.** Generic lifestyle or workspace photography (or an AI-generated
  equivalent) filling space where the product itself should be. Fix: show the actual product,
  real output, or nothing.

Swapping one house style for another is not deslopping; it trades a loud provenance tell for
a quiet one. When generating, counter your own defaults by making context-driven decisions,
not by imitating a different generator's defaults.

### The templated landing page

The tell here is the assembly. Each piece below can be individually defended, but together
they form the page every generator produces, recognizable at a glance:

- announcement badge pill above the hero headline (`✨ New: v2.0 →`) with nothing to announce
- centered hero heading, centered gray subtitle, two side-by-side buttons
- identical section rhythm throughout: colored eyebrow, big centered headline, gray subhead,
  content grid
- three-up feature card grid: icon on top, title, two-line description, all equal weight
- numbered step circles with a connecting line ("How it works")
- stats band (`99.9% uptime / 10M+ requests / 150+ countries`), often with scroll-triggered
  count-up animation
- pricing table with a highlighted middle tier and "Most Popular" badge
- logo marquee and other manufactured social proof: overlapping avatar stacks, five-star
  rows, invented testimonials with names and job titles (inventing proof is a data-honesty
  violation on top of a style problem; never present fabricated data, people, or endorsements
  as real)
- bento grid where every card has the same visual weight regardless of importance
- FAQ accordion and a four-column footer link farm as filler

Fix: structure the page around the product's actual argument. Vary alignment, section
anatomy, and card weight by importance. Ship only sections with real content behind them.

### Iconography

- **The benefit icon triad: Zap = fast, Shield = secure, Sparkles = AI.** As a set, an
  instant tell (any one alone is Tier 2). Fix: icons that encode something specific to this
  product, or no icons at all.
- **Sparkles as the universal AI signifier.** Fix: name the capability instead of badging it.
- **Emoji standing in for an icon system** (🚀 🎯 💡 atop feature cards). Distinct from emoji
  flourishes above; this one is structural. Fix: a real icon set, or none.

### Motion

- **Scroll-triggered fade-in-up on everything, staggered.** Fix: default to static; animate
  the one or two moments that earn it.
- **`transition-all` as a reflex.** Fix: transition the specific properties that change.

### Density

- **Uniform airiness.** Maximum padding between every section, oversized card padding, low
  information density on every surface. Real products vary density with purpose: dense where
  users work, spacious where they decide. Fix: set density per surface, not globally.

## Tier 2: fine when meaningful, slop only when reflexive

This tier is the point of the skill. These are NOT prohibitions. They are "earn it" checks.
Keep them when they carry information; cut them only when they are decoration.

- **Icon beside a nav item.** Good when the icon encodes a real category (for example an
  incident-type icon). Slop when it is a decorative icon next to every label for sameness.
- **Chevron `>` on a row.** Good when it signals expandable or navigates somewhere. Slop when
  it is a default affordance on rows that do nothing.
- **Status pills.** Good when they map to real, distinct states (`Resolved`, `Monitoring`).
  Slop when everything gets a colored pill for visual texture.
- **Relative-time feed with leading dots** (`2s ago`). Good and appropriate in many real
  contexts (activity logs, notifications). Use it when it genuinely helps.
- **Radial progress rings, labeled meter bars, green delta percentages.** Good when they
  visualize a real, meaningful measurement. Slop when they are decorative gauges visualizing
  nothing (a "98.7% coherence" dial). Note: this is about the *decorative* use of data-viz.
  *Fabricating* the underlying numbers is a separate data-honesty problem; never present fake
  data as real.
- **Green checkmark bullets.** Good in a genuine comparison (plans, before/after, supported
  vs. unsupported). Slop as decoration on every feature list.
- **Arrow in a CTA** (`Get Started →`). Fine on the single primary action. Slop when every
  button grows one.
- **Hover scale and shadow lift on cards.** Fine as a consistent system on genuinely
  clickable cards. Slop when every surface inflates on hover.
- **Dark-mode toggle.** Fine. It is a normal convention. Listed only to say: do not flag it.

## Copy tells

- **Em dashes** (the `—` character) in UI copy. Never use it as clause or parenthetical
  punctuation. Use commas, parentheses, colons, or split the sentence.
- **Slop vocabulary:** supercharge, unleash, effortlessly, seamlessly, blazing fast,
  empower, elevate, "10x your." Fix: say what the product does in concrete terms.
- **The imperative verb-pair headline formula** ("Ship faster. Build smarter."). Tolerable
  once; a tell when it is every heading on the page.
- **Casing inconsistency.** Title Case buttons next to sentence-case headings and back again.
  Pick one convention (sentence case unless the brand system says otherwise) and hold it.

## Review mode

Run this against existing or just-built UI. Works on both code and screenshots.

- Code (HTML/JSX/CSS): report each finding as `file:line - tell - suggested fix`.
- Image / screenshot: report each finding as `region or element - tell - suggested fix` (no
  line numbers).

For Tier 1, flag any occurrence. For Tier 2, the check is conditional: name the element, then
ask whether it carries real meaning here or is decorative, and only flag the decorative case.
Example: "status pill present: does it map to a real distinct state, or is it texture?"

For the templated landing page, flag the *pattern* when three or more of its pieces co-occur,
then list the pieces; do not file ten separate findings for one templated page.

### The AI Slop Test

Finish every review with the gut-check:

> Shown this interface and told "AI made it," would they believe you instantly?

If yes, that is the problem. A distinctive interface makes someone ask "how was this made?",
not "which AI made this?"
