# Navigation

Use this for tabs, stacks, drawers, modals, deep links, Expo Router, React Navigation, Android back behavior, and platform-specific navigation decisions.

## First Decision

Inspect the repo before changing navigation:

- Expo Router or React Navigation directly?
- Static or dynamic React Navigation API?
- iOS, Android, or cross-platform?
- Existing deep link scheme and universal/app links?
- Auth flow, onboarding flow, and notification entry points?

Do not prescribe React Navigation version-specific APIs without checking installed packages and official docs.

Navigation should always answer: where am I, what is nearby, where can I go next, and how do I get back?

## Pattern Selection

| Pattern | Use for | Cautions |
| --- | --- | --- |
| Bottom tabs / navigation bar | 3-5 top-level destinations | Do not include one-off actions as tabs |
| Stack | Detail flows, drill-down, creation steps | Preserve back behavior |
| Modal / sheet | Focused temporary tasks | Avoid hiding required navigation context |
| Drawer | Many secondary destinations, Android/tablet/admin contexts | Rarely best as primary phone nav on iOS |
| Navigation rail | Medium/expanded Android, tablets, foldables | Requires adaptive layout |
| Split view/list-detail | Tablets/foldables, content browsers | Needs compact fallback |

## Tab Rules

- Tabs are for peer top-level destinations, not workflow steps.
- Keep labels visible unless the platform/component pattern clearly supports icon-only.
- Each tab often owns its own stack and scroll state.
- Tapping the active tab should usually return to that tab root or scroll to top, depending on app convention.
- Badge counts must be meaningful and not create anxiety without action.

## Stack Rules

- Preserve iOS edge-swipe back unless there is a strong reason.
- Preserve Android system back and predictive back expectations where relevant.
- Keep titles short and stable.
- Avoid nesting stacks more deeply than users can mentally track.
- For unsaved changes, intercept back with a clear confirmation rather than suppressing it.

## Modal and Sheet Rules

Use sheets for supplementary tasks and short forms. Use full-screen modal for immersive or high-focus tasks such as camera, checkout, auth, or complex creation.

Make dismissal clear:

- Drag handle or visible close action.
- Android back dismissal when appropriate.
- Confirmation if closing would lose work.

## Deep Links

Plan deep links early:

- URL scheme for development and internal links.
- Universal Links on iOS and App Links on Android for production web URLs.
- Notification taps should resolve to the correct screen and state.
- Auth and permission gates must route users back to the intended destination after completion.

React Navigation dynamic-style linking remains common:

```tsx
const linking = {
  prefixes: ['myapp://', 'https://example.com'],
  config: {
    screens: {
      Home: 'home',
      Item: 'items/:itemId',
    },
  },
};
```

For React Navigation static configuration, `createStaticNavigation(RootStack)` returns a component; linking prefixes are passed to that component's `linking` prop (`<Navigation linking={{ prefixes, config }} />`), and route-level paths live in each screen's `linking` options. `createStaticNavigation` itself takes no linking argument. Check current docs before implementing.

## Expo Router

When the repo uses Expo Router:

- Prefer file-based routes that match product information architecture.
- Use route groups for auth, tabs, modals, and onboarding.
- Keep deep link paths stable and human-readable.
- Avoid leaking implementation names into public URLs.

## Navigation QA

- Current location is obvious within five seconds.
- Back works on every screen.
- Android hardware/system back matches user expectation.
- iOS swipe back remains enabled unless intentionally blocked.
- Active tab state and scroll position persist where expected.
- Deep links open correct screens from cold start and warm state.
- Notification tap routing works.
- Modal dismissal and unsaved changes are handled.
- Large text and long labels do not break nav controls.
