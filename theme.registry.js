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
      surfaceBase: '#091310',
      surfaceCard: '#131d18',
      surfaceRaised: '#1b2721',
      surfaceTint: '#0c2419',
      surfaceAccent: '#1c3829',
      borderHairline: '#2c3a32',

      textPrimary: '#dce5de',
      textSecondary: '#9cb0a8',
      textTertiary: '#7d918a',

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
      surfaceBase: '#fafcfb',
      surfaceCard: '#eef2f0',
      surfaceRaised: '#e0e7e3',
      surfaceTint: '#dff0e7',
      surfaceAccent: '#c6e6d4',
      borderHairline: '#c2cfc8',

      textPrimary: '#0f1a16',
      textSecondary: '#41564d',
      textTertiary: '#4f645a',

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
      // presentation flag. See `gradients.landingBackground` for the same idiom.
      colorfulCardBlend: { start: 0, middle: 0, end: 0 },
      colorfulCardUsesSurfaceInk: true,
    },
  },
  'kinetic-shock': {
    mode: 'dark',
    palette: {
      surfaceBase: '#160b14',
      surfaceCard: '#21101e',
      surfaceRaised: '#2d1829',
      surfaceTint: '#351226',
      surfaceAccent: '#51203f',
      borderHairline: '#503248',

      textPrimary: '#f5e4ef',
      textSecondary: '#ceb0c2',
      textTertiary: '#b895aa',

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
      surfaceBase: '#151208',
      surfaceCard: '#201b0c',
      surfaceRaised: '#2c2510',
      surfaceTint: '#30270a',
      surfaceAccent: '#4a3b08',
      borderHairline: '#4a4126',

      textPrimary: '#f6f0d5',
      textSecondary: '#d0c59a',
      textTertiary: '#b4a978',

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
      surfaceBase: '#fff7fa',
      surfaceCard: '#fbe9f1',
      surfaceRaised: '#f2d6e3',
      surfaceTint: '#fadeeb',
      surfaceAccent: '#eec0d6',
      borderHairline: '#d9b3c5',

      textPrimary: '#2b101d',
      textSecondary: '#5c2b40',
      textTertiary: '#6a3549',

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
      surfaceBase: '#0d0a12',
      surfaceCard: '#181123',
      surfaceRaised: '#241a33',
      surfaceTint: '#291509',
      surfaceAccent: '#4a220d',
      borderHairline: '#463355',

      textPrimary: '#f6e9dd',
      textSecondary: '#c4b2c9',
      textTertiary: '#a695ad',

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
