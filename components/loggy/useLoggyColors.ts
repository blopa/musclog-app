import { LOGGY_CLASSIC, loggyColorsForTheme } from '@/constants/loggyTheme';
import { useThemeIdOrNull } from '@/hooks/useTheme';

/** Loggy's three greens (see `constants/loggyTheme.js`): what a pose draws its body, shade and stripes in. */
export type LoggyColors = {
  readonly body: string;
  readonly deep: string;
  readonly shade: string;
};

/**
 * Which greens a Loggy is drawn in. `theme` (the default) follows the active theme, so he matches
 * the screen he is on. `classic` is the green he was drawn in, for a surface built around him that
 * must not follow the theme: the Year in Musclog posters take their ground from Loggy's palette
 * (`constants/loggyPalette.ts`), and a pink log on the coral poster would disappear.
 */
export type LoggyAppearance = 'theme' | 'classic';

/**
 * The greens to draw Loggy in. Outside a ThemeProvider (a test, a surface drawn on its own) there
 * is no theme to follow, so he is classic.
 */
export function useLoggyColors(appearance: LoggyAppearance = 'theme'): LoggyColors {
  const themeId = useThemeIdOrNull();

  if (appearance === 'classic' || themeId === null) {
    return LOGGY_CLASSIC;
  }

  return loggyColorsForTheme(themeId);
}
