import { Platform, useColorScheme } from 'react-native';

import { darkColors, lightColors, themeColorSetsById } from '@/theme.tokens';
import { getThemeMirror } from '@/utils/themeMirror';

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
 * is not readable yet and the system scheme is the only signal available — on
 * web the mirror stands in for it. Pulling from `theme.tokens` rather than
 * `theme.ts` keeps them importable before the database layer loads.
 */
export function useBootColors(): typeof darkColors {
  const systemColors = useColorScheme() === 'light' ? lightColors : darkColors;
  return MIRRORED_COLORS ?? systemColors;
}
