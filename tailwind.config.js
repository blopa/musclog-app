const { themeColors } = require('./theme.tokens'); // Plain JS tokens — Tailwind/Node cannot load theme.ts (TS + RN/DB imports)

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
      animation: {
        'spin-slow': 'spin-slow 2s linear infinite',
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      colors: {
        // Background colors
        bg: {
          primary: themeColors.background.primary,
          secondary: themeColors.background.secondary,
          tertiary: themeColors.background.tertiary,
          card: themeColors.background.card,
          cardElevated: themeColors.background.cardElevated,
          cardDark: themeColors.background.secondaryDark,
          navBar: themeColors.background.secondary,
          navActive: themeColors.background.secondaryDark,
          screen: themeColors.background.primary,
          overlay: themeColors.background.overlay,
          filterTab: themeColors.background.filterTab,
        },
        // Text colors
        text: {
          primary: themeColors.text.primary,
          secondary: themeColors.text.secondary,
          tertiary: themeColors.text.tertiary,
          muted: themeColors.text.muted,
          accent: themeColors.text.accent,
          accentLight: themeColors.text.accentLight,
          black: themeColors.text.black,
          'on-colorful': themeColors.text.onColorful,
        },
        // Accent colors
        accent: {
          primary: themeColors.accent.primary,
          secondary: themeColors.accent.secondary,
          tertiary: themeColors.accent.tertiary,
        },
        // Border colors
        border: {
          default: themeColors.border.default,
          light: themeColors.border.light,
          dark: themeColors.border.dark,
          accent: themeColors.border.accent,
          dashed: themeColors.border.dashed,
        },
      },
    },
  },
  plugins: [],
};
