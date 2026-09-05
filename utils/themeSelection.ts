import { THEME_IDS, type ThemeId, type ThemeOption } from '@/constants/settings';
import { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS } from '@/theme.registry';

/** Preserve preferences written before themes gained stable, named identities. */
export function normalizeThemeOption(value: string | null | undefined): ThemeOption {
  if (value === 'dark') {
    return DEFAULT_THEME_BY_MODE.dark;
  }

  if (value === 'light') {
    return DEFAULT_THEME_BY_MODE.light;
  }

  if (value === 'system' || THEME_IDS.includes(value as ThemeId)) {
    return value as ThemeOption;
  }

  return 'system';
}

export function resolveThemeId(
  preference: ThemeOption | string | null | undefined,
  systemColorScheme: string | null | undefined
): ThemeId {
  const normalizedPreference = normalizeThemeOption(preference);
  if (normalizedPreference === 'system') {
    return systemColorScheme === 'light' ? DEFAULT_THEME_BY_MODE.light : DEFAULT_THEME_BY_MODE.dark;
  }

  return normalizedPreference;
}

export function getThemeMode(themeId: ThemeId): 'dark' | 'light' {
  return THEME_DEFINITIONS[themeId].mode;
}
