import { normalizeThemeOption, type ThemeId, type ThemeOption } from '@/constants/settings';
import { THEME_DEFINITIONS } from '@/theme.registry';

export function resolveThemeId(
  preference: ThemeOption | string | null | undefined,
  systemColorScheme: string | null | undefined
): ThemeId {
  const normalizedPreference = normalizeThemeOption(preference);
  if (normalizedPreference === 'system') {
    return systemColorScheme === 'light' ? 'kinetic-light' : 'kinetic-depth';
  }

  return normalizedPreference;
}

export function getThemeMode(themeId: ThemeId): 'dark' | 'light' {
  return THEME_DEFINITIONS[themeId].mode;
}
