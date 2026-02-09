import { useColorScheme } from 'react-native';

import type { ThemeOption } from '../constants/settings';
import { darkTheme, lightTheme, type Theme } from '../theme';
import { useSettings } from './useSettings';

/**
 * Custom hook to get the active theme based on user preference and system settings
 * @returns The active theme object (dark or light)
 */
export function useTheme(): Theme {
  // Get user's stored theme preference
  const { theme: themePreference } = useSettings();

  // Get system color scheme
  const systemColorScheme = useColorScheme();

  // Determine the effective theme
  const effectiveTheme = getEffectiveTheme(themePreference, systemColorScheme);

  return effectiveTheme === 'dark' ? darkTheme : lightTheme;
}

/**
 * Hook to get the current theme mode ('dark' or 'light')
 * @returns 'dark' | 'light'
 */
export function useThemeMode(): 'dark' | 'light' {
  const { theme: themePreference } = useSettings();
  const systemColorScheme = useColorScheme();

  return getEffectiveTheme(themePreference, systemColorScheme);
}

/**
 * Determine the effective theme based on preference and system settings
 */
function getEffectiveTheme(
  preference: ThemeOption,
  systemColorScheme: 'light' | 'dark' | null | undefined
): 'dark' | 'light' {
  if (preference === 'system') {
    // Follow system preference
    return systemColorScheme === 'light' ? 'light' : 'dark';
  }

  // Use explicit preference
  return preference === 'light' ? 'light' : 'dark';
}
