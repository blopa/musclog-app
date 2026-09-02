import { useColorScheme } from 'react-native';

import type { ThemeId } from '@/constants/settings';
import { useForcedTheme } from '@/context/ForcedThemeContext';
// only place that it's ok to import from theme
import { type Theme, THEMES } from '@/theme';
import { getThemeMode, resolveThemeId } from '@/utils/themeSelection';

import { useSettings } from './useSettings';

/**
 * Custom hook to get the active theme based on user preference and system settings
 * @returns The active named theme object
 */
export function useTheme(): Theme {
  // A surface that pins its own palette (a camera viewfinder) wins over the preference
  const forced = useForcedTheme();

  // Get user's stored theme preference
  const { theme: themePreference } = useSettings();

  // Get system color scheme
  const systemColorScheme = useColorScheme();

  // Determine the effective theme
  const themeId = resolveThemeId(themePreference, systemColorScheme);

  if (forced) {
    return forced.theme;
  }

  return THEMES[themeId];
}

/**
 * Hook to get the current theme mode ('dark' or 'light')
 * @returns 'dark' | 'light'
 */
export function useThemeMode(): 'dark' | 'light' {
  const forced = useForcedTheme();
  const { theme: themePreference } = useSettings();
  const systemColorScheme = useColorScheme();

  if (forced) {
    return forced.themeMode;
  }

  return getThemeMode(resolveThemeId(themePreference, systemColorScheme));
}

/** Resolve the palette identity, independently from its light/dark display mode. */
export function useThemeId(): ThemeId {
  const forced = useForcedTheme();
  const { theme: themePreference } = useSettings();
  const systemColorScheme = useColorScheme();

  if (forced) {
    return 'kinetic-depth';
  }

  return resolveThemeId(themePreference, systemColorScheme);
}
