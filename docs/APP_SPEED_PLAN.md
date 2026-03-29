# Navigation Performance Improvements

## Context

The app has 2+ second screen transitions with zero visual feedback, making it feel broken.
Root causes identified:

1. **`useEffect` + `observe().subscribe()` timing gap** — WatermelonDB subscriptions fire _after_ the first render is committed to screen, so every screen always starts with one blank `isLoading: true` frame before data can appear
2. **Sequential DB queries in `useNutritionLogs`** — `getNutritionLogsForDate`, `getDailyNutrients`, and `fetchCount` are awaited one-by-one (~150ms compound delay)
3. **No haptic/visual press feedback on nav buttons** — `NavigationMenu` calls `router.push()` in `onPress` only, giving zero feedback for 200–600ms
4. **Static `SkeletonLoader`** — no animation, looks like broken UI rather than intentional loading state
5. **`router.prefetch()` never called** — screens only begin mounting after navigation commits; no head-start on JS parsing or hook setup
6. **`useUser()` re-subscribes per screen** — each screen that calls `useUser()` (`app/index.tsx`, `app/profile.tsx`, `hooks/useEmpiricalTDEE.ts`) starts fresh with `isLoading: true`; user data is stable and could be initialized once at app boot

---

## Task 1 — Shimmer animation in `SkeletonLoader`

**File:** `components/theme/SkeletonLoader.tsx`

Replace the static `<View>` with an `<Animated.View>` driven by Reanimated's `useSharedValue` + `withRepeat(withSequence(...))`. This runs on the **UI thread** — zero JS overhead. All existing callers get shimmer automatically.

**Existing Reanimated usage to follow:** `BarcodeCameraModal.tsx` uses `withRepeat + withTiming`; `Accordion.tsx` uses `useSharedValue + withTiming + useAnimatedStyle`.

```tsx
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Inside SkeletonLoader component:
const opacity = useSharedValue(0.4);

useEffect(() => {
  opacity.value = withRepeat(
    withSequence(withTiming(0.8, { duration: 800 }), withTiming(0.4, { duration: 800 })),
    -1 // loop forever
  );
}, [opacity]);

const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

// Remove 'opacity: theme.colors.opacity.medium' from the style object
// Change <View> → <Animated.View style={[{ width, height, borderRadius, backgroundColor }, animatedStyle]}>
```

---

## Task 2 — Haptics + prefetch in `NavigationMenu`

**File:** `components/NavigationMenu.tsx`

Add `onPressIn` to every `Pressable`. On press-down (before `onPress` fires), two things happen simultaneously:

- Haptic fires in <16ms (native thread) — immediate tactile confirmation
- `router.prefetch(destination)` starts mounting the target screen off-screen via `react-native-screens` preloaded routes — data hooks begin firing ~300ms before the user even lifts their finger

`expo-haptics@15.0.8` is already installed. Pattern already used in `CoachModal.tsx` (line 339) and `SmartCameraModal.tsx` (line 146).

**New import** (add after existing imports):

```ts
import * as Haptics from 'expo-haptics';
```

**Pattern for each routed item** inside `renderNavSlot` (workouts, food, cycle, settings, progress, checkin):

```tsx
onPressIn={() => {
  if (!active) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.prefetch('/workout/workouts'); // path matches the onPress target
  }
}}
```

**Special cases:**

- **`coach` case (line 148):** `onPressIn` haptic only — no prefetch (opens a modal, not a route)
- **Home `Pressable` (line 321, outside `renderNavSlot`):** `onPressIn` haptic + `router.prefetch('/')` gated by `!homeActive`
- **Camera FAB `Pressable` (line 349, outside `renderNavSlot`):** `onPressIn` haptic only — callback-driven

`Haptics` is a module import — does **not** need to be added to `renderNavSlot`'s `useCallback` dependency array (line 307). `router` is already in the dep array.

**Profile nav item note:** Its `active` guard is `isPathActive('/profile') || isPathActive('/progress')` (line 122), so `router.prefetch('/profile')` only fires when neither screen is active. Fine.

---

## Task 3 — Parallelize daily-mode queries in `useNutritionLogs`

**File:** `hooks/useNutritionLogs.ts`

**Current code (lines 232–264):** Three independent queries run sequentially:

1. `await NutritionService.getNutritionLogsForDate(date)` — reads `nutrition_logs` table
2. `await NutritionService.getDailyNutrients(date)` — reads same table (different aggregation)
3. `await database.get<NutritionLog>(...).fetchCount()` — with retry logic for DB reset errors

These are fully independent (no shared state, no ordering requirement). **Estimated saving: 100–150ms** per nutrition screen navigation.

**Change:** Extract `fetchCount` + its retry logic into an inline async function, then run all three in `Promise.all`:

```ts
// Inline helper preserving existing retry logic
const getFetchCount = async (): Promise<number> => {
  try {
    return await database
      .get<NutritionLog>('nutrition_logs')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetchCount();
  } catch (error: any) {
    const isResetError =
      error?.message?.includes('database is being reset') ||
      error?.message?.includes('underlyingAdapter');
    if (isResetError) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return await database
        .get<NutritionLog>('nutrition_logs')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetchCount();
    }
    throw error;
  }
};

const [logs, nutrients, allLogsCount] = await Promise.all([
  NutritionService.getNutritionLogsForDate(date),
  NutritionService.getDailyNutrients(date),
  getFetchCount(),
]);

logsList = logs;
setHasMore(false);
setDailyNutrients(nutrients);
setTotalCount(allLogsCount);
```

Replace lines 232–264 with the above. The surrounding `if (mode === 'daily' && date)` block and `setLogs(logsList)` call below remain unchanged.

---

## Task 4 — Skeleton loaders in `progress.tsx`

**File:** `app/progress.tsx`

Replace the generic `<ActivityIndicator>` (lines 243–246) with skeleton shapes that mirror the actual chart layout. The `ProgressDateFilter` header (line 234) is already always rendered — the skeleton replaces only the scrollable content area.

```tsx
// Add SkeletonLoader import
import { SkeletonLoader } from '../components/theme/SkeletonLoader';

// Replace ActivityIndicator block (lines 243–246):
{isLoading ? (
  <ScrollView
    className="flex-1"
    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 16, paddingTop: 8 }}
    scrollEnabled={false}
  >
    {/* Stat row — mirrors metric summary cards */}
    <View className="flex-row gap-3">
      <SkeletonLoader width="48%" height={80} borderRadius={12} />
      <SkeletonLoader width="48%" height={80} borderRadius={12} />
    </View>
    {/* Chart card placeholders — mirrors BodyMetrics + NutritionCharts + WorkoutCharts heights */}
    <SkeletonLoader width="100%" height={220} borderRadius={16} />
    <SkeletonLoader width="100%" height={220} borderRadius={16} />
    <SkeletonLoader width="100%" height={180} borderRadius={16} />
  </ScrollView>
) : (
  <ScrollView ...> {/* existing content unchanged */}
```

Remove `ActivityIndicator` from the `react-native` import if it's no longer used elsewhere in the file.

---

## Task 5 — `UserContext` for app-boot user subscription

**New file:** `context/UserContext.tsx`
**Modified files:** `app/_layout.tsx`, `hooks/useUser.ts`

**Why:** `useUser()` is called in 3 screens/hooks (`app/index.tsx`, `app/profile.tsx`, `hooks/useEmpiricalTDEE.ts`). Each creates a fresh subscription with `isLoading: true`. User data is stable and only needs one subscription. Moving it to app-boot level (same pattern as `SettingsContext.tsx`) means data is ready before any screen mounts.

### `context/UserContext.tsx` (new file — model after `SettingsContext.tsx`)

```tsx
import { Q } from '@nozbe/watermelondb';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { database } from '../database';
import User from '../database/models/User';

type UserContextValue = {
  user: User | null;
  isLoading: boolean;
};

const UserContext = createContext<UserContextValue>({ user: null, isLoading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const query = database
      .get<User>('users')
      .query(Q.where('deleted_at', Q.eq(null)))
      .extend(Q.take(1));

    const subscription = query.observe().subscribe({
      next: (users) => {
        setUser(users[0] || null);
        setIsLoading(false);
      },
      error: () => {
        setUser(null);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, isLoading }), [user, isLoading]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext(): UserContextValue {
  return useContext(UserContext);
}
```

### `hooks/useUser.ts` — reduce to a thin wrapper

```ts
import { useUserContext } from '../context/UserContext';

export interface UseUserResult {
  user: User | null; // keep interface for any external type references
  isLoading: boolean;
}

export function useUser(): UseUserResult {
  return useUserContext();
}
```

All three callers (`app/index.tsx`, `app/profile.tsx`, `hooks/useEmpiricalTDEE.ts`) continue calling `useUser()` unchanged.

### `app/_layout.tsx` — add `UserProvider`

Add to imports:

```ts
import { UserProvider } from '../context/UserContext';
```

Wrap `RootLayout`'s return JSX with `<UserProvider>`, alongside the existing providers (after `SettingsProvider` since it's independent):

```tsx
<SettingsProvider>
  <UserProvider>{/* ... rest of providers ... */}</UserProvider>
</SettingsProvider>
```

---

## Execution Order

Tasks are independent and can be implemented in any order. Recommended sequence:

1. Task 1 (SkeletonLoader shimmer) — lowest risk, improves all existing skeletons immediately
2. Task 2 (NavigationMenu haptics + prefetch) — zero risk, instant perceived improvement
3. Task 4 (progress.tsx skeleton) — low risk, replaces spinner with shimmer layout
4. Task 3 (useNutritionLogs parallelize) — medium risk, logic change in a hook
5. Task 5 (UserContext) — most files touched, do last

---

## Verification

| Change            | How to verify                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Shimmer animation | Navigate to any screen — skeleton placeholders pulse between light and slightly lighter     |
| Haptics           | Tap nav buttons — immediate vibration on finger-down, before screen transition              |
| Prefetch          | Navigate workouts → nutrition → workouts repeatedly — second+ visits noticeably faster      |
| Nutrition speed   | Time the Nutrition screen from tap to content: should be ~150ms faster                      |
| Progress skeleton | Navigate to Progress — shimmer card placeholders instead of centered spinner                |
| UserContext       | Home and Profile screens: user name/avatar appears without a loading flash on return visits |

Run after all changes: `npm run lint:all`
