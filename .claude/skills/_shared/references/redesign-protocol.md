# Redesign Protocol

The shared method for `mobile-redesign-screen` and `mobile-redesign-app`. Audit first,
change in priority order, govern the blast radius mechanically.

## Contents
- [Mode detection](#mode-detection)
- [The audit](#the-audit)
- [Never change silently](#never-change-silently)
- [Modernization levers (priority order)](#modernization-levers-priority-order)
- [The fix loop](#the-fix-loop)
- [The risk governor](#the-risk-governor)

## Mode detection

**Preserve** - modernize within the existing brand (default when the app has real
users). **Overhaul** - new visual language, keep IA and content. If ambiguous, ask
once: "Should this keep the current brand feel, or start visually fresh?"

## The audit

Run the review-rubric.md static pass (plus live pass when reachable) BEFORE proposing
anything. Additionally document, as the redesign's starting state:

- **Theme tokens** - colors, type scale, radii, elevation, where they live (or "none:
  inline styles throughout", which is itself the first finding)
- **Navigation structure** - tab order, route names, deep-link paths, container choices
- **Dial reading of the existing app** - infer its current EXPRESSION / MOTION / DENSITY;
  that is the starting point, not the skill baseline
- **Platform posture** - unified-brand vs per-platform, and whether it's consistent
- **Signature interactions** - anything users have learned that must survive
- **Accessibility wins** - labels, Dynamic Type support, contrast already correct: do
  not regress these

## Never change silently

Require explicit user approval before touching:
- Tab order, tab icons, route names, or deep-link paths
- Theme token NAMES consumed elsewhere (change values freely in overhaul mode)
- Form field semantics (`textContentType`/`autoComplete`/names - autofill and analytics
  depend on them)
- Learned gesture shortcuts
- Anything the audit marked as a signature interaction

`mobile-redesign-app` is the only skill in this suite allowed to PROPOSE navigation
restructuring, and it ships only after approval. `mobile-redesign-screen` never does.

## Modernization levers (priority order)

Apply in order; stop when the brief is satisfied. Each lever is a separate commit series.

1. **Type scale + spacing rhythm** - biggest visual lift per unit of risk
2. **Color recalibration onto semantic tokens** - one gray ramp, one accent, dark mode
   if missing
3. **State completeness** - skeletons, empty, error, offline, refresh
4. **Press feedback + motion layer** - PressableScale/ripple, motion hierarchy
5. **Screen recomposition** - kill card-stacks, fix grouping, header ownership
6. **Navigation restructure** - LAST, approval-gated, app-scope skill only

## The fix loop

Per finding, smallest first within the active lever:
1. Fix exactly one finding.
2. Commit atomically: `style(design): FINDING-012 feed offline state`.
3. When a live pass is available: before/after screenshot pair per visual finding.
4. Re-run the relevant grep/check to confirm the finding is closed; mark it `fixed` in
   `design-baseline.json`.
5. Every 5 fixes, recompute the risk governor.

## The risk governor

Autonomous redesign must not run away. Track a running risk percentage:

- +15% for every fix that had to be reverted or re-done
- +5% for every file touched beyond the screen(s) in scope
- +20% the first time a change touches a file unrelated to any finding
- −5% for every 5 consecutive clean fixes (floor 0%)

**STOP and report at > 20% risk.** Hard cap regardless of risk: **20 fixes per run**
(`mobile-redesign-screen`) / **40 per run** (`mobile-redesign-app`). Stopping is a
success state: report what was fixed, what remains, and the current risk math.
