---
name: mobile-design-review
description: Audit an existing React Native / Expo app's design - run the AI-tells grep checklist, inspect screens against a ten-category rubric, Trunk Test each screen, and produce impact-rated findings with a Design Score and an AI Slop Score plus a regression baseline. Report-only by default; opt-in fix mode. Use when asked to review, audit, critique, or QA an app's design or UI quality. For building new screens use mobile-taste; for actually redesigning use mobile-redesign-screen or mobile-redesign-app.
---

# mobile-design-review: Audit, Score, Baseline

Report-only by default. `--fix` (or the user asking you to fix what you find) enables
the fix loop. Never both silently.

The method is `../_shared/references/review-rubric.md` (passes, narration, Trunk Test,
finding format, ten categories, scoring math, baseline file) and
`../_shared/references/tells.md` (the grep checklist + tell catalog). Fix
recommendations cite `../_shared/references/redesign-protocol.md` (lever order) and
sections of `../mobile-taste/SKILL.md`. Read all four before starting.

## Flow

1. **Stack sniff.** `package.json` / `app.json` / theme files / `MOBILE-DESIGN.md` /
   `design-baseline.json`. If a baseline exists, this run is a REGRESSION run - deltas
   lead the report.
2. **Scope.** Whole app by default; a named screen/flow if the user scoped it. List the
   screens you will cover (from the route tree) so coverage is explicit.
3. **Static pass** (always): the tells.md grep block, then code inspection per the ten
   rubric categories. Triage every hit.
4. **Live pass** (when reachable): simulator/emulator → Expo web phone-viewport →
   user-provided screenshots, in that order. Per screen: screenshot, first-impression
   narration, Trunk Test, touch targets, dark mode + large fonts when practical. If
   nothing is reachable, say so and continue static-only.
5. **Findings.** review-rubric.md format: `FINDING-NNN [impact | category]`, evidence,
   tell number when it maps, concrete fix.
6. **Scores.** Design Score + AI Slop Score per the mechanical letter math. Per-category
   letters in a table. No rounding up.
7. **Baseline.** Write/refresh `design-baseline.json`. On a regression run, the delta
   table (category changes, new, resolved) comes FIRST.
8. **Report.** Narrations, Trunk Test results, findings by impact, scores, the
   explicit unverified list ("no device reachable: keyboard, splash, scroll perf, font
   scale, edge-to-edge NOT verified"), and - report-only mode - a recommended fix order
   (the modernization-lever order from `../_shared/references/redesign-protocol.md`).

## Fix mode (opt-in only)

Runs the fix loop from redesign-protocol.md: one finding per atomic commit
(`style(design): FINDING-NNN ...`), before/after screenshots when a live pass exists,
re-check to close, **risk governor** (stop > 20%, hard cap 20 fixes), findings marked
`fixed` in the baseline. Constraints:
* Never touches navigation structure, route names, deep links, tab order, token names,
  or form field semantics - those are redesign-skill territory and approval-gated there.
* High-impact findings first, then medium; polish only if the user asked for polish.
* Stopping at the governor is a success state: report fixed / remaining / risk math.

## Rules that bind this skill

* Report-only means ZERO app-file edits. The one sanctioned write is
  `design-baseline.json` (the review's own artifact); skip even that if the user asked
  for zero writes and inline the JSON in the report instead.
* Every score follows the math; every dismissed grep hit gets its one-line reason.
* If the project declares design commitments - `MOBILE-DESIGN.md`, or any equivalent
  committed design doc - findings also flag DRIFT from them (a declared accent used
  inconsistently, a Nav Read the code no longer matches). Name the doc you used.
