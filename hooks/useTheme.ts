import type { ThemeId } from '@/constants/settings';
import { useThemeContext } from '@/context/ThemeContext';
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
