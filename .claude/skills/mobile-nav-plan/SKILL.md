---
name: mobile-nav-plan
description: Turn an app idea or an existing React Native app into a Nav Read - tab structure, route tree, push/modal/sheet decisions, deep links, Android back plan - without building any screens. Use when planning navigation for a new app, restructuring an existing app's navigation, or deciding whether something is a tab, a push, a modal, or a bottom sheet. For building the screens afterward use mobile-taste; for full-app visual redesign use mobile-redesign-app.
---

# mobile-nav-plan: Navigation Architecture, Nothing Else

Navigation is information architecture. This skill produces a **Nav Read** - a committed
route tree that doubles as the Expo Router `app/` directory plan - and stops. No screen
code.

The method lives in `../_shared/references/navigation.md` (container decision tree,
Expo Router conventions, mechanical checks, three worked examples). Tells cited by
number (#24 etc.) live in `../_shared/references/tells.md`. Read both in full before
producing the Nav Read.

## Flow

1. **Stack sniff.** In an existing project, read `package.json` / `app.json` / the
   current `app/` (or navigator) tree, and `MOBILE-DESIGN.md` if present. In a
   greenfield conversation, skip to 2.
2. **App Read essentials.** App kind, audience, target platforms + tier, platform
   posture (one line - the full App Read belongs to mobile-taste). If the app kind is
   genuinely ambiguous, ask ONE question.
3. **Enumerate the jobs-to-be-done.** List the user's recurring destinations and the
   create/edit tasks BEFORE picking containers. Tabs come from this list, never from
   the Home/Search/+/Alerts/Profile template (tell #24).
4. **Run the decision tree** (navigation.md §2) over every screen: tab root → push →
   modal → bottom sheet → full-screen modal, first match wins.
5. **Emit the Nav Read** in the canonical format (navigation.md §1): platforms, tabs,
   route tree with container annotations, entry points, sheets (or "none"), deep links,
   Android back plan, max-taps line.
6. **Justify the contentious calls** - one sentence each for: the tab count, the FAB
   decision (its presence, or its ABSENCE when the app has create actions), any
   full-screen modal, any BackHandler exception, and every screen that is a sheet
   rather than a modal.
7. **Self-check** against the mechanical list (navigation.md §4). Report any rule the
   plan bends and why.
8. **Persist.** Offer to write the Nav Read into `MOBILE-DESIGN.md` (create or refresh
   the `## Nav Read` section, reporting the delta if one existed). For an existing app,
   also emit the DIFF between the current route tree and the proposed one, flagging
   every change that hits the never-change-silently list
   (`../_shared/references/redesign-protocol.md`): route names, deep links, tab order.

## Rules that bind this skill

* Restructuring an existing app's navigation is a PROPOSAL - implementation belongs to
  mobile-redesign-app after approval.
* No screen mockups, no component code. The single artifact is the Nav Read (plus the
  optional empty route-file scaffold if the user asks for it: `_layout.tsx` files and
  empty screens matching the tree, nothing inside them).
* Cite the decision-tree step for every container choice. "It felt right" is not a
  rationale.
