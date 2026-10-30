'use strict';

/**
 * The canonical catalogue of selectable themes.
 *
 * This file stays plain JavaScript because both the React Native bundle and
 * Tailwind's Node process consume it. A theme's identity, display mode and
 * primitive palette belong together; every downstream representation is derived
 * from this object.
 *
 * A theme carries no component-level presentation flags. Anything a component
 * would branch on is expressed as palette values instead — a theme that wants a
 * flat summary card sets its gradient stops flat (see `colorfulCardBlend`).
 */
const THEME_DEFINITIONS = /** @type {const} */ ({
  'kinetic-depth': {
    mode: 'dark',
    palette: {
      surfaceBase: '#0d1210',
      surfaceCard: '#171c19',
      surfaceRaised: '#202522',
      surfaceTint: '#0c2419',
      surfaceAccent: '#1c3829',
      borderHairline: '#313834',

      textPrimary: '#dce5de',
      textSecondary: '#a3ada9',
      textTertiary: '#858e8b',

      brandPrimary: '#29a577',
      brandVivid: '#10b981',
      brandBright: '#34d399',
      brandPale: '#a7f3d0',
      brandDeep: '#0f766e',
      brandSurface: '#064e3b',

      statusError: '#ef4444',
      statusRose: '#da2552',
      statusWarning: '#f97316',
      statusAmber: '#fbbf24',
      statusInfo: '#3b82f6',
      statusIndigo: '#6366f1',
      statusPurple: '#a855f7',
      statusPink: '#ec4899',

      inkOnAccent: '#091310',
      scrimBase: '#091310',
      surfacePlaceholder: '#dce5de',

      alphas: {
        borderDefault: 0.26,
        borderLight: 0.23,
        borderSubtle: 0.2,
        hairlineFill: 0.05,
      },
      colorfulCardBlend: { start: 1, middle: 1, end: 1 },
      colorfulCardUsesSurfaceInk: false,
    },
  },
  'kinetic-light': {
    mode: 'light',
    palette: {
      surfaceBase: '#fbfcfb',
      surfaceCard: '#eff1f0',
      surfaceRaised: '#e2e6e4',
      surfaceTint: '#dff0e7',
      surfaceAccent: '#c6e6d4',
      borderHairline: '#c7cdca',

      textPrimary: '#0f1a16',
      textSecondary: '#49534f',
      textTertiary: '#57615c',

      brandPrimary: '#0e7a54',
      brandVivid: '#0a6647',
      brandBright: '#0f8f63',
      brandPale: '#0b7d57',
      brandDeep: '#0b6b64',
      brandSurface: '#075038',

      statusError: '#c62222',
      statusRose: '#c0184a',
      statusWarning: '#b4530a',
      statusAmber: '#8a6100',
      statusInfo: '#1d6fd6',
      statusIndigo: '#4f46e5',
      statusPurple: '#8626d4',
      statusPink: '#c02a72',

      inkOnAccent: '#ffffff',
      scrimBase: '#0f1a16',
      surfacePlaceholder: '#d6ded9',

      alphas: {
        borderDefault: 0.34,
        borderLight: 0.55,
        borderSubtle: 0.26,
        hairlineFill: 0.09,
      },
      // A flat gradient: every stop collapses to `surfaceCard`, so the summary
      // card renders as an ordinary card without the component branching on a
      // presentation flag.
      colorfulCardBlend: { start: 0, middle: 0, end: 0 },
      colorfulCardUsesSurfaceInk: true,
    },
  },
  'kinetic-shock': {
    mode: 'dark',
    palette: {
      surfaceBase: '#130d12',
      surfaceCard: '#1c141a',
      surfaceRaised: '#271d25',
      surfaceTint: '#351226',
      surfaceAccent: '#51203f',
      borderHairline: '#473843',

      textPrimary: '#f5e4ef',
      textSecondary: '#c4b5be',
      textTertiary: '#ad9ba5',

      brandPrimary: '#e85d9e',
      brandVivid: '#f472b6',
      brandBright: '#f9a8d4',
      brandPale: '#fbcfe8',
      brandDeep: '#db2777',
      brandSurface: '#831843',

      statusError: '#f87171',
      statusRose: '#fb7185',
      statusWarning: '#fb923c',
      statusAmber: '#fbbf24',
      statusInfo: '#60a5fa',
      statusIndigo: '#818cf8',
      statusPurple: '#c084fc',
      statusPink: '#e879f9', // Fuchsia, not pink: the brand IS pink here, and
      // macros.carbs (brandVivid) and macros.fiber (statusPink) share a legend.

      inkOnAccent: '#160b14',
      scrimBase: '#0d070c',
      surfacePlaceholder: '#f5e4ef',

      alphas: {
        borderDefault: 0.3,
        borderLight: 0.28,
        borderSubtle: 0.22,
        hairlineFill: 0.06,
      },
      colorfulCardBlend: { start: 1, middle: 1, end: 1 },
      colorfulCardUsesSurfaceInk: false,
    },
  },
  'kinetic-volt': {
    mode: 'dark',
    palette: {
      surfaceBase: '#14120d',
      surfaceCard: '#1e1b14',
      surfaceRaised: '#29251c',
      surfaceTint: '#30270a',
      surfaceAccent: '#4a3b08',
      borderHairline: '#464135',

      textPrimary: '#f6f0d5',
      textSecondary: '#cac5b0',
      textTertiary: '#aea991',

      brandPrimary: '#f5c842',
      brandVivid: '#eab308',
      brandBright: '#facc15',
      brandPale: '#fef08a',
      brandDeep: '#ca8a04',
      brandSurface: '#713f12',

      statusError: '#f87171',
      statusRose: '#fb7185',
      statusWarning: '#fb923c',
      statusAmber: '#fde047',
      statusInfo: '#60a5fa',
      statusIndigo: '#818cf8',
      statusPurple: '#c084fc',
      statusPink: '#f472b6',

      inkOnAccent: '#151208',
      scrimBase: '#0d0b05',
      surfacePlaceholder: '#f6f0d5',
      colorfulCardInk: '#151208',
      colorfulCardSupportingInk: '#30280d',

      alphas: {
        borderDefault: 0.3,
        borderLight: 0.28,
        borderSubtle: 0.22,
        hairlineFill: 0.06,
      },
      colorfulCardBlend: { start: 1, middle: 1, end: 1 },
      colorfulCardUsesSurfaceInk: false,
    },
  },
  'kinetic-blush': {
    mode: 'light',
    palette: {
      surfaceBase: '#fcf8fa',
      surfaceCard: '#f5ecf0',
      surfaceRaised: '#e9dae1',
      surfaceTint: '#fadeeb',
      surfaceAccent: '#eec0d6',
      borderHairline: '#cdb9c2',

      textPrimary: '#2b101d',
      textSecondary: '#4e353f',
      textTertiary: '#5b4049',

      brandPrimary: '#c2185b',
      brandVivid: '#ad1457',
      brandBright: '#d81b60',
      brandPale: '#b81a5c',
      brandDeep: '#96114b',
      brandSurface: '#7a0c3d',

      statusError: '#c62222',
      statusRose: '#b3123f',
      statusWarning: '#b4530a',
      statusAmber: '#8a6100',
      statusInfo: '#1d6fd6',
      statusIndigo: '#4f46e5',
      statusPurple: '#8626d4',
      statusPink: '#b5179e', // Magenta, not pink: the brand IS pink here, so
      // macros.carbs (brandVivid) and macros.fiber (statusPink) would otherwise
      // be the same swatch in a shared legend. Same reason as Kinetic Shock.

      inkOnAccent: '#ffffff',
      scrimBase: '#2b101d',
      surfacePlaceholder: '#eed3de',

      alphas: {
        borderDefault: 0.34,
        borderLight: 0.55,
        borderSubtle: 0.26,
        hairlineFill: 0.09,
      },
      // A light theme that still wants the summary card to sweep — a pale wash of
      // the palette rather than the flat card Kinetic Light chooses. Display mode
      // does not decide this; the stops do.
      colorfulCardBlend: { start: 0.16, middle: 0.14, end: 0.2 },
      colorfulCardUsesSurfaceInk: true,
    },
  },
  'kinetic-varia': {
    mode: 'dark',
    palette: {
      surfaceBase: '#0c0b0f',
      surfaceCard: '#16131c',
      surfaceRaised: '#221d2a',
      surfaceTint: '#291509',
      surfaceAccent: '#4a220d',
      borderHairline: '#413849',

      textPrimary: '#f6e9dd',
      textSecondary: '#bfb6c1',
      textTertiary: '#a199a5',

      brandPrimary: '#f97316',
      brandVivid: '#fb923c',
      brandBright: '#fdba74',
      brandPale: '#fed7aa',
      brandDeep: '#ea580c',
      brandSurface: '#7c2d12',

      statusError: '#f43f5e',
      statusRose: '#fb7185',
      statusWarning: '#facc15',
      statusAmber: '#fde047',
      statusInfo: '#38bdf8',
      statusIndigo: '#818cf8',
      statusPurple: '#c084fc',
      statusPink: '#f472b6',

      inkOnAccent: '#0d0a12',
      scrimBase: '#080610',
      surfacePlaceholder: '#f6e9dd',
      colorfulCardInk: '#1a0d04',
      colorfulCardSupportingInk: '#3a1c08',

      alphas: {
        borderDefault: 0.3,
        borderLight: 0.28,
        borderSubtle: 0.22,
        hairlineFill: 0.06,
      },
      colorfulCardBlend: { start: 1, middle: 1, end: 1 },
      colorfulCardUsesSurfaceInk: false,
    },
  },
  'kinetic-scope': {
    mode: 'dark',
    palette: {
      surfaceBase: '#0a0a0a',
      surfaceCard: '#131313',
      surfaceRaised: '#1e1e1e',
      surfaceTint: '#181818',
      surfaceAccent: '#1f260f',
      borderHairline: '#2a2a2a',

      textPrimary: '#efefef',
      textSecondary: '#9a9a9a',
      textTertiary: '#858585',

      brandPrimary: '#c8f736',
      brandVivid: '#b8e62c',
      brandBright: '#d6fa5e',
      brandPale: '#e6fc9b',
      brandDeep: '#8fb41f',
      brandSurface: '#2c3a0a',

      statusError: '#e8674f',
      statusRose: '#e5557a',
      statusWarning: '#e8a33d',
      statusAmber: '#f0c15a',
      statusInfo: '#5aa7e8',
      statusIndigo: '#8b8ff0',
      statusPurple: '#b48aea',
      statusPink: '#e06fb0',

      inkOnAccent: '#0a0a0a',
      scrimBase: '#050505',
      surfacePlaceholder: '#efefef',

      alphas: {
        borderDefault: 0.3,
        borderLight: 0.28,
        borderSubtle: 0.22,
        hairlineFill: 0.06,
      },
      // Almost flat: the faintest lime wash that still lets the stat strip's
      // darker inset read against the card. A fully flat card this dark cannot
      // show a darker panel at all (1.02x even under a pure-black wash).
      colorfulCardBlend: { start: 0.08, middle: 0.08, end: 0.08 },
      colorfulCardUsesSurfaceInk: true,
    },
  },
});

const THEME_IDS = Object.freeze(Object.keys(THEME_DEFINITIONS));

/**
 * Which named theme a display mode falls back to.
 *
 * This is the answer to "the system says light, now what?", and it is also what
 * `darkTheme`/`lightTheme`, `darkColors`/`lightColors` and the Tailwind base
 * variables mean. One definition so those cannot drift apart.
 */
const DEFAULT_THEME_BY_MODE = Object.freeze({
  dark: 'kinetic-depth',
  light: 'kinetic-light',
});

module.exports = { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS, THEME_IDS };
