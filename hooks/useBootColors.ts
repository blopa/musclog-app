import { useSyncExternalStore } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { darkColors, lightColors, themeColorSetsById } from '@/theme.tokens';
import {
  getServerSettingsMirror,
  getSettingsMirror,
  subscribeToSettingsMirror,
} from '@/utils/settingsMirror';
import { getThemeMirror } from '@/utils/themeMirror';
import { resolveThemeId } from '@/utils/themeSelection';

/**
 * The palette the last session settled on, read straight from the web mirror.
 *
 * Module scope on purpose: the shell renders once before anything else, and a
 * later read would repaint it. See `utils/themeMirror` for why the mirror exists.
 */
const MIRRORED_COLORS =
  Platform.OS === 'web' ? themeColorSetsById[getThemeMirror()?.themeId ?? ''] : undefined;

/**
 * Palette for the pre-boot surfaces (splash, boot progress, the root shell).
 *
 * These render before `SettingsProvider` exists, so the stored theme preference
 * is not readable yet and the system scheme is the only signal available — a
 * mirror stands in for it: on web the theme mirror, read once at module load; on
 * native the settings mirror, which arrives asynchronously from AsyncStorage and
 * so is subscribed to. Pulling from `theme.tokens` rather than
 * `theme.ts` keeps them importable before the database layer loads.
 */
export function useBootColors(): typeof darkColors {
  const systemScheme = useColorScheme();
  const settings = useSyncExternalStore(
    subscribeToSettingsMirror,
    getSettingsMirror,
    getServerSettingsMirror
  );
  const systemColors = systemScheme === 'light' ? lightColors : darkColors;

  if (Platform.OS === 'web') {
    return MIRRORED_COLORS ?? systemColors;
  }

  return settings ? themeColorSetsById[resolveThemeId(settings.theme, systemScheme)] : systemColors;
}
