import { colorScheme, vars } from 'nativewind';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';

import type { ThemeId } from '@/constants/settings';
import { useSettings } from '@/hooks/useSettings';
import { useTheme, useThemeId, useThemeMode } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import {
  kineticDepthCssVariables,
  kineticDepthNativeCssVariables,
  kineticLightCssVariables,
  kineticLightNativeCssVariables,
  kineticShockCssVariables,
  kineticShockNativeCssVariables,
  kineticVoltCssVariables,
  kineticVoltNativeCssVariables,
} from '@/theme.tokens';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: 'dark' | 'light';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type CssVariableMap = Record<`--${string}`, string | number>;

function runtimeVariables(webVariables: unknown, nativeVariables: unknown) {
  return vars(
    (Platform.OS === 'web' ? webVariables : nativeVariables) as Record<
      `--${string}`,
      string | number
    >
  );
}

const THEME_VARIABLES: Record<ThemeId, ReturnType<typeof vars>> = {
  'kinetic-depth': runtimeVariables(kineticDepthCssVariables, kineticDepthNativeCssVariables),
  'kinetic-light': runtimeVariables(kineticLightCssVariables, kineticLightNativeCssVariables),
  'kinetic-shock': runtimeVariables(kineticShockCssVariables, kineticShockNativeCssVariables),
  'kinetic-volt': runtimeVariables(kineticVoltCssVariables, kineticVoltNativeCssVariables),
};

const WEB_THEME_VARIABLES: Record<ThemeId, CssVariableMap> = {
  'kinetic-depth': kineticDepthCssVariables as CssVariableMap,
  'kinetic-light': kineticLightCssVariables as CssVariableMap,
  'kinetic-shock': kineticShockCssVariables as CssVariableMap,
  'kinetic-volt': kineticVoltCssVariables as CssVariableMap,
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const themeId = useThemeId();
  const themeMode = useThemeMode();
  const { theme: themePreference } = useSettings();
  const isDark = themeMode === 'dark';

  // NativeWind still has a binary colour scheme for dark: variants. Named theme
  // colours come from the variable set on the root below. On native, preserving
  // 'system' clears the Appearance override so later OS changes keep flowing.
  useEffect(() => {
    colorScheme.set(Platform.OS === 'web' || themePreference !== 'system' ? themeMode : 'system');
  }, [themeMode, themePreference]);

  // Web modals may portal to <body>, outside the provider View. Publishing the
  // variables on :root keeps those surfaces on the selected named palette too.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    for (const [name, value] of Object.entries(WEB_THEME_VARIABLES[themeId])) {
      document.documentElement.style.setProperty(name, String(value));
    }
  }, [themeId]);

  const value = useMemo(() => ({ theme, isDark, themeMode }), [theme, isDark, themeMode]);

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

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}
