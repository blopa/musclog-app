# Theme System - Light & Dark Mode Support

This document explains how to use the new light/dark theme system in the app.

## Overview

The app now supports both light and dark themes with automatic system preference detection. Users can choose between:

- **System** (follows device preference)
- **Light** (force light mode)
- **Dark** (force dark mode)

## Architecture

### Core Files

1. **`theme.ts`** - Theme definitions
   - `darkTheme` - Complete dark theme configuration
   - `lightTheme` - Complete light theme configuration
   - `theme` - Default export (dark theme for backward compatibility)

2. **`hooks/useTheme.ts`** - Theme hook
   - `useTheme()` - Returns the active theme object
   - `useThemeMode()` - Returns 'dark' or 'light'

3. **`components/ThemeContext.tsx`** - Theme context provider
   - `ThemeProvider` - Wraps the app to provide theme context
   - `useThemeContext()` - Access theme, isDark, and themeMode

4. **`app/_layout.tsx`** - Root layout
   - Wraps app with `ThemeProvider`
   - Handles navigation bar and status bar theming

## Usage

### 1. Using Theme Context (Recommended for Dynamic Theming)

```tsx
import { useThemeContext } from '../components/ThemeContext';

function MyComponent() {
  const { theme, isDark, themeMode } = useThemeContext();

  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary }}>Current mode: {themeMode}</Text>
    </View>
  );
}
```

### 2. Using Static Theme Import (For Static Elements)

```tsx
import { theme } from '../theme';

function MyStaticComponent() {
  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary }}>This will always use dark theme</Text>
    </View>
  );
}
```

### 3. Using NativeWind Classes

NativeWind classes are compiled at build time and use dark theme colors. For dynamic theming with NativeWind, you'll need to use inline styles with the theme object.

```tsx
// Static (always dark)
<View className="bg-bg-primary">
  <Text className="text-text-primary">Static dark mode</Text>
</View>;

// Dynamic (responds to theme changes)
import { useThemeContext } from '../components/ThemeContext';

function MyComponent() {
  const { theme } = useThemeContext();

  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary }}>Dynamic theming</Text>
    </View>
  );
}
```

## Theme Structure

Both `darkTheme` and `lightTheme` have the same structure:

```typescript
{
  colors: {
    background: { primary, secondary, tertiary, card, ... },
    text: { primary, secondary, tertiary, muted, ... },
    accent: { primary, secondary, tertiary },
    border: { default, light, dark, accent },
    status: { success, warning, error, info, ... },
    // ... and many more
  },
  typography: { fontSize, fontWeight, lineHeight, letterSpacing },
  spacing: { padding, gap, margin },
  borderRadius: { xs, sm, md, lg, xl, ... },
  borderWidth: { none, thin, medium, thick },
  shadows: { sm, md, lg, accent, ... },
  iconSize: { xs, sm, md, lg, xl, ... },
  size: { xs, sm, md, lg, xl, ... },
  // ... and more
}
```

## Changing User Theme Preference

The theme preference is stored in the database and can be changed through the Settings:

```tsx
import { SettingsService } from '../services/SettingsService';

// Change theme
await SettingsService.setTheme('light'); // or 'dark' or 'system'
```

The app will automatically respond to theme changes.

## System Preference Detection

The app uses React Native's `useColorScheme()` hook to detect system preferences when the theme is set to 'system':

- iOS: Follows iOS system appearance
- Android: Follows Android system theme
- Web: Follows browser/OS preference

## Component Examples

### Example 1: Simple Card

```tsx
import { useThemeContext } from '../components/ThemeContext';

function MyCard() {
  const { theme } = useThemeContext();

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.padding.base,
        ...theme.shadows.md,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
        }}
      >
        Card Title
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.typography.fontSize.sm,
        }}
      >
        Card description
      </Text>
    </View>
  );
}
```

### Example 2: Themed Button

```tsx
import { Pressable, Text } from 'react-native';
import { useThemeContext } from '../components/ThemeContext';

function ThemedButton({ onPress, title }: { onPress: () => void; title: string }) {
  const { theme } = useThemeContext();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.accent.primary,
        paddingHorizontal: theme.spacing.padding.xl,
        paddingVertical: theme.spacing.padding.md,
        borderRadius: theme.borderRadius.lg,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.black,
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.semibold,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
```

## Testing Theme Switching

Use the `ThemeDebugInfo` component to test theme switching:

```tsx
import { ThemeDebugInfo } from '../components/ThemeDebugInfo';

function MyScreen() {
  return (
    <View>
      {/* Your screen content */}

      {/* Add debug info (only in development) */}
      {__DEV__ && <ThemeDebugInfo />}
    </View>
  );
}
```

## Migration Guide

### For Existing Components

1. **Components using static theme import:**
   - No changes needed if you want them to remain dark only
   - To support dynamic themes, replace `import { theme }` with `useThemeContext()`

2. **Components using NativeWind classes:**
   - Classes will continue to work with dark theme colors
   - For dynamic theming, migrate to inline styles with theme context

### Example Migration

**Before:**

```tsx
import { theme } from '../theme';

function MyComponent() {
  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary }}>Hello</Text>
    </View>
  );
}
```

**After:**

```tsx
import { useThemeContext } from '../components/ThemeContext';

function MyComponent() {
  const { theme } = useThemeContext();

  return (
    <View style={{ backgroundColor: theme.colors.background.primary }}>
      <Text style={{ color: theme.colors.text.primary }}>Hello</Text>
    </View>
  );
}
```

## Best Practices

1. **Use `useThemeContext()` for components that should respond to theme changes**
2. **Use static `theme` import for components that should always be dark**
3. **Prefer semantic color names** (e.g., `background.primary` over specific colors)
4. **Test both light and dark modes** when creating new components
5. **Consider contrast ratios** when choosing colors for accessibility

## Color Semantics

- **Background colors:** `primary` (main), `secondary` (cards), `tertiary` (sections)
- **Text colors:** `primary` (main text), `secondary` (labels), `tertiary` (hints)
- **Accent colors:** `primary` (CTAs), `secondary` (highlights), `tertiary` (subtle accents)
- **Status colors:** `success`, `warning`, `error`, `info`

## Future Enhancements

Potential improvements:

- Custom theme colors (user-defined)
- Per-screen theme overrides
- Theme transition animations
- High contrast mode support
