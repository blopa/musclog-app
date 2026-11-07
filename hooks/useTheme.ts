import type { ThemeId, ThemeOption } from '@/constants/settings';
import { useThemeContext, useThemeContextOrNull } from '@/context/ThemeContext';
import type { Theme } from '@/theme';

/** Return the active palette, including any enclosing scoped override. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** Return the active palette's binary display mode for system UI integrations. */
export function useThemeMode(): 'dark' | 'light' {
  return useThemeContext().themeMode;
}

/** Return the active named palette identity. */
export function useThemeId(): ThemeId {
  return useThemeContext().themeId;
}

/** The active named palette, or `null` outside a ThemeProvider. See `useThemeContextOrNull`. */
export function useThemeIdOrNull(): ThemeId | null {
  return useThemeContextOrNull()?.themeId ?? null;
}

/** Return the stored appearance choice, with `system` preserved as itself. */
export function useThemePreference(): ThemeOption {
  return useThemeContext().themePreference;
}
