const { darkTheme } = require('./theme');

/**
 * Tailwind Configuration for NativeWind
 *
 * NOTE: NativeWind compiles styles at build time, so Tailwind classes cannot
 * dynamically switch between themes. For dynamic theme support:
 *
 * 1. Use inline styles with the theme object from useThemeContext():
 *    const { theme } = useThemeContext();
 *    <View style={{ backgroundColor: theme.colors.background.primary }} />
 *
 * 2. Or use Tailwind classes for static elements:
 *    <View className="bg-bg-primary" />
 *
 * This config uses dark theme colors for Tailwind classes as the default.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './app/**/*.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Background colors
        bg: {
          primary: darkTheme.colors.background.primary,
          secondary: darkTheme.colors.background.secondary,
          tertiary: darkTheme.colors.background.tertiary,
          card: darkTheme.colors.background.card,
          cardElevated: darkTheme.colors.background.cardElevated,
          cardDark: darkTheme.colors.background.secondaryDark,
          navBar: darkTheme.colors.background.secondary,
          navActive: darkTheme.colors.background.secondaryDark,
          screen: darkTheme.colors.background.primary,
          overlay: darkTheme.colors.background.overlay,
          filterTab: darkTheme.colors.background.filterTab,
        },
        // Text colors
        text: {
          primary: darkTheme.colors.text.primary,
          secondary: darkTheme.colors.text.secondary,
          tertiary: darkTheme.colors.text.tertiary,
          muted: darkTheme.colors.text.muted,
          accent: darkTheme.colors.text.accent,
          accentLight: darkTheme.colors.text.accentLight,
          black: darkTheme.colors.text.black,
        },
        // Accent colors
        accent: {
          primary: darkTheme.colors.accent.primary,
          secondary: darkTheme.colors.accent.secondary,
          tertiary: darkTheme.colors.accent.tertiary,
        },
        // Border colors
        border: {
          default: darkTheme.colors.border.default,
          light: darkTheme.colors.border.light,
          dark: darkTheme.colors.border.dark,
          accent: darkTheme.colors.border.accent,
          dashed: darkTheme.colors.border.dashed,
        },
      },
    },
  },
  plugins: [],
};
