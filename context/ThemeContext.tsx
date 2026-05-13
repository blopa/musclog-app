import { createContext, ReactNode, useContext, useMemo } from 'react';

import { useTheme, useThemeMode } from '@/hooks/useTheme';
import type { Theme } from '@/theme';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  themeMode: 'dark' | 'light';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const themeMode = useThemeMode();
  const isDark = themeMode === 'dark';
  const value = useMemo(() => ({ theme, isDark, themeMode }), [theme, isDark, themeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }

  return context;
}
