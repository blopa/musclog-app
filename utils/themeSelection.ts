import { normalizeThemeOption, type ThemeId, type ThemeOption } from '@/constants/settings';

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
  return themeId === 'kinetic-light' ? 'light' : 'dark';
}
