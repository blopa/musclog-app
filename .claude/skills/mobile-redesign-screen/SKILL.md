---
name: mobile-redesign-screen
description: Audit-first redesign of ONE React Native screen (or one flow of 2-3 screens) - extract its current tokens and patterns, produce rated findings, then modernize it lever by lever with atomic commits and before/after screenshots. Preserves navigation, route names, and form semantics. Use when asked to redesign, refresh, modernize, or "make nicer" a specific existing screen. For whole-app redesigns use mobile-redesign-app; for a report without changes use mobile-design-review; for brand-new screens use mobile-taste.
---

# mobile-redesign-screen: One Screen, Audit First

Scope: one screen, or one tight flow (2-3 screens sharing a job). More than that is
mobile-redesign-app.

Method files, read in full first: `../_shared/references/redesign-protocol.md` (audit,
levers, fix loop, risk governor) and `../_shared/references/review-rubric.md` (finding
format). `../_shared/references/tells.md` supplies the findings vocabulary.

## Flow

1. **Stack sniff + audit** (redesign-protocol.md): the screen's current tokens or
   inline styles, its dial reading, its place in the route tree, signature
   interactions, accessibility wins. Screenshot the BEFORE state if a device/preview is
   reachable.
2. **Mode.** Preserve vs overhaul - ask once if ambiguous.
3. **Findings** for this screen only, rated high/medium/polish.
4. **Propose the pass.** Which levers (type/spacing → color-to-tokens → states →
   feedback/motion → recomposition), which findings each closes, what will NOT change.
   One short message; proceed on approval or if the user already said "just do it".
5. **Fix loop** (redesign-protocol.md): one finding per atomic commit, before/after
   pair per visual change, risk governor (stop > 20%, cap 20 fixes).
6. **Close out.** Findings closed vs remaining, the before/after pairs, and - if
   `design-baseline.json` or `MOBILE-DESIGN.md` exist - refresh them (deltas noted).

## Hard boundaries

* **Never changes:** route name, deep link, position in the nav tree, form field
  semantics, learned gestures. If a finding requires one of those, report it as
  OUT-OF-SCOPE with a pointer to mobile-redesign-app.
* **Blocks-first:** if the screen is an archetype (settings, feed, auth, paywall, empty
  state), diff it against the matching `../_shared/blocks/` block and prefer converging
  toward the block over inventing a third pattern.
* **No scope creep:** components shared with other screens get changed only when the
  change is invisible elsewhere or the user approves the blast radius; the risk
  governor's +5%/file makes this expensive on purpose.
* The screen must still pass the mobile-taste Section 14 pre-flight when done - a
  redesigned screen that fails pre-flight is not done.
