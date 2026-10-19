---
name: mobile-redesign-app
description: Whole-app redesign of an existing React Native / Expo app - full audit (tokens, navigation vs the Nav Read rules, screen archetypes, dial reading), preserve-vs-overhaul decision, then a phased modernization plan executed lever by lever across screens with checkpoints and a risk governor. The only skill in this suite allowed to propose navigation restructuring (approval-gated). Use when asked to redesign, overhaul, rebrand, or modernize an entire app. For one screen use mobile-redesign-screen; for an audit without changes use mobile-design-review.
---

# mobile-redesign-app: The Whole App, In Phases

Method files, read in full first: `../_shared/references/redesign-protocol.md`,
`../_shared/references/review-rubric.md`, `../_shared/references/tells.md`, and
`../_shared/references/navigation.md` (for the nav audit).

## Flow

### 1. Full audit
Stack sniff, then the complete review-rubric pass (static + live when reachable) across
every screen in the route tree, PLUS:
- **Nav audit:** the current route tree diffed against the navigation.md mechanical
  checks (tab count/logic, container choices, back behavior, deep links). Emit the
  current tree as a Nav Read so problems are visible in the same format the fix will use.
- **Token audit:** where the design system lives, or the finding that it doesn't.
- **Dial reading** of the app as-built; **platform posture** consistency.
- Write `design-baseline.json` - the redesign will be measured against it.

### 2. Mode + scope agreement
Preserve vs overhaul (ask once). Then present the plan as PHASES, each one lever from
redesign-protocol.md applied app-wide:

```
Phase 1  Tokens + type/spacing     (touches theme files + every screen mechanically)
Phase 2  Color onto semantic tokens; dark mode
Phase 3  States (skeleton/empty/error/offline/refresh) per data screen
Phase 4  Press feedback + motion layer
Phase 5  Screen recomposition (worst screens first, from the findings)
Phase 6  Navigation restructure    (ONLY if the nav audit demands it - see below)
```
Per phase: findings closed, files touched, what will not change. Get approval for the
plan once, then checkpoint (short summary + before/afters) at each phase boundary
rather than re-asking.

### 3. Navigation restructure (the gated phase)
This skill may PROPOSE nav changes - as a current-vs-proposed Nav Read diff with every
never-change-silently item flagged (route names, deep links, tab order, learned
gestures) and a migration note (redirects for renamed deep links, state migration).
It ships ONLY after explicit approval of that diff. If navigation is fine, say so and
skip the phase; most redesigns should.

### 4. Execution
The redesign-protocol fix loop, per phase: atomic commits, before/after pairs, findings
closed in the baseline, **risk governor at app scale** (stop > 20%, hard cap 40 fixes
per run - a large app takes multiple runs, and that is the design, not a limitation).
Phase order is not negotiable mid-run; a tempting Phase-5 recomposition discovered
during Phase 2 becomes a finding, not a detour.

### 5. Close out
Regression run of the rubric → delta table against the starting baseline (this is the
proof the redesign worked), remaining findings, refreshed `MOBILE-DESIGN.md` (reads,
dials, token locations, Nav Read) so future sessions inherit the new system.

## Hard boundaries

* Overhaul mode changes visual language, never content or IA without the gated diff.
* Accessibility wins from the audit are regression-tested, not assumed.
* Every phase's screens must pass the mobile-taste Section 14 pre-flight before the
  phase checkpoint counts as done.
