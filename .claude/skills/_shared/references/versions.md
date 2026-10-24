# Version Facts (last verified: 2026-07-02)

Every version-sensitive fact in this skill lives in THIS file only. The taste rules in
SKILL.md and the other references are written to be version-free. When Expo ships a new
SDK (roughly every 6 months), update this file; nothing else should need to change.

**Agent instruction:** treat this file as a snapshot, not gospel. Before pinning versions
in a real project, run `npx expo install <package>` (it resolves the SDK-compatible
version) and check the project's existing `package.json` first. If this file's date is
more than ~6 months old, verify against https://expo.dev/changelog before relying on it.

## Current pairings (verified 2026-07-02)

| Package | Version | Notes |
|---|---|---|
| `expo` | SDK 57 (latest), 55/56 common in the wild | New Architecture is mandatory from SDK 55+ (React Native 0.82 removed the opt-out). |
| `expo-router` | Versioned in lockstep with the SDK (57.x for SDK 57) | Historical pairings: SDK 52 → router v4, SDK 53 → v5, SDK 54 → v6, SDK 55+ → SDK-aligned versioning. Never hand-pin; use `npx expo install expo-router`. |
| `react-native-reanimated` | 4.x | Reanimated 4 splits worklets into the separate `react-native-worklets` package - install BOTH. Reanimated 4 requires the New Architecture. Reanimated 3 API (`useSharedValue`, `useAnimatedStyle`, etc.) carries forward unchanged; v4 adds CSS-transition-style APIs. |
| `react-native-worklets` | 0.x (peer of Reanimated 4) | Required alongside Reanimated 4. |
| `react-native-gesture-handler` | 3.x | `ReanimatedSwipeable` (the maintained replacement for the old `Swipeable`) has been available since 2.18. `GestureHandlerRootView` still required once at the root. |
| `nativewind` | 4.x | Tailwind syntax for RN. No hover variants on native; `active:` maps to press. |
| `@gorhom/bottom-sheet` | 5.x | Requires Reanimated + gesture-handler. Use `BottomSheetScrollView` / `BottomSheetFlatList` inside, never plain scrollables. |
| `@shopify/flash-list` | 2.x | v2 auto-sizes: `estimatedItemSize` is no longer required (it was mandatory in v1 - do not cargo-cult it into v2 projects). v2 requires the New Architecture. |
| `react-native-keyboard-controller` | 1.x | The recommended keyboard solution (`KeyboardAwareScrollView`, `KeyboardStickyView`). |
| `react-native-safe-area-context` | 5.x | `useSafeAreaInsets()` is the canonical safe-area API. |
| `expo-image` | SDK-aligned | Use over `<Image>` from RN: caching, `placeholder={{ blurhash }}`, `recyclingKey` for list cells. |

## SDK-era facts worth knowing

- **New Architecture:** mandatory SDK 55+. Skeletons in this skill assume it.
- **Native tabs:** `expo-router` ships a native tab bar (`NativeTabs`, imported from
  `expo-router/unstable-native-tabs` as of SDK 54; check current import path) that renders
  real UITabBar / BottomNavigation. Prefer it (or the classic JS `Tabs`) over any
  hand-rolled tab bar.
- **Drawer:** requires `@react-navigation/drawer` on SDK 54/55; bundled into `expo-router`
  from SDK 56. Either way, drawers are rarely the right primary navigation (see
  navigation.md).
- **Shared element transitions:** still no stable, blessed API. Reanimated's
  `sharedTransitionTag` remains experimental; `react-navigation-shared-element` is
  unmaintained. This is why skeletons.md lists shared elements as an anti-skeleton.

## Draftbit note

Draftbit-generated apps currently scaffold on SDK 53/54 with NativeWind v4 +
React Native Reusables. The skill's defaults are compatible with that stack.
