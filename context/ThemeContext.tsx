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

const subscribeToNothing = () => () => {};

/**
 * `false` only while React hydrates server-rendered HTML, `true` on every client render.
 *
 * During hydration `useSyncExternalStore` serves server snapshots, so the theme mirror reads as
 * empty and the provider resolves the default palette. Anything it publishes from that render
 * would overwrite what the pre-paint script in `app/+html.tsx` already applied from the mirror.
 */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}

function valueForTheme(themeId: ThemeId, themePreference: ThemeOption): ThemeContextValue {
  return {
    theme: THEMES[themeId],
    themeId,
    themeMode: getThemeMode(themeId),
    themePreference,
  };
}

/**
 * `preferMirror` lets the web theme mirror outrank the settings row whenever it exists, not only
 * while the row is unreadable. The website passes it: every theme change in this browser reaches
 * the mirror (the website picker writes it, and this provider records the app's resolved theme
 * into it), while a website write to the row can be lost before a slow database opens, which let
 * a stale row undo the visitor's choice. `WebsiteThemeSync` copies the mirror back into the row.
 */
export function ThemeProvider({
  children,
  preferMirror = false,
}: {
  children: ReactNode;
  preferMirror?: boolean;
}) {
  const { isLoading, theme: storedPreference } = useSettings();
  const mirror = useSyncExternalStore(subscribeToThemeMirror, getThemeMirror, getServerThemeMirror);
  const systemColorScheme = useColorScheme();
  const hydrated = useIsHydrated();

  // `isLoading` stays true wherever the settings table is unreadable — the
  // marketing site, where nobody has onboarded, and the first frames everywhere
  // else. On web the theme mirror carries the preference through both (see
  // `utils/themeMirror`); on native `SettingsProvider` already starts from the
  // settings mirror, so `storedPreference` is right from the first frame.
  const themePreference =
    mirror && (isLoading || preferMirror) ? mirror.preference : storedPreference;
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

  // On web the palette lives on :root only: modals portal to <body>, outside the
  // provider View, and the pre-paint script in `app/+html.tsx` has already put the
  // visitor's palette there before the body rendered. Skip the hydration render,
  // which can only resolve the default palette (see `useIsHydrated`).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !hydrated) {
      return;
    }

    const variables = themeCssVariables[themeId] as CssVariableMap;
    for (const [name, variableValue] of Object.entries(variables)) {
      document.documentElement.style.setProperty(name, String(variableValue));
    }

    // What the website's Loggy stylesheet selects on; `app/+html.tsx` sets it before first paint.
    document.documentElement.setAttribute('data-theme-id', themeId);

    // Leaving the variables on :root when this provider unmounts is deliberate:
    // removing them would drop the page back to the Tailwind defaults mid-session.
  }, [hydrated, themeId]);

  return (
    <ThemeContext.Provider value={value}>
      <View
        style={
          // Never inline the palette on web. The static export renders this View with
          // the default palette (it cannot read the visitor's storage), and an inline
          // value here outranks :root for the whole page, so every statically served
          // page showed the default theme until the bundle loaded and hydrated.
          Platform.OS === 'web'
            ? { flex: 1, minHeight: '100%', width: '100%' }
            : [{ flex: 1 }, THEME_VARIABLES[themeId]]
        }
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

/**
 * The active theme, or `null` outside a ThemeProvider (a test that renders one component, a
 * surface drawn on its own). For the few readers that have a sensible default, such as Loggy's
 * colours; everything else wants `useThemeContext`, which fails loudly.
 */
export function useThemeContextOrNull(): ThemeContextValue | null {
  return useContext(ThemeContext) ?? null;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}
