# Mobile AI Tells (the canonical catalog)

The signatures of AI-generated React Native apps. Binary bans with override paths, plus
a mechanical check where one exists. Shared by every skill in this suite: mobile-taste
cites it while building, mobile-design-review runs it as an audit, the redesign skills
use it as the findings source. Section references (6.2, 4.C, …) point into
`skills/mobile-taste/SKILL.md`.

## Contents
- [A. Visual (tells 1-12)](#a-visual)
- [B. Structural (tells 13-23)](#b-structural)
- [C. Navigational (tells 24-29)](#c-navigational)
- [D. Copy (tells 30-34)](#d-copy)
- [E. Motion & interaction (tells 35-40)](#e-motion--interaction)
- [F. Behavioral (tells 41+)](#f-behavioral)
- [The runnable grep checklist](#the-runnable-grep-checklist)

## A. Visual

1. **THE EMOJI ICON** - 🔥⚙️📊 in tab bars, buttons, empty states. → One icon family.
   Check: emoji regex over JSX text; count 0 unless brief is explicitly playful/social.
2. **THE INDIGO PIPELINE** - `#6366F1`/`#8B5CF6`/`#7C3AED` + `LinearGradient`
   headers/CTAs/onboarding (see 6.2). Check: grep the hex family + count
   `LinearGradient` usages (<= 1 per app).
3. **THE CARD-STACK SCREEN** - every screen = gray bg + white rounded shadowed cards.
   → Whitespace, hairlines, grouped lists. Check: > 3 card wrappers on a non-feed screen.
4. **THE ICON CHIP ROW** - every row/feature leads with a 40x40 tinted rounded square
   holding a colored icon. The single most recognizable RN slop signature. → Naked icons
   at fixed width, or none; tinted chips only for genuinely categorical color.
5. **THE DEAD SHADOW** - `shadowColor` block with no `elevation` (invisible on Android),
   or `elevation: 8` floating everything. → Elevation tokens (6.3). Check: grep
   `shadowColor` without sibling `elevation`.
6. **THE GRAY SOUP** - inline `#666`/`#888`/`#999` mixed per screen. → Token ramp.
   Check: grep inline hex in screen files; ~0 expected.
7. **THE FLOATING PILL** - full-width rounded-full CTA hovering at `bottom: 30`.
   → Safe-area-aware footer; decide inline vs sticky deliberately.
8. **STAT-TRIPLET HEADER** - home screen opens with 3 equal stat cards regardless of
   whether the numbers matter. → One hero metric, or none.
9. **BLURVIEW GLASS SPAM** - blur on cards/tab bars "for premium feel". → Blur only over
   media/overlays (6.3).
10. **BADGE CONFETTI** - status pills and "NEW" tags on every row. → Pills carry real
    state; max one per row.
11. **THE OVERSIZED RADIUS** - borderRadius 20-24 on everything including inputs.
    → Shape lock (6.3).
12. **PASTEL INITIALS AVATARS everywhere** → real image sources with blurhash, or one
    deliberate avatar style.

## B. Structural

13. **SCROLLVIEW-OF-MAP** - `<ScrollView>{items.map(…)}</ScrollView>` for unbounded
    data. → FlashList/FlatList. Check: grep `ScrollView` containing `.map(` - every hit
    is triaged, not auto-fixed: a bounded static map (7-day strip, 3 fixed options) is
    fine; unbounded data is a hard fail.
14. **THE MAGIC PADDING-TOP** - `paddingTop: 50`, `StatusBar.currentHeight` hacks.
    → Safe-area insets. Check: grep `paddingTop: [4-6][0-9]`.
15. **CHEVRON EVERYWHERE** - chevron-right on non-navigable rows and rows with switches.
    → Chevron = "tap pushes a screen", nothing else. Check: chevron count == pushing-row count.
16. **THE HAND-ROLLED MODAL** - absolutely-positioned View + backdrop + useState.
    → Router modal route or bottom sheet.
17. **THE WEB NAVBAR** - hamburger + logo + links row on a phone; drawer as consumer
    primary nav. → Tabs + native headers.
18. **FIXED-PIXEL LAYOUT** - `width: 350` breaking on small devices. → Flex.
19. **THE 30PT TAP TARGET** - bare 24px icon Pressable. → 44pt + `hitSlop`.
20. **KEYBOARDAVOIDING ROULETTE** - wrong `behavior`, missing `keyboardVerticalOffset`,
    or nothing; submit hidden behind keyboard. → Keyboard skeleton (skeletons.md).
21. **SETTINGS AS FLAT TEXT LIST** (or every setting its own card) → grouped sections,
    destructive actions last in red.
22. **THE POSTER SCREEN** - `justifyContent: 'center'` on data screens. → Top-aligned;
    centered is for empty/auth/interstitial.
23. **EDGE-TO-EDGE AMNESIA** - content under home indicator / Android nav bar.
    → Bottom insets on every scrollable.

## C. Navigational

24. **FIVE-TABS-PLUS-FAB BY DEFAULT** - Home/Search/+/Alerts/Profile regardless of app.
    → Tabs from actual top-level destinations (4.C).
25. **THE LOGOUT TAB / SETTINGS TAB** → behind profile.
26. **ONBOARDING-AS-STATE** - conditional renders instead of route groups. → `(auth)` swap.
27. **THE MANUAL BACK BUTTON** - `"< Back"` text in content duplicating the header back.
    → Native header back; custom only in fullscreen media.
28. **NESTED TAB BARS / DOUBLE HEADERS** → one header owner; flatten.
29. **STRINGLY-TYPED NAV** - ad-hoc `navigate('Details')` with no typed routes when
    Expo Router typed routes exist. → File-based tree IS the nav.

## D. Copy

30. **"WELCOME BACK, JOHN! 👋"** → content-first home; greeting only if personalization
    IS the product.
31. **THE THREE-SLIDE ONBOARDING** - illustration + headline + dots + Skip, three
    near-identical slides. → Onboarding earns each screen: value demo, personalization
    question, or permission prime - else straight to content.
32. **ALERT.ALERT() FOR EVERYTHING** → destructive confirmations only (6.4). Check: grep
    `Alert.alert`.
33. **EXCLAMATION ONBOARDING VOICE** + em-dashes + Jane Doe + Acme + fake-precise
    numbers → copy rules (6.7).
34. **PLACEHOLDER-AS-LABEL FORMS** + missing `keyboardType`/`textContentType`/`autoComplete`
    → Section 5. Check: every email/phone/name input has matching props.

## E. Motion & interaction

35. **THE OPACITY FLASH** - default `TouchableOpacity` everywhere, or `Pressable` with
    zero feedback. → PressableScale skeleton; ripple on Android.
36. **JS-THREAD ANIMATION** - `useNativeDriver: false`, `useState`+`onScroll`. → Section 8.
    Check: grep `useNativeDriver: false` - hard fail.
37. **SPINNER-ONLY LOADING** → skeletons for content (6.4).
38. **THE MISSING STATES** - no empty/error/offline/refresh on feeds. → Full cycle (6.4);
    offline N/A allowed for declared local-first apps.
39. **HAPTIC SPAM** - impact on every tap. → Haptics vocabulary (6.5).
40. **DECORATIVE ENTRANCE ON EVERY ELEMENT** - FadeInDown on all things, replaying in
    recycled cells. → Motion rules (Section 7).

## F. Behavioral

41. **THE DEAD SETTING** - a settings control that renders and toggles but is persisted
    nowhere and consumed by nothing (the LLM generated the row, not the feature).
    → Every setting traces to a read site, or it doesn't ship. Check: for each settings
    state variable, grep for a second reference outside the settings screen.
42. **DESTRUCTIVE RESIDUE** - "erase all data" / "delete account" clears the store but
    leaves side effects alive: scheduled notifications, cached images, keychain tokens,
    analytics identity. → Destructive actions enumerate and clear their side effects.
    Check: grep the delete/erase handler for the subsystems the app initializes
    (Notifications, storage, auth) - each one initialized must appear in teardown.

## The runnable grep checklist

Run from the project root; screens assumed under `app/` and `components/`. Every skill
that audits or ships code runs this block literally and triages hits (a hit is a lead,
not automatically a failure - the tell entries above say which are hard fails).

```bash
# tell 33 / copy rules: em- and en-dashes in visible strings
grep -rn "—\|–" app/ components/ --include="*.tsx"
# tell 1: emoji in JSX
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' app/ components/ --include="*.tsx"
# tell 2: indigo pipeline + gradient count (LinearGradient > 1 = triage)
grep -rniE "#(6366F1|7C3AED|8B5CF6)" app/ components/
grep -rn "LinearGradient" app/ components/ --include="*.tsx" | wc -l
# tell 6: inline hex in screens (token files exempt)
grep -rnE '#[0-9a-fA-F]{6}' app/ --include="*.tsx" | grep -v -i "token\|theme"
# tell 13: ScrollView-of-map (file-level sweep - the map is often >3 lines from the
# tag; open each hit file and check what the ScrollView actually wraps)
grep -rl "<ScrollView" app/ components/ --include="*.tsx" | xargs grep -l "\.map(" 2>/dev/null
# tell 14: magic top padding
grep -rnE "paddingTop: [4-6][0-9]" app/ components/
# tell 36: JS-thread animation (hard fail)
grep -rn "useNativeDriver: false" app/ components/
# tell 32: Alert.alert (allowed: destructive confirms only)
grep -rn "Alert.alert" app/ components/ --include="*.tsx"
# tell 5: shadow without elevation (inspect each hit's style object)
grep -rn "shadowColor" app/ components/ --include="*.tsx"
# gestures/sheets used → root view must exist exactly once
grep -rn "GestureHandlerRootView" app/
```

## Growing this catalog

New tells come from observation: generate an app, spot a recurring signature, add it
here as a named binary ban + correct alternative + grep when one exists. Keep numbering
stable (append, don't renumber) - blocks and skills cite tells by number.
