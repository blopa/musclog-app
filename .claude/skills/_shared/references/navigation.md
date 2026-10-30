# Navigation Architecture (deep reference)

Navigation is information architecture. It is designed before screens, emitted as a
Nav Read, and only then implemented. With Expo Router the Nav Read IS the `app/`
directory - that is the trick that keeps the plan and the code from drifting.

## 1. The Nav Read

Emit before any code. Format:

```
NAV READ
platforms: <targets, each tiered: first-class | best-effort | none>
tabs (<n>): <Label> · <Label> · …        (or "no tabs: <reason>")
app/
  <route tree with container type and push-chains per route>
entry points: <routes reached from header buttons, FABs, or inline affordances on a
               tab root (e.g. a search field): route ← affordance (screen)>
sheets: <named bottom sheets and which screens present them, or "none">
deep links: <public routes>
android back: <default pop | declared exceptions>
max taps to any core screen: <n>
```

Every line is a commitment the pre-flight checks against. If the app has no tabs
(single-flow utility, e.g. a camera-first scanner), say so and name the pattern
(stack-only, or fullscreen + sheets).

## 2. Container decision tree (expanded)

Evaluate in order; first match wins.

**1. Tab root** - a top-level destination the user returns to repeatedly, a peer of the
other destinations, holding independent navigation state.
- 3-5 tabs. Two destinations → no tab bar (use a stack + header affordances). Six
  candidates → merge or demote; the IA is wrong, not the bar.
- Each tab owns a stack. Switching tabs preserves each stack's state.
- Tapping the active tab scrolls to top / pops to root (platform convention).

**2. Push** - drill-down with a clear parent: list → detail, detail → sub-detail,
settings → sub-setting. The screen answers "more about what I was just looking at."
- Pushed screens get the native header with back. Title = the thing, not the app.
- Push chains deeper than 3 usually signal a missing modal or tab.

**3. Modal** - a self-contained task that creates or edits something and returns:
compose, add item, edit profile, cross-tab actions. (Filters: complexity is the
discriminator - a filter UI with its own search field, internal steps, or more than a
handful of controls is a modal; a handful of toggles/choices is a sheet, step 4.)
- iOS: `presentation: 'pageSheet'` default (full-screen modal only for immersive tasks).
- A modal may contain at most ONE internal push (e.g. compose → add photo). Two or more
  → it's a flow; give it its own route group.
- Dirty-state modals confirm discard on dismiss (declare in Nav Read under android back).

**4. Bottom sheet** - the parent must stay visible; lightweight choice, preview, or
action menu; less than one screen of content; NO internal navigation.
- Options/actions for a list item; filter with a handful of controls; quick preview.
- The moment a sheet needs its own back stack, a search field with results, or a second
  step - it should have been a modal.
- A screen presenting more than 2 distinct sheets is hiding IA in sheets.

**5. Full-screen modal / route group** - immersive or blocking: camera, media viewer,
player, paywall, onboarding, auth. Custom dismiss affordance required (X visible, or
explicit Done), swipe-down alone is not an affordance.

## 3. Expo Router conventions

```
app/
  _layout.tsx            root: providers + <Stack> with (tabs) and modals declared
  (auth)/                unauthenticated group
    _layout.tsx          redirect if session exists
    sign-in.tsx
    sign-up.tsx
  (tabs)/
    _layout.tsx          <Tabs> (or NativeTabs - see versions.md)
    index.tsx            first tab
    library/
      _layout.tsx        per-tab stack when the tab has internal pushes
      index.tsx
      collection/[id].tsx
  item/[id].tsx          shared detail, pushable from any tab (lives OUTSIDE (tabs)
                         only if it must cover the tab bar; otherwise inside the tab)
  compose.tsx            modal: presentation set in root _layout Stack.Screen options
```

Rules:
* **Session gating in the group layout**, not per-screen: `(auth)/_layout.tsx` and the
  protected group's layout each check the session and `<Redirect>` accordingly.
* **Detail screens over the tab bar or under it - decide per app, once.** Content
  browsing apps usually push within the tab (bar stays); focused tasks and media cover it.
* **Typed routes on:** enable Expo Router typed routes; never navigate with hand-built
  strings when `Link`/`router.push` with typed params exists.
* **Deep links:** every public detail screen is a param route (`item/[id].tsx`). Cold-
  start deep links must land with a back affordance to somewhere sane (`initialRouteName`
  on the stack, not an orphan screen).
* **Web:** routes are URLs for free - check that modals have sensible URL behavior and
  the tab layout collapses to a top-nav or rail if web is first-class.

## 4. Mechanical checks (pre-flight)

- [ ] Tab count 3-5 (or a declared no-tab pattern); labels 1 word, always visible
- [ ] No Settings tab, no Logout tab; no FAB without a declared single dominant create action
- [ ] Every core job-to-be-done screen reachable in <= 2 taps from a tab root
- [ ] No nested tab bars; no screen with two headers
- [ ] Every pushed screen: Android hardware/gesture back == header back; `BackHandler`
      overrides only for discard-confirms declared in the Nav Read
- [ ] Every modal: explicit close affordance; <= 1 internal push
- [ ] Sheets: no internal navigation; <= 2 distinct sheets presented per screen
- [ ] Auth/onboarding as route groups, session-gated in `_layout`, zero conditional
      screen-swapping renders
- [ ] Every detail screen deep-linkable with sane cold-start back stack
- [ ] Route tree in code matches the emitted Nav Read (diff them)

## 5. Worked examples

### A. Consumer social (photo-sharing, "like a small Instagram")

```
NAV READ
platforms: iOS + Android first-class, web read-only
tabs (4): Feed · Discover · Activity · Profile          (no compose tab - FAB unjustified;
                                                         compose is a modal from Feed/Profile)
app/
  (auth)/sign-in, sign-up, forgot-password
  (tabs)/
    index        Feed        → push post/[id], user/[handle]
    discover     Discover    → push post/[id], user/[handle], tag/[tag]
    activity     Activity    → push post/[id], user/[handle]
    profile      Profile     → push settings, settings/*, followers
  post/[id]                  push (inside tab, bar stays)
  user/[handle]              push
  compose                    modal (pageSheet), 1 internal push (edit-photo)
  media/[id]                 fullscreen modal (pinch-zoom viewer, X to close)
sheets: post-options (report/share/mute), comment-actions
deep links: /post/:id, /user/:handle, /tag/:tag
android back: default pop; compose confirms discard when dirty
max taps to any core screen: 2 (post detail = 1 tap from feed)
```

Notes: Activity is a tab because returning to check notifications is a repeated
top-level behavior. Settings is NOT a tab (behind Profile). Media viewer covers the tab
bar; post detail does not.

### B. Fitness utility (workout tracker)

```
NAV READ
platforms: iOS + Android first-class, web none
tabs (3): Today · Library · Progress
app/
  (onboarding)/goal, experience, schedule     3 steps, each a real personalization input
  (tabs)/
    index        Today       → push workout/[id]
    library      Library     → push collection/[id] → workout/[id]
    progress     Progress    → push history/[week]
  workout/[id]               push
  player/[id]                fullscreen modal (active workout: timer, custom Done/discard)
  new-workout                modal (pageSheet)
  settings                   push from header gear on Today (no Profile tab - single-user app)
sheets: exercise-options, rest-timer-adjust
deep links: /workout/:id
android back: default pop; player confirms abandon-workout
max taps to any core screen: 2
```

Notes: 3 tabs, not 5 - there is no social layer, so no Activity/Profile padding. The
active-workout player is the one fullscreen surface and the one BackHandler exception.
Onboarding is 3 screens because each collects a real input (tells.md #31:
onboarding must earn each screen).

### C. E-commerce (DTC shop)

```
NAV READ
platforms: iOS + Android first-class, web first-class (shared routes)
tabs (4): Shop · Search · Bag · Account       (Bag as a tab: returning to it is core;
                                               badge shows count)
app/
  (tabs)/
    index        Shop        → push category/[slug] → product/[id]
    search       Search      → push product/[id]
    bag          Bag         → push checkout flow entry
    account      Account     → push orders, orders/[id], addresses, settings
  product/[id]               push (bar stays - browsing continues)
  (checkout)/shipping, payment, review        route group, stack, no tab bar,
                                              explicit X-to-abandon with confirm
  size-guide                 modal (pageSheet)
deep links: /product/:id, /category/:slug (web-canonical URLs)
sheets: filters (Search), add-to-bag options (size/color)
android back: default pop; (checkout) steps pop within group, X confirms abandon
max taps to any core screen: 2
```

Notes: checkout is a route GROUP, not a modal - it is a multi-step flow with its own
stack. Add-to-bag variant selection is a sheet (parent context - the product - stays
visible). Web first-class means product/category URLs are canonical and the tab layout
adapts.
