# iOS Native Navigation Bar Button Style Inconsistency

## The Problem

On iOS, any view passed to `Stack.Screen`'s `headerRight` (or `headerLeft`) is wrapped by
`UINavigationBar` in a native button container. That container automatically receives the iOS
system's header-button appearance — a circular blur/glass background — regardless of how the
React Native component inside it is styled.

When a `MenuButton` (or any `Pressable`) is rendered in **screen content** instead of inside
`headerRight`, it is just a plain React Native view and receives no native styling.

The result is a visual inconsistency: the same `MenuButton` component looks different depending
on where it is mounted.

| Placement                       | Visual result on iOS                              |
| ------------------------------- | ------------------------------------------------- |
| `headerRight` in `Stack.Screen` | Circular glass/blur background (iOS system style) |
| Custom header in screen content | Plain icon, no background                         |

## Root Cause

React Navigation renders `headerRight` content inside a native `UIBarButtonItem` on iOS.
The iOS SDK applies its own `UIBarButtonItemAppearance` to every item placed there, including a
background material effect. React Native has no way to opt out of this from the JS side without
overriding native code.

Components rendered inside the scroll view or any other `View` in screen content are pure React
Native and never receive that native treatment.

## Affected Screen (as of 2026-04-16)

### `app/progress.tsx` — only screen with this issue

```tsx
// app/progress.tsx:172-182
<Stack.Screen
  options={{
    title: t('progress.title'),
    headerRight: () => <MenuButton onPress={() => setShowMenu(true)} />,  // ← native bar
    headerShown: true,
    ...
  }}
/>
```

The global layout (`app/_layout.tsx:104`) sets `headerShown: false` for all routes.
`progress.tsx` is the only screen that overrides this to `headerShown: true` **and** injects a
button via `headerRight`, causing the glass-style effect.

All other screens that show a `MenuButton` in the top-right area render it inside custom
content, matching `app/workout/workouts.tsx:295-305`:

```tsx
// app/workout/workouts.tsx:295-305 — no glass effect
<View className="flex-row items-center justify-between">
  <GradientText ...>{t('workouts.title')}</GradientText>
  <MenuButton onPress={() => setIsScreenMenuVisible(true)} />
</View>
```

## Fix

Move the `MenuButton` out of `headerRight` and into a custom in-content header, then set
`headerShown: false` (or omit it, since the global layout already does this).

```tsx
// app/progress.tsx — before
<Stack.Screen
  options={{
    title: t('progress.title'),
    headerRight: () => <MenuButton onPress={() => setShowMenu(true)} />,
    headerShown: true,
    headerStyle: { backgroundColor: theme.colors.background.primary },
    headerTintColor: theme.colors.text.primary,
    headerShadowVisible: false,
  }}
/>
```

```tsx
// app/progress.tsx — after
// 1. Remove the Stack.Screen override entirely (or set headerShown: false).
// 2. Add a custom title row at the top of ProgressScreenContent, just like workouts.tsx does:

<View className="flex-row items-center justify-between px-4 py-4">
  <Text
    style={{
      color: theme.colors.text.primary,
      fontSize: theme.typography.fontSize['2xl'],
      fontWeight: theme.typography.fontWeight.bold,
    }}
  >
    {t('progress.title')}
  </Text>
  <MenuButton onPress={() => setShowMenu(true)} />
</View>
```

With this change the `MenuButton` is a plain React Native `Pressable` in content, and iOS will
not wrap it in a native button container, removing the glass effect.

## Prevention

- Default in `app/_layout.tsx` is already `headerShown: false`. Do not override it with
  `headerShown: true` + `headerRight` unless a native header is intentional for that screen.
- If a native header is intentional, accept the glass effect or apply a custom
  `UINavigationBarAppearance` override in the native iOS project to remove it globally.
- Prefer custom in-content headers (like `workouts.tsx`) for consistent cross-platform appearance.
