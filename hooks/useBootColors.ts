import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '@/theme.tokens';

/**
 * Palette for the pre-boot surfaces (splash, boot progress, the root shell).
 *
 * These render before `SettingsProvider` exists, so the stored theme preference
 * is not readable yet and the system scheme is the only signal available. Pulling
 * from `theme.tokens` rather than `theme.ts` keeps them importable before the
 * database layer loads.
 */
export function useBootColors(): typeof darkColors {
  return useColorScheme() === 'light' ? lightColors : darkColors;
}
