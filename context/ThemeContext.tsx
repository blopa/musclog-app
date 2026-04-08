import { createContext, ReactNode, useContext } from 'react';

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

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode }}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
