---
name: mobile-taste
description: Anti-slop design skill for BUILDING React Native / Expo apps (iOS, Android, web). Commits to an App Read and Nav Read before writing code; ships screens, navigation, and motion that do not look AI-generated. Use when creating new screens, features, or apps in React Native. For auditing an existing app use mobile-design-review; for upgrading existing screens use mobile-redesign-screen or mobile-redesign-app; for navigation planning alone use mobile-nav-plan; for tokens/theming use mobile-design-system.
---

# mobile-taste: Anti-Slop React Native Skill

> Cross-platform mobile apps: screens, navigation, components, motion. Not marketing
> websites (use the original taste-skill), not games, not native modules.
> Every rule below is **contextual**. None of it fires automatically. Read the brief,
> then pull only what fits.

**Sibling skills** (this suite splits by task): `mobile-design-review` (audit an
existing app), `mobile-redesign-screen` / `mobile-redesign-app` (upgrade existing UI),
`mobile-nav-plan` (navigation architecture alone), `mobile-design-system` (tokens +
theme). This skill BUILDS.

Deeper references, load on demand:
- `../_shared/references/navigation.md` - navigation decision tree, Expo Router conventions, worked Nav Reads
- `../_shared/references/skeletons.md` - canonical Reanimated/gesture code for the patterns LLMs botch
- `../_shared/references/tells.md` - the full slop-tell catalog (append-only) + runnable grep checklist
- `../_shared/references/versions.md` - ALL version-sensitive facts (SDK pairings, package majors). Nothing in this file names a version on purpose.
- `../_shared/blocks/` - proven screen-pattern implementations (schema in Section 12)

---

## 0. THE APP READ (Read the Room Before Anything Else)

Before touching code, **infer what the user actually wants**. Most LLM mobile output is
bad because the model jumps to a default template (indigo gradient, 5 tabs, card stacks)
instead of reading the room.

### 0.0 Stack sniff (before the read, in an existing project)
Read `package.json`, `app.json`, and any tailwind/theme config FIRST. Detect: Expo SDK,
router (Expo Router vs React Navigation), styling (NativeWind vs StyleSheet vs Tamagui vs
Paper), icon family, existing theme tokens, and whether `MOBILE-DESIGN.md` exists (0.E) -
if it does, read it and treat its commitments as standing. The detected stack wins over
every default in this skill. First-generation code that imports the wrong styling system
is a total loss; thirty seconds of sniffing prevents it.

### 0.A Read these signals first
1. **App kind** - consumer social, utility/tool, fitness/health, fintech, e-commerce,
   content/media, productivity, kids, field/ops tool.
2. **Vibe words** - "clean", "playful", "premium", "iOS-native feel", "like Airbnb",
   "dense/pro", "calm", "brandy".
3. **Reference apps** the user named. Real apps are the design language on mobile the way
   reference sites are on web.
4. **Audience & context of use** - one-handed on a train vs. two-handed on a couch vs.
   gloved hands in the field. Context picks density and target sizes, not your taste.
5. **Target platforms** - iOS / Android / web, and which is first-class.
6. **Quiet constraints** - accessibility-first users, kids (larger targets, no dark
   patterns), regulated (fintech/health disclosure patterns), offline-heavy usage.

### 0.B Output the App Read before generating

```
APP READ: <app kind> for <audience>, <vibe> language, leaning <design language / stack>.
platforms: iOS first-class · Android first-class · web best-effort
posture: unified-brand | iOS-first | Android-first | per-platform-native
```

Example: *"APP READ: habit-tracking utility for busy professionals, calm minimal language,
leaning NativeWind + native chrome. platforms: iOS + Android first-class, web none.
posture: unified-brand."*

The **platform posture** is a commitment: `per-platform-native` means components diverge
(SF Symbols vs Material icons, iOS switches vs Material switches); `unified-brand` means
one look everywhere with native navigation chrome underneath.

### 0.C If the brief is ambiguous, ask ONE question, do not guess
Only when the read genuinely diverges (e.g. *"Should this feel iOS-native like Things, or
branded like Duolingo?"*). If you can infer confidently, declare the read and proceed.

### 0.D Anti-Default Discipline
Do not default to: indigo/violet gradients, 5-tab bar with a center FAB, every screen a
stack of white rounded cards, emoji as icons, three-slide illustrated onboarding,
"Welcome back, John! 👋". These are the LLM defaults. Reach past them deliberately.

### 0.E MOBILE-DESIGN.md (the durable artifact)
The App Read, Nav Read, dial values, and design tokens are commitments, not chat
ephemera. Once settled, write them to `MOBILE-DESIGN.md` at the project root and treat
it as the design source of truth: later sessions (and other agents) read it before any
UI decision; a re-run REFRESHES it and reports what changed rather than regenerating
from scratch. Screens 3, 4, and 5 drifting into a different app is what this file
prevents. (The `mobile-design-system` skill writes the token sections; this skill writes
the reads and dials.)

---

## 1. THE THREE DIALS

After the App Read, set three dials. Layout, motion, and density decisions below are
gated by these.

* **`DESIGN_EXPRESSION: 4`** - 1 = strictly platform-native, 10 = fully custom branded
* **`MOTION_INTENSITY: 4`** - 1 = native transitions only, 10 = gesture-driven physics everywhere
* **`VISUAL_DENSITY: 4`** - 1 = airy consumer, 10 = pro-tool cockpit

**Baseline `4 / 4 / 4`.** Mobile baselines sit lower than web: convention is a feature on
phones. Override from the brief, conversationally.

### 1.A Dial inference

| Signal | EXPRESSION | MOTION | DENSITY |
|---|---|---|---|
| "iOS-native / clean / like Apple Notes, Things" | 1-3 | 2-3 | 3-4 |
| "utility / tool / just works" | 3-4 | 3-4 | 4-5 |
| "consumer social / content feed" | 5-7 | 5-7 | 4-5 |
| "brandy / playful / Duolingo-like / kids" | 7-9 | 6-8 | 2-4 |
| "premium / luxury / fashion commerce" | 7-9 | 5-7 | 2-3 |
| "pro tool / trading / ops / data-heavy" | 3-5 | 2-3 | 7-9 |
| "fintech (consumer)" | 4-6 | 3-5 | 4-6 |

### 1.A2 Category bias (per app kind: prefer / avoid)

| App kind | Prefer | Avoid |
|---|---|---|
| Fintech | numeric clarity (tabular figures, mono for amounts), trust neutrals, explicit states for money-moving actions | playful mascots, gradient balance cards, decimals that jiggle during animation |
| Health / fitness | one hero metric per screen, generous type, encouraging-but-plain copy | stat-triplet dashboards, red as a progress color, streak-guilt patterns |
| Consumer social | content-first (media IS the UI), fast feeds, quiet chrome | heavy cards around every post, engagement-bait badges |
| E-commerce | product photography breathing room, sticky clear price+CTA, honest urgency only | badge confetti, countdown timers, cluttered product cards |
| Productivity / tools | density over decoration, keyboard-first flows, instant interactions | onboarding tours, illustration empty states on every view, celebration modals |
| Kids | larger targets (>= 56pt), high contrast, zero dark patterns | tiny icon buttons, ad-adjacent layouts, infinite-scroll mechanics |

### 1.E The signature element
Each screen gets AT MOST one bold move - a distinctive header treatment, one signature
interaction, one expressive component. Everything else stays quiet and native-feeling.
Spend the boldness budget in one place; a screen where everything is expressive reads as
noise, and an app whose every screen shouts has no voice at all. This is the
screen-level restatement of CHROME LAGS CONTENT (1.C).

### 1.B DESIGN_EXPRESSION bands (operational)
* **1-3 Platform-native:** system fonts, native headers and tab bar, platform components
  and pickers, platform-divergent by default (posture usually `per-platform-native`).
* **4-7 Branded-native:** custom color/type tokens and custom content components;
  navigation chrome (headers, tab bar, transitions) remains native.
* **8-10 Fully custom:** custom tab bar, custom transitions, brand fonts everywhere,
  unified look across platforms. You now own every safe-area inset, press state, and
  accessibility role the native chrome was giving you for free.

### 1.C CHROME LAGS CONTENT (mandatory)
Navigation chrome stays native until `DESIGN_EXPRESSION >= 8`, even when content styling
is fully branded. A custom-painted tab bar with broken safe areas and no press states is
the most common failure of "expressive" AI apps. Brand the content first; earn the chrome.

### 1.D Hard floors (dials never override these)
* Touch targets >= 44pt survive `VISUAL_DENSITY: 10`.
* Reduced motion is honored above `MOTION_INTENSITY: 3`.
* Animations run on the UI thread at every motion level (Section 8).

---

## 2. BRIEF → STACK MAP

Pick the foundation from the brief. Check the project's existing `package.json` FIRST -
an existing stack wins over every default below.

| Brief reads as… | Reach for | Why |
|---|---|---|
| Cross-platform brandable app (default) | Expo + Expo Router + NativeWind + React Native Reusables | Tailwind-syntax styling, shadcn-style owned components, file-based navigation |
| Material / Android-first product | React Native Paper (Material 3) | Official-quality M3 components and theming |
| iOS-native feel | Native chrome + system fonts + SF Symbols (`expo-symbols`), minimal styling layer | HIG fidelity beats any component library |
| Perf-critical custom design system | Tamagui | Compiler-optimized tokens and variants |
| Conservative / no build-tooling appetite | Plain `StyleSheet.create` + React Navigation | Zero magic, every RN dev reads it |
| Legacy Draftbit v1 app | `@draftbit/ui` (Jigsaw) | Match the existing component system |

**Honesty rules (port from taste-skill, verbatim in spirit):**
* Before importing ANY 3rd-party library, check `package.json`. If missing, output the
  install command (`npx expo install …` so the SDK-compatible version resolves) before the code.
* One component system per app. Do not mix Paper with Reusables in the same tree.
* One icon family per app. Do not mix SF Symbols, Material icons, and Lucide.
* If you approximate a platform pattern (e.g. iOS large-title header in a custom
  component), label it as an approximation in a comment.

---

## 3. DEFAULT ARCHITECTURE & CONVENTIONS

Unless the stack map picks otherwise:

* **Framework:** Expo + TypeScript. File-based navigation with Expo Router (`app/` dir).
* **Styling:** NativeWind (Tailwind syntax). Design tokens (colors, type scale, radii) in
  the Tailwind config / theme file - **zero inline hex values in screen files**.
* **Lists:** FlashList (or FlatList) for anything unbounded. `ScrollView` only for
  fixed, short content. See versions.md for FlashList-version specifics.
* **Images:** `expo-image` with `placeholder` (blurhash) and `recyclingKey` in list cells.
* **Safe areas:** `react-native-safe-area-context` (`useSafeAreaInsets`). Never hardcoded
  status-bar paddings.
* **Icons:** ONE family via `@expo/vector-icons`, Lucide RN, or Phosphor RN - or
  `expo-symbols` for iOS-native posture. Standardize size and stroke weight globally.
  **Never emoji as icons. Never hand-drawn SVG icon paths.**
* **Fonts:** system fonts by default (see 6.1). Custom fonts via `expo-font` /
  `@expo-google-fonts`, loaded before splash hide.
* **Animation:** Reanimated + Gesture Handler. `GestureHandlerRootView` once at the root.
* **Haptics:** `expo-haptics`, using the vocabulary in 6.5. Never on plain navigation taps.
* **Layout mechanics:** flexbox only (there is no CSS Grid in RN). `gap` over margin
  chains. Fixed pixel widths/heights only for icons and avatars - screens flex.

---

## 4. NAVIGATION ARCHITECTURE

Navigation is designed BEFORE screens. Full decision tree, Expo Router conventions, and
worked examples: `../_shared/references/navigation.md`. The non-negotiables live here.

### 4.A The Nav Read (emit before any code)
A structured route tree that doubles as the `app/` directory plan:

```
NAV READ
platforms: iOS + Android (web: best-effort)
tabs (4): Today · Search · Library · Profile
app/
  (auth)/sign-in, sign-up            fullscreen group, swapped on session
  (tabs)/
    index        Today       → push workout/[id]
    search       Search      → push workout/[id]
    library      Library     → push collection/[id] → workout/[id]
    profile      Profile     → push settings, settings/units
  new-workout                        modal (pageSheet), max 1 internal step
  player/[id]                        fullscreen modal, custom dismiss
entry points: settings ← gear (Today header) · new-workout ← + (Library header)
sheets: workout-options, filter      (write "sheets: none" when there are none)
deep links: /workout/:id, /collection/:id
android back: default pop everywhere; new-workout confirms discard
max taps to any core screen: 2
```

### 4.B Container decision tree (evaluate in order)
1. Top-level destination the user returns to repeatedly, peer of other destinations,
   independent state? → **Tab root**.
2. Drill-down with a clear parent (list → detail, settings → sub-setting)? → **Push**.
3. Self-contained create/edit task that returns when done (compose, filters, edit
   profile)? → **Modal** (iOS `pageSheet` default).
4. Parent context must stay visible; lightweight choice, preview, or action menu; less
   than one screen of content, no internal navigation? → **Bottom sheet**. The moment a
   sheet needs its own back stack, it should have been a modal.
5. Immersive or blocking (camera, media viewer, paywall, onboarding, auth)? →
   **Full-screen modal / route group**.

### 4.C Navigation hard rules
* **Tabs: 3-5.** Two destinations → no tab bar. Six → your IA is wrong, not your tab bar.
  Labels always visible, one word each.
* **No Settings tab, no Logout tab.** Settings lives behind profile; logout inside settings.
* **Center FAB** only when creation is THE core action - and then tab count <= 4, and
  justify it in the Nav Read.
* **No nested tab bars. No double headers.** One header owner per screen.
* **Android back = header back.** No `BackHandler` overrides except discard-confirmations
  declared in the Nav Read.
* **Every modal has an explicit close affordance** (X or Cancel). Swipe-to-dismiss alone fails.
* **Auth/onboarding are route groups** (`(auth)` swap on session), not conditional renders
  inside screens.
* **Every detail screen is deep-linkable** (a route file with params) and lands with a
  sane back stack.
* **Drawers** are for large secondary catalogs (Gmail-class), never primary nav for a
  consumer app, and never a hamburger hiding 4 destinations that should be tabs.
* A screen that opens more than 2 distinct bottom sheets is hiding IA in sheets.

---

## 5. SCREEN ANATOMY & LAYOUT DISCIPLINE

* **Safe areas:** top inset owned by the navigator header when there is one; otherwise
  `useSafeAreaInsets()`. Bottom of every scrollable:
  `contentContainerStyle={{ paddingBottom: insets.bottom + <spacing> }}`. Never
  `paddingTop: 50`-style magic numbers.
* **Header ownership:** the navigation header owns the screen title. Do not repeat the
  title as an in-content `<Text>` heading below a header that already shows it.
* **Touch targets:** >= 44x44pt effective. Small glyphs get `hitSlop`. Row height >= 44pt.
* **Thumb zone:** primary actions live in the bottom half of the screen; destructive or
  rare actions can live at the top. Sticky footer CTAs are safe-area-aware, not
  `bottom: 30`.
* **Spacing grid:** 4/8pt scale (4, 8, 12, 16, 24, 32). Screen horizontal padding 16
  (dense) or 20 (airy) - pick once, lock it.
* **Vertical composition:** content is top-aligned. `justifyContent: 'center'` is for
  empty states, auth, and interstitials ONLY - data screens jump when content grows.
* **Lists:** consistent row heights; `numberOfLines` on every dynamic text; pull-to-refresh
  (`RefreshControl`) on every feed; virtualized past ~20 items.
* **Keyboard:** every screen with inputs handles the keyboard deliberately (canonical
  skeleton in skeletons.md). The submit button must be visible with the keyboard open.
* **Text inputs:** label above input; correct `keyboardType`, `textContentType` /
  `autoComplete` on EVERY input (email keyboard for email, autofill for names/addresses).
  No placeholder-as-label. Error text below input.

---

## 6. DESIGN ENGINEERING DIRECTIVES (Bias Correction)

### 6.1 Typography
* **System fonts are a respectable default on mobile.** SF Pro and Roboto are the
  opposite of a tell - they are what quality apps use. This INVERTS the web skill's
  Inter ban. Custom fonts must earn their place: max 1-2 families, loaded pre-splash-hide,
  proven against Dynamic Type.
* **The convergence trap:** when a custom font IS justified, do not converge on the
  "safe custom" defaults every AI reaches for - Poppins, Nunito, generic geometric
  rounded sans (the mobile equivalents of web's Space Grotesk trap). Pick from the
  brief's actual character, and vary across projects.
* **Type scale from tokens**, not per-screen `fontSize` literals. A screen needs at most:
  display (rare), title, body, caption. Do not open every screen with
  `fontSize: 32 / fontWeight: '700'` + gray subtitle - that identical rhythm on every
  screen is a template tell.
* **Dynamic Type is bidirectional:** support scaling AND bound it -
  `maxFontSizeMultiplier` ~1.3-1.5 on custom chrome text (buttons, custom headers),
  unbounded on body text. Native-owned chrome (navigator tab labels, native headers)
  exposes no such prop - that scaling is verified on-device (14.C), not in code.
* **Android quirks:** `includeFontPadding: false` and explicit `lineHeight` on display type.

### 6.2 Color Calibration
* Max 1 accent color, saturation < 80% by default. Neutral base ramp (one gray family -
  never warm and cool grays in one app) defined in the theme file.
* **THE INDIGO PIPELINE BAN:** `#6366F1` / `#8B5CF6` / `#7C3AED` + `LinearGradient`
  headers/CTAs/onboarding is THE AI-mobile signature. Banned as default. Override only
  when the brand is genuinely purple - then execute with intent, no gradient slop.
* **Gradients: max 1 per app** by default, and only with a compositional reason.
* **Dark mode from the start** via `useColorScheme` + semantic tokens
  (`background`, `surface`, `text-primary`, `accent`). Both modes tested before ship.
* **OLED exception:** pure `#000000` is a legitimate deliberate dark-mode choice on
  mobile (OLED). What is banned is pure black as an unconsidered default. Light mode
  still avoids pure black text (use near-black).
* **Color Consistency Lock:** one accent, used identically on every screen. Audit before
  shipping.

### 6.3 Surfaces, Elevation, Cards
* **Cards are not the only grouping tool.** Group with whitespace, hairline separators
  (`StyleSheet.hairlineWidth`), and grouped-list sections (iOS inset-grouped style).
  A card = a discrete, tappable, self-contained object. A screen that is a gray
  background with a stack of white rounded-2xl shadowed cards is the #1 AI-mobile layout.
* **Cross-platform elevation tokens:** define 2-3 levels ONCE (each level = iOS shadow
  props + Android `elevation` together). `shadowColor` without `elevation` is invisible
  on Android - never ship one without the other.
* **Shape Consistency Lock:** one radius scale (e.g. 8/12/16), applied by role. No
  borderRadius 24 on inputs next to radius 8 cards.
* **Blur (`expo-blur`)** only over media/overlays. Not on cards or tab bars "for premium feel".

### 6.4 Interactive States (full cycle, mandatory per data screen)
* **Loading:** skeletons that mirror the final layout for content screens; spinners only
  for button-level actions. Never a full-screen spinner covering the tab bar.
* **Empty:** composed, with the action that populates it. Centered is correct here.
* **Error:** inline for forms; retry affordance for content; toast/snackbar for transient.
* **Offline:** feeds and data apps get an offline banner + cached-content behavior.
  Applies only when a network layer exists - local-first apps declare "offline: N/A" in
  the App Read and the box is legally skipped.
* **Refreshing:** `RefreshControl` on feeds - distinct from initial loading.
* **`Alert.alert()` is for destructive confirmations only.** Not success, not errors,
  not information. Success = state change + optional haptic; errors = inline.

### 6.5 Haptics Vocabulary
Selection haptic for pickers/toggles; light impact for meaningful confirmations;
notification haptic for async outcomes (success/failure). **Never on plain taps or
navigation.** Haptic spam is the overcorrection tell.

### 6.6 Permission Priming (LLMs get this wrong ~100% of the time)
Never request a system permission on cold start or in a mount `useEffect`. Prime at the
moment of intent, with context, THEN request:

| Permission | Ask when |
|---|---|
| Notifications | after the first value moment (first task created, first order placed) |
| Location | when the user taps a location-dependent feature |
| Camera / Photos | when the user initiates capture/upload |
| Contacts | when the user opens an invite/share flow |

### 6.7 Copy & Content (ported from taste-skill - universal)
* **Em-dash (`—`) completely banned** in all visible strings. Hyphen or restructure.
* No "John Doe" / "Acme" / fake-perfect numbers (`99.99%`); realistic names, messy data.
* No filler verbs: "Elevate", "Seamless", "Unleash", "Supercharge".
* No exclamation-onboarding voice ("Let's get started! 🎉", "You're all set!").
* No "Welcome back, {name}! 👋" greeting headers unless personalization IS the product.
* **Copy self-audit before ship:** re-read every visible string; rewrite anything
  grammatically broken, referent-unclear, or LLM-cute.

---

## 7. MOTION

Canonical code for everything here: `../_shared/references/skeletons.md`. The rules:

* **The mobile motion hierarchy:** (1) navigation transitions - native, free, do not
  re-implement; (2) press feedback - every touchable, spring scale ~0.97; (3) state
  transitions - layout animations for insert/remove/reorder; (4) scroll-linked chrome -
  collapsing headers; (5) gesture-driven - sheets, swipeable rows. Ship them in that
  order; a screen with parallax but no press states has the priorities backwards.
* **Motion must be motivated** - hierarchy, feedback, state change, or storytelling. One
  sentence of justification or drop it.
* **Springs over timing curves** for interactive feedback. No linear easing.
* **Entering animations never run inside virtualized list cells unconditionally** -
  recycled cells replay animations mid-scroll. First-mount stagger on the first ~6 rows
  max, guarded by index.
* **Anti-skeletons (do NOT attempt by default):** shared-element transitions (no stable
  API - approximate with fade+scale and label it), custom pull-to-refresh
  (`RefreshControl` is the answer), manual tab-switch transitions (navigators own this).
* **Reduced motion:** `useReducedMotion` respected above `MOTION_INTENSITY: 3` -
  gestures still work, decorative motion collapses to instant.

---

## 8. PERFORMANCE GUARDRAILS

* **UI-thread animation only.** Reanimated worklets / native driver. `useNativeDriver:
  false` on transform/opacity is a hard fail. `useState` driven by `onScroll` is a hard
  fail - scroll position lives in a shared value.
* **Never read/write `.value` during render.** `runOnJS` for JS calls from worklets.
* **Virtualize** unbounded lists; memoize row components; stable `keyExtractor`.
* **`expo-image`** for caching + placeholders; `recyclingKey` in cells.
* **Splash continuity:** splash background = first screen background; fonts and initial
  data gated behind splash hide (no white flash, no font swap flash).
* **Re-render discipline:** contexts split by change frequency; list screens do not
  re-render on every keystroke of a distant input.

---

## 9. PLATFORM CONVENTIONS

* **Press feedback:** Android ripple (`android_ripple`) vs iOS opacity/scale - or one
  branded press style at `EXPRESSION >= 6` used consistently on both.
* **Pickers, date/time, switches, share:** system components by default
  (`EXPRESSION <= 7`). Custom pickers are a last resort.
* **Android:** gesture/hardware back parity (4.C); edge-to-edge with correct nav-bar
  insets; ripple bounded to the row.
* **iOS:** modals as `pageSheet` by default; destructive confirmations via ActionSheet;
  respect the home indicator.
* **Web (react-native-web):** hover exists ONLY as progressive enhancement - nothing may
  require it. Check FlashList/gesture library web support before relying on it (see
  versions.md). Add a max content width (~640-760px) for web layouts; a phone layout
  stretched to 1440px is broken design.
* **`Platform.select` taste:** platform forks live in tokens/components, not scattered
  through screen files.

---

## 10. MOBILE AI TELLS (Forbidden Patterns)

**Full tell catalog (append-only, 42 and growing) + runnable grep checklist:
`../_shared/references/tells.md`.**
Read it before shipping. The ten most-recognizable signatures, always in force:

1. **THE ICON CHIP ROW** - every row leads with a 40x40 tinted rounded square holding a
   colored icon. The #1 RN slop signature.
2. **THE INDIGO PIPELINE** - `#6366F1`-family + `LinearGradient` headers/CTAs (6.2).
3. **THE CARD-STACK SCREEN** - every screen a pile of white rounded shadowed cards (6.3).
4. **THE EMOJI ICON** - 🔥⚙️📊 in tab bars, buttons, empty states.
5. **FIVE-TABS-PLUS-FAB BY DEFAULT** - Home/Search/+/Alerts/Profile regardless of app (4.C).
6. **SCROLLVIEW-OF-MAP** - `<ScrollView>{items.map(…)}</ScrollView>` for unbounded data.
7. **THE MAGIC PADDING-TOP** - `paddingTop: 50` instead of safe-area insets (5).
8. **THE THREE-SLIDE ONBOARDING** - illustration + headline + dots + Skip, three
   near-identical slides.
9. **ALERT.ALERT() FOR EVERYTHING** - destructive confirmations only (6.4).
10. **"WELCOME BACK, JOHN! 👋"** - greeting-header home + exclamation onboarding voice (6.7).

Tells are cited by number throughout this suite; numbering lives in tells.md and is
append-only.

---

## 11. REDESIGNING EXISTING APPS

Redesign is its own discipline with its own skills - do not freelance it from here:

* **One screen** → the `mobile-redesign-screen` skill.
* **Whole app** → the `mobile-redesign-app` skill (the only skill allowed to propose
  navigation restructuring).
* **Audit without changing anything** → the `mobile-design-review` skill.

All three run on `../_shared/references/redesign-protocol.md` (audit checklist,
modernization levers, risk governor) and `review-rubric.md`. The one rule that also
binds THIS skill when touching existing code: **never change silently** - tab order,
route/deep-link paths, theme token names, form field semantics, learned gestures.

---

## 12. THE BLOCK LIBRARY (Contract)

`../_shared/blocks/<category>/<name>.md` - proven screen patterns. Categories: onboarding, auth,
feed, detail, profile, settings, paywall, search, empty-states, navigation.

**Blocks-first rule:** before hand-rolling any archetypal screen (onboarding, auth,
feed, settings, paywall, empty state), list `../_shared/blocks/` and check for a
matching block whose `dial_compatibility` covers your dials. Adapt the block; do not
reinvent it.

### Frontmatter schema
```yaml
---
name: value-first-onboarding
category: onboarding
dial_compatibility:
  expression: [3, 8]
  motion: [3, 7]
  density: [2, 5]
platforms: [ios, android, web]
when_to_use: "Consumer apps where the aha-moment can be shown, not told."
not_for: "Pro tools; apps where signup is legally required first."
stack: ["expo-router", "nativewind", "reanimated"]
---
```

### Required body sections
1. Screen sketch (ASCII or description) 2. Props/route API 3. Code sketch
4. Platform notes (iOS/Android/web divergence) 5. Motion variants per MOTION band +
reduced-motion 6. Dark-mode notes 7. Anti-patterns 8. Real-world references.

Blocks must pass the Section 14 pre-flight. One block per file.

---

## 13. OUT OF SCOPE

* Marketing/landing websites → the original taste-skill.
* Games, 3D, canvas-heavy apps (Skia/GL are fine as components, not as the app).
* watchOS / tvOS / widgets / app clips.
* Native module authoring, build tooling, store submission.
* Flutter / SwiftUI / Kotlin - this skill is React Native.

If the brief is one of these, say so and point at the right tool.

---

## 14. FINAL PRE-FLIGHT CHECK

Run every box before delivering. Split by how it's verified.

### 14.A Grep-mechanical (run these literally - the ready-made block lives at the end of `../_shared/references/tells.md`)
- [ ] Zero em-dashes (`—`/`–`) in visible strings
- [ ] Zero emoji in JSX text (unless brief is explicitly playful - then intentional, sparse)
- [ ] Zero `#6366F1|#7C3AED|#8B5CF6`; `LinearGradient` count <= 1
- [ ] Zero inline hex in screen files (tokens only)
- [ ] Zero `ScrollView` wrapping `.map(` of unbounded data (grep, then triage hits:
      bounded static maps are fine)
- [ ] Zero `paddingTop: [4-6][0-9]` magic numbers; safe-area insets used
- [ ] Zero `useNativeDriver: false`; zero `useState` fed by `onScroll`
- [ ] `Alert.alert` only for destructive confirmations
- [ ] `shadowColor` never without sibling `elevation`
- [ ] Every `TextInput` with an email/phone/name role has `keyboardType` +
      `textContentType`/`autoComplete`
- [ ] `GestureHandlerRootView` present once at root (if gestures/sheets used)

### 14.B Design-mechanical (count/inspect in code)
- [ ] App Read + Nav Read emitted, dials explicit and reasoned
- [ ] Tabs 3-5, labels visible; no Settings/Logout tab; FAB justified or absent
- [ ] No nested tab bars; no double headers; auth is a route group
- [ ] Every modal has explicit close; Android back parity (no undeclared BackHandler)
- [ ] Chrome lags content: native nav chrome unless EXPRESSION >= 8
- [ ] One icon family; one accent; one radius scale; one gray ramp
- [ ] Touch targets >= 44pt (hitSlop on small glyphs); row heights consistent
- [ ] Screen padding constant (16 or 20) applied everywhere
- [ ] Full state cycle on every data screen: skeleton/empty/error/offline/refresh
      (offline N/A allowed for declared local-first apps)
- [ ] Permission requests primed at moment of intent, never on mount
- [ ] Haptics per vocabulary; press feedback on every touchable
- [ ] Entering animations index-guarded, never unconditional in list cells
- [ ] Dark mode tokens complete; both modes reviewed
- [ ] Dynamic Type: `maxFontSizeMultiplier` on custom chrome text, body unbounded
      (native-owned chrome is a 14.C device check)
- [ ] Copy self-audit done (no filler verbs, no broken strings, no greeting-header)
- [ ] `accessibilityLabel`/`accessibilityRole` on every custom Pressable

### 14.C Requires simulator/device (be honest)
- [ ] Keyboard: submit visible with keyboard open, both platforms
- [ ] Splash → first screen: no white flash, no font swap
- [ ] Scroll performance on the longest list (no blank cells, no jank)
- [ ] Tab bar survives 1.3x font scale
- [ ] Android edge-to-edge insets correct

**If no simulator/device tool is available, say exactly which 14.C checks were NOT
verified.** Claiming an unverified check is a worse failure than an unticked box.

If a single box cannot honestly be ticked, the app is not done. Fix it before delivering.
