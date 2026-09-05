import { colorScheme, vars } from 'nativewind';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { Platform, useColorScheme, View } from 'react-native';

import type { ThemeId, ThemeOption } from '@/constants/settings';
import { useSettings } from '@/hooks/useSettings';
import { type Theme, THEMES } from '@/theme';
import { themeCssVariables, themeNativeCssVariables } from '@/theme.tokens';
import {
  getServerThemeMirror,
  getThemeMirror,
  recordResolvedTheme,
  subscribeToThemeMirror,
} from '@/utils/themeMirror';
import { getThemeMode, resolveThemeId } from '@/utils/themeSelection';

type ThemeContextValue = {
  theme: Theme;
  themeId: ThemeId;
  themeMode: 'dark' | 'light';
  /** The stored choice, not the resolved palette — `system` stays visible as itself. */
  themePreference: ThemeOption;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type CssVariableMap = Record<`--${string}`, string | number>;

const runtimeVariableMaps = Platform.OS === 'web' ? themeCssVariables : themeNativeCssVariables;

// NativeWind's public type only admits CSS strings/numbers, while its native
// runtime consumes pre-parsed RGB channel tuples. Keep that library-boundary
// cast in one adapter instead of leaking it through providers and components.
const THEME_VARIABLES = Object.fromEntries(
  Object.entries(runtimeVariableMaps).map(([themeId, variableMap]) => [
    themeId,
    vars(variableMap as CssVariableMap),
  ])
) as Record<ThemeId, ReturnType<typeof vars>>;

function valueForTheme(themeId: ThemeId, themePreference: ThemeOption): ThemeContextValue {
  return {
    theme: THEMES[themeId],
    themeId,
    themeMode: getThemeMode(themeId),
    themePreference,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isLoading, theme: storedPreference } = useSettings();
  const mirror = useSyncExternalStore(subscribeToThemeMirror, getThemeMirror, getServerThemeMirror);
  const systemColorScheme = useColorScheme();

  // `isLoading` stays true wherever the settings table is unreadable — the
  // marketing site, where nobody has onboarded, and the first frames everywhere
  // else. The mirror carries the preference through both. See `utils/themeMirror`.
  const themePreference = isLoading && mirror ? mirror.preference : storedPreference;
  const themeId = resolveThemeId(themePreference, systemColorScheme);
  const value = useMemo(() => valueForTheme(themeId, themePreference), [themeId, themePreference]);

  useEffect(() => {
    // While the settings table is unreadable the mirror *is* the preference, so
    // there is nothing authoritative to write back. Writing anyway would clobber
    // the visitor's choice with the `system` default during hydration, when
    // `useSyncExternalStore` is still serving the (empty) server snapshot.
    if (isLoading && !mirror) {
      return;
    }

    recordResolvedTheme(themePreference, themeId);
  }, [isLoading, mirror, themeId, themePreference]);

  useEffect(() => {
    colorScheme.set(
      Platform.OS === 'web' || themePreference !== 'system' ? value.themeMode : 'system'
    );
    return () => colorScheme.set('system');
  }, [themePreference, value.themeMode]);

  // Web modals portal to <body>, outside the provider View. Publish the active
  // variables on :root and remove the inline override when this provider leaves.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const variables = themeCssVariables[themeId] as CssVariableMap;
    for (const [name, variableValue] of Object.entries(variables)) {
      document.documentElement.style.setProperty(name, String(variableValue));
    }

    // Leaving the variables on :root when this provider unmounts is deliberate:
    // removing them would drop the page back to the Tailwind defaults mid-session.
  }, [themeId]);

  return (
    <ThemeContext.Provider value={value}>
      <View
        style={[
          Platform.OS === 'web' ? { flex: 1, minHeight: '100%', width: '100%' } : { flex: 1 },
          THEME_VARIABLES[themeId],
        ]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/**
 * Pins one visual surface to a named theme without changing the app preference.
 *
 * Context and NativeWind variables move together, so inline and className styles
 * inside the scope's subtree can never observe different palettes. Content that
 * leaves that subtree does not follow: on web a modal portalled to `<body>` sees
 * the `:root` variables `ThemeProvider` publishes, which are the app's theme.
 */
export function ThemeScope({ children, themeId }: { children: ReactNode; themeId: ThemeId }) {
  const value = useMemo(() => valueForTheme(themeId, themeId), [themeId]);
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, THEME_VARIABLES[themeId]]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}
