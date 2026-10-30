---
name: mobile-design-system
description: Propose and generate a React Native app's design system - semantic color tokens (light + dark), type scale with Dynamic Type bounds, radius/elevation/spacing scales, haptics and motion posture - as a SAFE/RISK proposal, then write the actual theme files (NativeWind config or StyleSheet tokens) and MOBILE-DESIGN.md. Use when starting an app's visual identity, when asked for a theme/palette/design tokens, or when an app has inline styles and needs a token system. For building screens with the system use mobile-taste; for auditing an existing app use mobile-design-review.
---

# mobile-design-system: Tokens, Theme, and the SAFE/RISK Proposal

One coherent system, proposed honestly, then written as real files. No screens.

## Flow

### 1. Stack sniff + App Read essentials
Read `package.json` / tailwind config / existing theme files / `MOBILE-DESIGN.md`.
Detect the styling system (NativeWind, StyleSheet, Tamagui, Paper) - the output format
follows it. Establish app kind, audience, platform posture, and dials (one line each;
inherit from MOBILE-DESIGN.md when present). Apply the category bias table
(mobile-taste SKILL.md 1.A2).

### 2. The SAFE/RISK proposal
Propose the ENTIRE system as one package, split explicitly:

**SAFE CHOICES** - the category baseline the user expects. For most apps: system fonts,
native chrome, a restrained neutral ramp, platform-conventional radii. Say plainly that
these are safe and why safe is right here (or isn't).

**RISKS (at least 2, at most 4)** - deliberate departures, each with:
```
RISK: <the move>            e.g. "true-black OLED dark mode as the primary theme"
gain: <what it buys>        "distinctive night identity, battery on OLED"
cost: <what it costs>       "elevation must come from borders, not shadows"
```
A proposal with zero risks is a template; a proposal that is all risks is a costume.

**Coherence validation** - if two choices fight (dense pro-tool density + playful
rounded type; per-platform posture + a fully custom tab bar), flag it in one sentence
and propose the resolution. Flag, never silently "fix".

The proposal covers: palette (semantic tokens: `background`, `surface`, `text-primary`,
`text-muted`, `accent`, `border`, `destructive` - light AND dark values), type scale
(display/title/body/caption + Dynamic Type bounds per SKILL.md 6.1), spacing scale,
radius scale + shape lock, elevation tokens (iOS shadow + Android elevation pairs),
icon family + stroke weight, haptics vocabulary, motion posture (the three dials'
implications), and the signature element budget.

Hard rules inherited from mobile-taste 6.2: one accent; one gray family; no indigo
pipeline; saturation < 80% default; both modes from day one; OLED pure black allowed
only as a declared deliberate choice.

### 3. Preview (optional, offer once)
Offer a self-contained HTML specimen - one file, no external requests: the palette as
swatches (both modes, toggle), the type scale rendered in the actual (system or
declared) fonts, radius/elevation samples on mock components. Open it locally. This is
the no-tooling path and it is the primary path; do not depend on image generation or
external binaries.

### 4. Write the real files
Per the sniffed stack:
- **NativeWind:** `tailwind.config` theme extension + `theme/tokens.ts` (+ `vars()`
  wiring if the project uses CSS-variable theming) + dark values.
- **StyleSheet:** `theme/tokens.ts` with typed color/type/spacing/radius/elevation
  objects and a `useTheme()` hook honoring `useColorScheme`.
- **Existing token file present:** EXTEND it; renaming existing token names is on the
  never-change-silently list (`../_shared/references/redesign-protocol.md`).

### 5. Persist to MOBILE-DESIGN.md
Write (or refresh, with a delta report) the `## Design System` section: the approved
proposal, the RISK register, and where the token files live. Later sessions and sibling
skills read this before any UI decision.

## Rules that bind this skill

* Propose once, coherently - not a menu of five palettes to pick from. One system with
  named risks beats a mood board.
* Every value in the written files traces to the approved proposal. No stowaway tokens.
* If the user rejects a RISK, replace it with the SAFE version and note the swap in
  MOBILE-DESIGN.md; do not quietly keep it.
