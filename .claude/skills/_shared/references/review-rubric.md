# Design Review Rubric

The audit method shared by `mobile-design-review`, `mobile-redesign-screen`, and
`mobile-redesign-app`. It produces rated findings, two headline scores, and a
regression baseline.

## Contents
- [The two passes](#the-two-passes)
- [First-impression narration](#first-impression-narration)
- [The Trunk Test](#the-trunk-test)
- [Finding format & impact ratings](#finding-format--impact-ratings)
- [The ten categories](#the-ten-categories)
- [Scoring math](#scoring-math)
- [The baseline file & regression deltas](#the-baseline-file--regression-deltas)
- [Honesty rules](#honesty-rules)

## The two passes

**Static pass (always possible):** stack sniff, then run the grep checklist from
`tells.md` end-to-end and inspect the code against the ten categories below. Every hit
is triaged into a finding or dismissed with a one-line reason. If the project has no
`package.json`/`app.json` (code-only export), note it as a scope limitation in the
unverified list - it is not itself a finding.

Section citations in findings (6.4, 4.C, …) refer to `skills/mobile-taste/SKILL.md`;
read it alongside this rubric.

**Live pass (when a device is reachable):** in priority order, try (1) iOS simulator /
Android emulator screenshots, (2) Expo web preview in a phone-sized viewport, (3) asking
the user for screenshots. Walk the primary flows from the Nav Read (or reconstruct one
from the route tree if none exists). Per screen: screenshot, first-impression narration,
Trunk Test, touch-target inspection, dark-mode + large-font variants when practical.

## First-impression narration

Before analyzing, record the 5-second reaction in first person, present tense: where the
eye lands first, second, what gets skipped, what feels off. Two to four sentences, no
hedging. ("My eye goes to the streak number, then the add button. The four stat chips
below read as decoration and I skip them. The list rows feel taller than their content
deserves.") The narration is evidence for findings, not a finding itself.

**Narration and the Trunk Test are live-pass instruments.** In a static-only review,
skip them (mark "N/A: no rendered screens") or, if you reconstruct them from code,
label them explicitly as code-reconstructed - a "first impression" of code read
top-to-bottom is not a first impression of a screen.

## The Trunk Test

Drop onto each screen cold (as if shaken awake in a car trunk) and answer:
1. What app is this?
2. What screen am I on?
3. Where am I in the app's structure?
4. How do I get back?

Score PASS / PARTIAL / FAIL per screen. **A FAIL is automatically a high-impact
finding** regardless of visual polish - on mobile there is no persistent chrome to
rescue a disoriented user. Deep-linked entry counts: run the test on at least one
detail screen entered directly.

Scoring guidance: Q1 ("what app?") is graded at entry screens (tab roots, deep-link
landings); interior screens are graded on Q2-Q4, since almost no well-designed app
brands every interior screen. PARTIAL = one graded question shaky; FAIL = the user
would not know where they are or how to get back.

## Finding format & impact ratings

```
FINDING-012 [high | states] Feed has no offline state
  where: app/(tabs)/index.tsx
  evidence: narration/screenshot/grep line
  tell: #38 (if it maps to a catalog tell)
  fix: offline banner + cached-content behavior per SKILL.md 6.4
```

Impact ratings:
- **high** - breaks usability, trust, or platform expectations (trunk-test FAIL, hidden
  submit under keyboard, dead Android back, unreadable contrast, missing restore on a paywall)
- **medium** - visibly wrong but recoverable (inconsistent spacing scale, chevron on
  toggle rows, spinner-only loading, gray soup)
- **polish** - taste-level (radius drift on one component, entrance animation overshoot)

Number findings sequentially and keep numbers stable within a report.

## The ten categories

1. **Navigation & IA** - tab logic, container choices, back behavior, deep links (rules: navigation.md)
2. **Screen anatomy** - safe areas, header ownership, thumb zone, spacing grid (SKILL.md 5)
3. **Typography** - scale from tokens, Dynamic Type, Android quirks (6.1)
4. **Color & theming** - token discipline, accent lock, dark mode parity (6.2)
5. **Surfaces & grouping** - card discipline, elevation tokens, shape lock (6.3)
6. **States** - loading/empty/error/offline/refresh cycle (6.4)
7. **Interaction & motion** - press feedback, gesture discoverability, motion hierarchy, reduced motion (7)
8. **Forms & input** - keyboard handling, autofill props, label placement (5)
9. **Performance signals** - JS-thread animation, virtualization, image handling (8)
10. **Copy & content** - voice, filler verbs, em-dashes, fake data (6.7)

## Scoring math

Mechanical, no vibes. Score numerically, report as letters.

Per category: start at 4.0; each **high** finding subtracts 1.0; each **medium**
subtracts 0.5; **polish** findings subtract nothing (listed, not scored). Floor 0.
Letter bands: A >= 3.7 · A- >= 3.4 · B+ >= 3.1 · B >= 2.7 · C+ >= 2.1 · C >= 1.7 ·
D >= 0.7 · F below.

- **Design Score** = the MEAN of the ten category values, converted to a letter -
  **capped at B whenever any high-impact finding is open.** (A median lets seven clean
  categories launder a trust-breaking defect into an A; the cap is the "no rounding up"
  rule made structural.)
- **AI Slop Score** = same math, but ONLY from findings that map to a numbered tell in
  tells.md. It measures template-slop, NOT correctness - an app built against this very
  catalog will often score A on slop while carrying real defects; that is the score
  working as designed, not a clean bill of health. When a real defect recurs and maps to
  no tell, propose it as a new tell (tells.md is append-only).
Report both scores - they answer different questions.

## The baseline file & regression deltas

Write `design-baseline.json` at the project root on every run:

```json
{
  "tool": "mobile-design-review", "version": 1, "date": "<ISO>",
  "designScore": "B", "slopScore": "A",
  "categories": { "navigation": "A", "states": "C", "...": "..." },
  "findings": [{ "id": "FINDING-012", "impact": "high", "category": "states",
                 "summary": "...", "status": "open" }],
  "unverified": ["keyboard on device", "1.3x font scale"]
}
```

If a baseline already exists: report the DELTA first (per-category letter changes, new
findings, resolved findings), then the full report. Refresh the same file; never fork a
second baseline.

**The baseline is the ONE sanctioned write in report-only mode** - it is the review's
own artifact, not an app edit. If the user asked for truly zero writes, put the JSON in
the report body instead and say so.

## Honesty rules

- Say explicitly which pass ran. A static-only review states: "No simulator/device was
  reachable; the live checks (keyboard, splash, scroll perf, font scale, edge-to-edge)
  are NOT verified."
- A grep hit dismissed as a false positive gets its one-line reason in the report.
- Scores follow the math. Do not round up because the app is "almost there".
