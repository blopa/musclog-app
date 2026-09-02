import { colorScheme } from 'nativewind';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useSettings } from '@/hooks/useSettings';
import { useTheme, useThemeMode } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: 'dark' | 'light';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const { theme: themePreference } = useSettings();
  const isDark = themeMode === 'dark';

  // NativeWind resolves `className` colours from its own colour scheme, so the
  // stored preference has to be pushed into it or Tailwind classes would keep
  // rendering the dark palette while `useTheme()` returned the light one.
  //
  // The two platforms want different arguments. On native, 'system' clears the
  // app's Appearance override so OS changes keep flowing through; passing a
  // resolved value there would pin the app to whatever the OS happened to be at
  // that moment. On web there is no override to clear — 'system' just drops the
  // `dark` class, which resolves to the light palette — so it gets the mode we
  // already resolved.
  useEffect(() => {
    colorScheme.set(Platform.OS === 'web' ? themeMode : themePreference);
  }, [themeMode, themePreference]);

  const value = useMemo(() => ({ theme, isDark, themeMode }), [theme, isDark, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}
