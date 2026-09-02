import { vars } from 'nativewind';
import { createContext, type ReactNode, useContext } from 'react';
import { Platform, View } from 'react-native';

import { darkTheme, type Theme } from '@/theme';
import { darkCssVariables, darkNativeCssVariables } from '@/theme.tokens';

export type ForcedTheme = {
  theme: Theme;
  themeMode: 'dark' | 'light';
};

const ForcedThemeContext = createContext<ForcedTheme | null>(null);

/** The theme pinned by an enclosing `ForcedDarkTheme`, or null under the normal theme. */
export function useForcedTheme(): ForcedTheme | null {
  return useContext(ForcedThemeContext);
}

const FORCED_DARK: ForcedTheme = { theme: darkTheme, themeMode: 'dark' };

// `vars()` types values as string | number, but the native runtime wants the
// already-parsed `[r, g, b]` channels the CSS parser would have produced.
const DARK_VARS = vars(
  (Platform.OS === 'web' ? darkCssVariables : darkNativeCssVariables) as Record<
    `--${string}`,
    string | number
  >
);

/**
 * Pins a subtree to the dark palette regardless of the user's theme preference.
 *
 * For surfaces whose background is not the app's — a live camera preview, a photo,
 * or a scrim over either. Their content is white-on-dark in every theme, so
 * following the light palette would print near-black controls onto a dark
 * viewfinder.
 *
 * Both halves of the styling system need pinning, and they pin at different
 * points in the tree:
 *
 * - `ForcedDarkTheme` wraps the surface's visual root. Its View carries the
 *   NativeWind custom properties, so every `className` colour rendered inside it
 *   resolves dark — including content passed in as a slot from a component that
 *   itself sits outside.
 * - `ForcedDarkThemeScope` wraps a whole component. A component reads `useTheme()`
 *   during its own render, before its JSX is placed anywhere, so a provider around
 *   its output cannot reach its inline styles; the scope has to be an ancestor of
 *   the component itself.
 */
export function ForcedDarkTheme({ children }: { children: ReactNode }) {
  return (
    <ForcedThemeContext.Provider value={FORCED_DARK}>
      <View style={[{ flex: 1 }, DARK_VARS]}>{children}</View>
    </ForcedThemeContext.Provider>
  );
}

/** Context only — no wrapper View, so it adds nothing to the layout. */
export function ForcedDarkThemeScope({ children }: { children: ReactNode }) {
  return <ForcedThemeContext.Provider value={FORCED_DARK}>{children}</ForcedThemeContext.Provider>;
}
