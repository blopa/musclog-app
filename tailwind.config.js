// Plain JS tokens — Tailwind/Node cannot load theme.ts (TS + RN/DB imports)
const plugin = require('tailwindcss/plugin');

const { createTailwindColors, darkCssVariables, lightCssVariables } = require('./theme.tokens');

/**
 * Tailwind Configuration for NativeWind
 *
 * NativeWind compiles styles at build time, so a Tailwind class cannot pick among
 * named palettes on its own. Every themed colour below therefore resolves to a
 * CSS custom property. These base rules supply the Kinetic Light/Depth defaults;
 * `ThemeProvider` overrides the variables with the selected named palette at
 * runtime and uses NativeWind's binary scheme only for `dark:` variants.
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
