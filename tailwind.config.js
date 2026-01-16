const { theme } = require('./theme');

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
          primary: theme.colors.background.primary,
          secondary: theme.colors.background.secondary,
          tertiary: theme.colors.background.tertiary,
          card: theme.colors.background.card,
          cardElevated: theme.colors.background.cardElevated,
          cardDark: theme.colors.background.secondaryDark,
          navBar: theme.colors.background.secondary,
          navActive: theme.colors.background.secondaryDark,
          screen: theme.colors.background.primary,
          overlay: theme.colors.background.overlay,
          filterTab: theme.colors.background.filterTab,
        },
        // Text colors
        text: {
          primary: theme.colors.text.primary,
          secondary: theme.colors.text.secondary,
          tertiary: theme.colors.text.tertiary,
          muted: theme.colors.text.muted,
          accent: theme.colors.text.accent,
          accentLight: theme.colors.text.accentLight,
          black: theme.colors.text.black,
        },
        // Accent colors
        accent: {
          primary: theme.colors.accent.primary,
          secondary: theme.colors.accent.secondary,
          tertiary: theme.colors.accent.tertiary,
        },
        // Border colors
        border: {
          default: theme.colors.border.default,
          light: theme.colors.border.light,
          dark: theme.colors.border.dark,
          accent: theme.colors.border.accent,
          dashed: theme.colors.border.dashed,
        },
      },
    },
  },
  plugins: [],
};
