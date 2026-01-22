# Reactive Data Flow in Expo/React Native with WatermelonDB

## Overview

This document explains how to handle reactive data flow in your Expo app, specifically for database-driven state that needs to update across multiple screens and components when changed.

## Your Current Implementation

You're currently using **WatermelonDB's Observable Pattern** with custom React hooks, which is actually the **recommended approach** for WatermelonDB. Here's what you have:

### Current Pattern: `useSettings` Hook

```typescript
// hooks/useSettings.ts
export function useSettings(): UseSettingsResult {
  const [units, setUnits] = useState<Units>('metric');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const query = database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)));

    const subscription = query.observe().subscribe({
      next: (settings) => {
        setUnits(parseUnitsFromSettings(settings));
        setIsLoading(false);
      },
      error: () => {
        setUnits('metric');
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    units,
    isLoading,
    weightUnit: getWeightUnit(units),
    heightUnit: getHeightUnit(units),
  };
}
```

**This is correct!** WatermelonDB's `.observe()` automatically:

- ✅ Subscribes to database changes
- ✅ Emits new values when data changes
- ✅ Works across multiple components using the same hook
- ✅ Handles cleanup automatically

## How It Works

### 1. **Database Updates Trigger Observables**

When you update a setting in the database:

```typescript
// app/onboarding/fitness-info.tsx
await existingUnitsSetting[0].update((setting) => {
  setting.value = unitsValue.toString();
  setting.updatedAt = now;
});
```

WatermelonDB automatically:

1. Detects the change in the database
2. Notifies all active observers of that query
3. Emits the new data to subscribers
4. React re-renders components using `useSettings`

### 2. **Multiple Components Stay in Sync**

Every component using `useSettings()` automatically receives updates:

```typescript
// Component A
const { weightUnit } = useSettings(); // Gets 'kg' or 'lbs'

// Component B (different screen, already rendered)
const { units } = useSettings(); // Automatically updates when Component A changes settings
```

## Best Practices & Patterns

### ✅ Pattern 1: Custom Hooks with Observables (Your Current Approach)

**Best for:** Settings, user preferences, frequently accessed data

**Pros:**

- Simple and clean API
- Automatic reactivity
- Type-safe
- Easy to test
- Works with React's component lifecycle

**Cons:**

- Each hook instance creates a subscription (but WatermelonDB handles this efficiently)
- Need to create a hook for each type of reactive data

**Example:**

```typescript
// hooks/useSettings.ts - Your current implementation
export function useSettings() {
  /* ... */
}

// hooks/useUser.ts - Similar pattern for user data
export function useUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const query = database.get<User>('users').query(/* ... */);
    const subscription = query.observe().subscribe({
      next: (users) => setUser(users[0] || null),
    });
    return () => subscription.unsubscribe();
  }, []);

  return { user };
}
```

### ✅ Pattern 2: Context API + Observables (For Global State)

**Best for:** App-wide settings, theme, authentication state

**Pros:**

- Single source of truth
- Can combine with other state management
- Avoids prop drilling

**Cons:**

- Can cause unnecessary re-renders if not optimized
- More boilerplate
- Context updates trigger all consumers (use carefully)

**Example:**

```typescript
// contexts/SettingsContext.tsx
const SettingsContext = React.createContext<UseSettingsResult | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings(); // Your existing hook

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = React.useContext(SettingsContext);
  if (!context) throw new Error('useSettingsContext must be used within SettingsProvider');
  return context;
}

// Usage in components
const { weightUnit } = useSettingsContext();
```

**⚠️ Important:** Only use Context if you need to share the same subscription instance. Your current hook pattern is actually more efficient because each component gets its own subscription, and WatermelonDB handles deduplication internally.

### ✅ Pattern 3: Zustand/Jotai + WatermelonDB (For Complex State)

**Best for:** Complex state management, derived state, computed values

**Pros:**

- Fine-grained reactivity
- Better performance for large apps
- Can combine database state with UI state
- DevTools support

**Cons:**

- Additional dependency
- More setup complexity
- Might be overkill for simple cases

**Example:**

```typescript
// stores/settingsStore.ts
import { create } from 'zustand';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

interface SettingsStore {
  units: 'metric' | 'imperial';
  isLoading: boolean;
  subscribe: () => () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => {
  let unsubscribe: (() => void) | null = null;

  return {
    units: 'metric',
    isLoading: true,
    subscribe: () => {
      const query = database.get<Setting>('settings').query(Q.where('type', UNITS_SETTING_TYPE));

      unsubscribe = query.observe().subscribe({
        next: (settings) => {
          const units = settings[0]?.value === '1' ? 'imperial' : 'metric';
          set({ units, isLoading: false });
        },
      });

      return () => unsubscribe?.();
    },
  };
});
```

### ✅ Pattern 4: withObservables HOC (WatermelonDB's Built-in)

**Best for:** Class components, or when you want to pass observables as props

**Pros:**

- Official WatermelonDB pattern
- Works with class components
- Can compose multiple observables

**Cons:**

- More verbose
- Less common in modern React (hooks are preferred)
- Can't use hooks inside HOC

**Example:**

```typescript
import { withObservables } from '@nozbe/watermelondb/react';

const enhance = withObservables(['settings'], ({ database }) => ({
  settings: database.get<Setting>('settings')
    .query(Q.where('type', UNITS_SETTING_TYPE))
    .observe(),
}));

const SettingsDisplay = enhance(({ settings }) => {
  const units = settings[0]?.value === '1' ? 'imperial' : 'metric';
  return <Text>{units}</Text>;
});
```

## Performance Considerations

### 1. **Multiple Subscriptions to Same Query**

**Good News:** WatermelonDB is optimized for this! Multiple components subscribing to the same query is efficient because:

- WatermelonDB deduplicates queries internally
- SQLite handles the actual query execution
- Only the changed data is emitted

**Your current approach is fine:** Each component using `useSettings()` creates a subscription, but WatermelonDB handles this efficiently.

### 2. **When to Use Context vs Hooks**

**Use Hooks (Current Approach) when:**

- ✅ Data is used in multiple places but not necessarily at the app root
- ✅ You want automatic cleanup per component
- ✅ You want type safety and simplicity
- ✅ Different components might need different queries

**Use Context when:**

- ✅ You need to share the exact same subscription instance
- ✅ You want to combine database state with other global state
- ✅ You need to pass settings to deeply nested components without prop drilling

**For your use case (settings), hooks are actually better** because:

- Settings are used across many screens
- Each screen can mount/unmount independently
- You get automatic cleanup when components unmount

### 3. **Optimization Tips**

**Memoize derived values:**

```typescript
export function useSettings(): UseSettingsResult {
  // ... existing code ...

  return useMemo(
    () => ({
      units,
      isLoading,
      weightUnit: getWeightUnit(units),
      heightUnit: getHeightUnit(units),
    }),
    [units, isLoading]
  );
}
```

**Batch database writes:**

```typescript
// ✅ Good: Batch multiple updates
await database.write(async () => {
  await setting1.update(/* ... */);
  await setting2.update(/* ... */);
});

// ❌ Bad: Separate writes
await setting1.update(/* ... */);
await setting2.update(/* ... */);
```

## Common Issues & Solutions

### Issue 1: Components Not Updating

**Symptoms:** Settings change in database but UI doesn't update

**Causes:**

1. Subscription not properly set up
2. State update not triggering re-render
3. Component unmounted before update

**Solution:**

```typescript
// ✅ Correct: Use functional setState or ensure new object reference
setUnits(parseUnitsFromSettings(settings)); // This is correct

// ❌ Wrong: Direct mutation
units = parseUnitsFromSettings(settings);
```

### Issue 2: Multiple Re-renders

**Symptoms:** Component re-renders too often

**Solution:** Memoize the return value and use `useMemo` for derived values:

```typescript
return useMemo(
  () => ({
    units,
    isLoading,
    weightUnit: getWeightUnit(units),
    heightUnit: getHeightUnit(units),
  }),
  [units, isLoading]
);
```

### Issue 3: Memory Leaks

**Symptoms:** App slows down over time

**Solution:** Always cleanup subscriptions (you're already doing this correctly):

```typescript
useEffect(() => {
  const subscription = query.observe().subscribe(/* ... */);
  return () => subscription.unsubscribe(); // ✅ You have this
}, []);
```

## Recommended Architecture for Your App

Based on your codebase, here's what I recommend:

### ✅ Keep Your Current Pattern (Hooks with Observables)

Your `useSettings` hook is well-implemented. Continue using this pattern for:

- Settings
- User data
- Workout templates
- Any frequently-accessed, reactive data

### ✅ Create Similar Hooks for Other Reactive Data

```typescript
// hooks/useUser.ts
export function useUser() {
  /* similar pattern */
}

// hooks/useWorkoutTemplate.ts
export function useWorkoutTemplate(templateId: string) {
  /* similar pattern */
}
```

### ✅ Use Context Only When Needed

Consider Context API for:

- Authentication state (if complex)
- Theme preferences (if you add them)
- App-wide UI state (modals, navigation state)

### ✅ Avoid Over-Engineering

Don't add Zustand/Redux unless you have:

- Complex derived state
- State that needs to persist across app restarts (beyond database)
- Need for time-travel debugging
- Complex state synchronization logic

## Example: Complete Settings Flow

Here's how your complete flow works:

```typescript
// 1. User changes setting in onboarding
// app/onboarding/fitness-info.tsx
await existingUnitsSetting[0].update((setting) => {
  setting.value = '1'; // imperial
  setting.updatedAt = Date.now();
});

// 2. WatermelonDB detects change and notifies observers
// (automatic - no code needed)

// 3. All components using useSettings() receive update
// app/profile.tsx
const { weightUnit } = useSettings(); // Automatically becomes 'lbs'

// app/workout/workout-session.tsx
const { units } = useSettings(); // Automatically becomes 'imperial'

// 4. Components re-render with new values
// (automatic - React handles this)
```

## Summary

**Your current approach is correct!** WatermelonDB's observable pattern with custom hooks is the recommended way to handle reactive database state in React Native.

**Key Takeaways:**

1. ✅ Your `useSettings` hook is well-implemented
2. ✅ WatermelonDB handles multiple subscriptions efficiently
3. ✅ Continue using this pattern for other reactive data
4. ✅ Only add Context/Zustand if you have specific needs
5. ✅ The reactivity works automatically - when you update the database, all subscribers update

**Next Steps:**

1. Create similar hooks for other reactive data (user, workouts, etc.)
2. Consider memoizing return values if you notice performance issues
3. Keep using the hook pattern - it's the right choice for your use case

## Additional Resources

- [WatermelonDB Documentation](https://nozbe.github.io/WatermelonDB/)
- [WatermelonDB React Integration](https://nozbe.github.io/WatermelonDB/Components.html)
- [RxJS Observables Guide](https://rxjs.dev/guide/observable)
