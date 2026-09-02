// Plain JS tokens — Tailwind/Node cannot load theme.ts (TS + RN/DB imports)
const plugin = require('tailwindcss/plugin');

const { createTailwindColors, darkCssVariables, lightCssVariables } = require('./theme.tokens');

/**
 * Tailwind Configuration for NativeWind
 *
 * NativeWind compiles styles at build time, so a Tailwind class cannot pick
 * between two palettes on its own. Every themed colour below therefore resolves
 * to a CSS custom property, and the two palettes are written into `:root` (light)
 * and `.dark:root` (dark) by the base plugin. NativeWind swaps the whole set at
 * runtime — on native as well as web — whenever the colour scheme changes, which
 * `ThemeProvider` drives from the stored theme preference.
 *
 * So both of these follow the active theme, and either is fine to use:
 *
 *   <View className="bg-bg-card" />
 *   <View style={{ backgroundColor: theme.colors.background.card }} />   // useTheme()
 *
 * Colours outside this map (status hues, gradients, washes) are only available
 * through `useTheme()`/`useThemeContext()`.
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
      colors: createTailwindColors(),
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': lightCssVariables,
        // `darkMode: 'class'` above makes this the dark set; NativeWind resolves
        // it from the runtime colour scheme rather than from a DOM class on native.
        '.dark:root': darkCssVariables,
      });
    }),
  ],
};
