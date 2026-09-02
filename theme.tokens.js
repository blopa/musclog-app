'use strict';

function addOpacityToHex(hexColor, opacity) {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Blend two palette colours into an opaque hex value.
 *
 * Tinted surfaces (an error snackbar, a decorative blob) need to stay opaque —
 * they sit over arbitrary content, so an rgba wash would pick up whatever is
 * behind it. `mixHex` derives them from two primaries instead of introducing a
 * new one, which is how the palette stays at 23 colours.
 *
 * @param {string} baseHex surface to start from
 * @param {string} tintHex colour to pull towards
 * @param {number} ratio 0 = base, 1 = tint
 */
function mixHex(baseHex, tintHex, ratio) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  };

  const [r1, g1, b1] = parse(baseHex);
  const [r2, g2, b2] = parse(tintHex);
  const channel = (a, b) =>
    Math.round(a + (b - a) * ratio)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
}

// Reserved for future light-theme parity; palette kept in sync with design tokens.
// eslint-disable-next-line no-unused-vars -- referenced when light theme ships
const kineticDepthLight = {
  // --- Surfaces: a four-step tonal ladder plus two tinted branches ---
  surfaceBase: '#f7f9fb', // Level 0: the airy, sophisticated base (not pure white)
  surfaceCard: '#f2f4f6', // Level 1: card and section backgrounds
  surfaceRaised: '#e8eeeb', // Level 2: elevated cards, active states
  surfaceTint: '#e0f2fe', // Tinted branch: overlays, filter tabs, icon wells
  surfaceAccent: '#b7ebce', // Tinted branch: accent borders, exercise cards
  borderHairline: '#bbcabf', // Outline variant: hairlines and dashed borders

  // --- Text: three steps ---
  textPrimary: '#191c1e', // Body and headings — never pure black
  textSecondary: '#4d6058', // Supporting text
  textTertiary: '#6b8070', // Labels, captions, disabled

  // --- Brand emerald ---
  brandPrimary: '#10b981', // The primary action colour
  brandVivid: '#006c49', // Deeper emerald for icons and small glyphs
  brandBright: '#4edea3', // Large background accents and illustrative shapes
  brandPale: '#baeed1', // Chip and wash backgrounds
  brandDeep: '#0ea5e9', // Gradient end, tertiary accent
  brandSurface: '#b7ebce', // Deep brand surface

  // --- Status and data series ---
  statusError: '#f87171',
  statusRose: '#fb7185',
  statusWarning: '#f97316',
  statusAmber: '#fbbf24',
  statusInfo: '#3b82f6',
  statusIndigo: '#818cf8',
  statusPurple: '#c084fc',
  statusPink: '#ec4899',
};

/**
 * The primary palette — 23 colours, every one of which is visually distinct.
 *
 * Grouped by role, not by hue name. Each surface step is at least 1.09x contrast
 * from its neighbour so tonal layering is actually visible, and every text token
 * clears WCAG AA on all three main surfaces. Anything softer than these values is
 * derived with `addOpacityToHex` or `mixHex` rather than added here.
 */
const kineticDepth = {
  // --- Surfaces: a four-step tonal ladder plus two tinted branches ---
  surfaceBase: '#091310', // Level 0: app background, screens, scrims
  surfaceCard: '#131d18', // Level 1: card backgrounds
  surfaceRaised: '#1b2721', // Level 2: elevated cards, wells, active states
  surfaceTint: '#0c2419', // Tinted branch: overlays, filter tabs, icon wells
  surfaceAccent: '#1c3829', // Tinted branch: accent borders, exercise cards
  borderHairline: '#2c3a32', // Hairlines and dashed borders

  // --- Text: three steps, all AA on every surface above ---
  textPrimary: '#dce5de', // On-surface off-white (not pure white)
  textSecondary: '#9cb0a8', // Supporting text
  textTertiary: '#7d918a', // Labels, captions, disabled — 5.17:1 on surfaceCard

  // --- Brand emerald ---
  brandPrimary: '#29a577', // The primary action colour
  brandVivid: '#10b981', // Deeper emerald for icons and small glyphs
  brandBright: '#34d399', // Bright mint: highlights, data series 1
  brandPale: '#a7f3d0', // Pale mint: chips, washes, gradient text
  brandDeep: '#0f766e', // Deep teal: gradient end, tertiary accent
  brandSurface: '#064e3b', // Deep brand surface: forest accent, borders

  // --- Status and data series: eight distinct hues ---
  statusError: '#ef4444', // Errors, destructive actions
  statusRose: '#da2552', // Rose brand variant
  statusWarning: '#f97316', // Warnings, energy
  statusAmber: '#fbbf24', // Attention, streaks, fat macro
  statusInfo: '#3b82f6', // Information, hydration
  statusIndigo: '#6366f1', // Recovery, AI accents, protein macro
  statusPurple: '#a855f7', // Supporting series
  statusPink: '#ec4899', // Fiber macro, accent series
};

const colors = {
  ...kineticDepth,

  // --- Scrims, backdrops and overlays, all from the base surface ---
  surfaceBaseAlpha10: addOpacityToHex(kineticDepth.surfaceBase, 0.1),
  surfaceBaseAlpha15: addOpacityToHex(kineticDepth.surfaceBase, 0.15),
  surfaceBaseAlpha20: addOpacityToHex(kineticDepth.surfaceBase, 0.2),
  surfaceBaseAlpha30: addOpacityToHex(kineticDepth.surfaceBase, 0.3),
  surfaceBaseAlpha38: addOpacityToHex(kineticDepth.surfaceBase, 0.38),
  surfaceBaseAlpha40: addOpacityToHex(kineticDepth.surfaceBase, 0.4),
  surfaceBaseAlpha60: addOpacityToHex(kineticDepth.surfaceBase, 0.6),
  surfaceBaseAlpha80: addOpacityToHex(kineticDepth.surfaceBase, 0.8),
  surfaceBaseAlpha90: addOpacityToHex(kineticDepth.surfaceBase, 0.9),

  // --- Surface washes ---
  surfaceCardAlpha50: addOpacityToHex(kineticDepth.surfaceCard, 0.5),
  surfaceRaisedAlpha09: addOpacityToHex(kineticDepth.surfaceRaised, 0.09),
  surfaceRaisedAlpha49: addOpacityToHex(kineticDepth.surfaceRaised, 0.49),
  borderHairlineAlpha23: addOpacityToHex(kineticDepth.borderHairline, 0.23),

  // --- Opaque tinted surfaces, blended rather than added to the palette ---
  // Deep washes that used to be one-off hex literals.
  surfaceWashNeutral: mixHex(kineticDepth.surfaceBase, kineticDepth.textPrimary, 0.09), // was #1e2321
  surfaceWashTaupe: mixHex(kineticDepth.surfaceBase, kineticDepth.textPrimary, 0.15), // was #2a322e
  surfaceWashGreen: mixHex(kineticDepth.surfaceRaised, kineticDepth.brandSurface, 0.09), // was #192b23
  surfaceWashTeal: mixHex(kineticDepth.surfaceRaised, kineticDepth.brandDeep, 0.09), // was #1a2e2a
  surfaceWashTint: mixHex(kineticDepth.surfaceTint, kineticDepth.textPrimary, 0.07), // was #1b3227
  // Tinted surfaces that must stay opaque because they float over arbitrary content.
  surfaceErrorTint: mixHex(kineticDepth.surfaceBase, kineticDepth.statusError, 0.25), // was #3d1515
  surfaceSuccessTint: mixHex(kineticDepth.surfaceBase, kineticDepth.brandPrimary, 0.08), // was #0a1c13
  surfacePurpleTint: mixHex(kineticDepth.surfaceBase, kineticDepth.statusPurple, 0.33), // was #3d3162
  surfaceBrandTint: mixHex(kineticDepth.surfaceBase, kineticDepth.brandPrimary, 0.39), // was #0d4a2d
  surfaceNotification: mixHex(kineticDepth.surfaceBase, kineticDepth.brandPrimary, 0.15), // was #132a1e
  // Darker shades of an accent, for the outline on a solid accent-filled button.
  statusErrorShade: mixHex(kineticDepth.surfaceBase, kineticDepth.statusError, 0.52), // was #7f1d1d
  statusRoseShade: mixHex(kineticDepth.surfaceBase, kineticDepth.statusRose, 0.7), // was #9f1239
  // Lighter tints of an accent. The -400 variants they replace were doing real
  // legibility work on small icons and label text, so they are derived rather than
  // collapsed into the base hue.
  statusErrorLight: mixHex(kineticDepth.statusError, kineticDepth.textPrimary, 0.28), // was #f87171
  statusIndigoLight: mixHex(kineticDepth.statusIndigo, kineticDepth.textPrimary, 0.28), // was #818cf8
  statusPurpleLight: mixHex(kineticDepth.statusPurple, kineticDepth.textPrimary, 0.33), // was #a78bfa

  // --- Text neutrals with opacity ---
  textPrimaryAlpha02: addOpacityToHex(kineticDepth.textPrimary, 0.02),
  textPrimaryAlpha03: addOpacityToHex(kineticDepth.textPrimary, 0.03),
  textPrimaryAlpha05: addOpacityToHex(kineticDepth.textPrimary, 0.05),
  textPrimaryAlpha10: addOpacityToHex(kineticDepth.textPrimary, 0.1),
  textPrimaryAlpha12: addOpacityToHex(kineticDepth.textPrimary, 0.125),
  textPrimaryAlpha20: addOpacityToHex(kineticDepth.textPrimary, 0.2),
  textPrimaryAlpha30: addOpacityToHex(kineticDepth.textPrimary, 0.3),
  textPrimaryAlpha50: addOpacityToHex(kineticDepth.textPrimary, 0.5),
  textPrimaryAlpha60: addOpacityToHex(kineticDepth.textPrimary, 0.6),
  textPrimaryAlpha70: addOpacityToHex(kineticDepth.textPrimary, 0.7),
  textPrimaryAlpha80: addOpacityToHex(kineticDepth.textPrimary, 0.8),
  textPrimaryAlpha90: addOpacityToHex(kineticDepth.textPrimary, 0.9),
  textSecondaryAlpha11: addOpacityToHex(kineticDepth.textSecondary, 0.11),
  // Border alphas are tuned to the composite the old gray-600 borders produced,
  // so widening the tertiary text token did not brighten every hairline.
  textTertiaryAlpha05: addOpacityToHex(kineticDepth.textTertiary, 0.05),
  textTertiaryAlpha20: addOpacityToHex(kineticDepth.textTertiary, 0.2),
  textTertiaryAlpha26: addOpacityToHex(kineticDepth.textTertiary, 0.26),

  // --- Brand with opacity ---
  brandPrimaryAlpha05: addOpacityToHex(kineticDepth.brandPrimary, 0.05),
  brandPrimaryAlpha10: addOpacityToHex(kineticDepth.brandPrimary, 0.1),
  brandPrimaryAlpha20: addOpacityToHex(kineticDepth.brandPrimary, 0.2),
  brandPrimaryAlpha30: addOpacityToHex(kineticDepth.brandPrimary, 0.3),
  brandPrimaryAlpha40: addOpacityToHex(kineticDepth.brandPrimary, 0.4),
  brandPrimaryAlpha50: addOpacityToHex(kineticDepth.brandPrimary, 0.5),
  brandVividAlpha10: addOpacityToHex(kineticDepth.brandVivid, 0.1),
  brandVividAlpha20: addOpacityToHex(kineticDepth.brandVivid, 0.2),
  brandVividAlpha30: addOpacityToHex(kineticDepth.brandVivid, 0.3),
  brandVividAlpha31: addOpacityToHex(kineticDepth.brandVivid, 0.31),
  brandBrightAlpha10: addOpacityToHex(kineticDepth.brandBright, 0.1),
  brandBrightAlpha20: addOpacityToHex(kineticDepth.brandBright, 0.2),
  brandDeepAlpha20: addOpacityToHex(kineticDepth.brandDeep, 0.2),
  brandSurfaceAlpha30: addOpacityToHex(kineticDepth.brandSurface, 0.3),

  // --- Status with opacity ---
  statusErrorAlpha08: addOpacityToHex(kineticDepth.statusError, 0.08),
  statusErrorAlpha10: addOpacityToHex(kineticDepth.statusError, 0.1),
  statusErrorAlpha12: addOpacityToHex(kineticDepth.statusError, 0.125),
  statusErrorAlpha20: addOpacityToHex(kineticDepth.statusError, 0.2),
  statusErrorAlpha50: addOpacityToHex(kineticDepth.statusError, 0.5),
  statusRoseAlpha10: addOpacityToHex(kineticDepth.statusRose, 0.1),
  statusRoseAlpha20: addOpacityToHex(kineticDepth.statusRose, 0.2),
  statusWarningAlpha10: addOpacityToHex(kineticDepth.statusWarning, 0.1),
  statusWarningAlpha20: addOpacityToHex(kineticDepth.statusWarning, 0.2),
  statusWarningAlpha50: addOpacityToHex(kineticDepth.statusWarning, 0.5),
  statusAmberAlpha10: addOpacityToHex(kineticDepth.statusAmber, 0.1),
  statusAmberAlpha20: addOpacityToHex(kineticDepth.statusAmber, 0.2),
  statusInfoAlpha10: addOpacityToHex(kineticDepth.statusInfo, 0.1),
  statusInfoAlpha20: addOpacityToHex(kineticDepth.statusInfo, 0.2),
  statusInfoAlpha40: addOpacityToHex(kineticDepth.statusInfo, 0.4),
  statusInfoAlpha50: addOpacityToHex(kineticDepth.statusInfo, 0.5),
  statusIndigoAlpha10: addOpacityToHex(kineticDepth.statusIndigo, 0.1),
  statusIndigoAlpha20: addOpacityToHex(kineticDepth.statusIndigo, 0.2),
  statusIndigoAlpha30: addOpacityToHex(kineticDepth.statusIndigo, 0.3),
  statusPurpleAlpha10: addOpacityToHex(kineticDepth.statusPurple, 0.1),
  statusPurpleAlpha13: addOpacityToHex(kineticDepth.statusPurple, 0.13),
  statusPurpleAlpha20: addOpacityToHex(kineticDepth.statusPurple, 0.2),
  statusPurpleAlpha40: addOpacityToHex(kineticDepth.statusPurple, 0.4),
  statusPinkAlpha20: addOpacityToHex(kineticDepth.statusPink, 0.2),
};

const themeColors = {
  // Background colors
  background: {
    primary: colors.surfaceBase, // Main app background
    secondary: colors.surfaceBase, // Secondary backgrounds (nav bar, cards)
    tertiary: colors.surfaceBase, // Darker backgrounds (food page)
    card: colors.surfaceCard, // Card backgrounds
    cardElevated: colors.surfaceRaised, // Elevated card backgrounds
    secondaryDark: colors.surfaceCard, // Dark card backgrounds (active states)
    overlay: colors.surfaceTint, // Overlay backgrounds
    filterTab: colors.surfaceTint, // Filter tab background
    iconDark: colors.surfaceTint, // Dark icon backgrounds
    iconDarker: colors.surfaceTint, // Darker icon backgrounds
    iconDarkest: colors.surfaceRaised, // Darkest icon backgrounds
    workoutIcon: colors.brandVivid, // Workout action button icon background
    // Avatar/image placeholder. Light text renders on this, so it has to stay
    // dark: the old warm taupe gave text.primary only 1.49:1.
    imageLight: colors.surfaceAccent, // Image placeholder background
    imageMedium: colors.surfaceRaised, // Medium image background
    notificationCard: colors.surfaceNotification, // Notification card gradient start
    gray700: colors.borderHairline, // Hairline-weight fill
    gray800: colors.surfaceRaised, // Raised fill
    gray800Opacity50: colors.surfaceRaisedAlpha49, // Raised fill at 50%
    white: colors.textPrimary, // White background
    overlayDark: colors.surfaceBaseAlpha60, // Base scrim with 60% opacity
    purpleBlob: colors.surfacePurpleTint, // Purple blob background
    greenBlob: colors.surfaceBrandTint, // Green blob background
    darkGreen50: colors.surfaceWashGreen, // Dark green wash
    darkGreen80: colors.surfaceWashTint, // Dark green wash, stronger
    black10: colors.surfaceBaseAlpha10, // Base scrim with 10% opacity
    black15: colors.surfaceBaseAlpha15, // Base scrim with 15% opacity
    black20: colors.surfaceBaseAlpha20, // Base scrim with 20% opacity
    black30: colors.surfaceBaseAlpha30, // Base scrim with 30% opacity
    black40: colors.surfaceBaseAlpha40, // Base scrim with 40% opacity
    black80: colors.surfaceBaseAlpha80, // Base scrim with 80% opacity
    black90: colors.surfaceBaseAlpha90, // Base scrim with 90% opacity
    aiCardBackground: colors.surfaceBase, // Dark green for AI card background
    darkGreenVariant: colors.surfaceNotification, // Dark green variant for tags/badges
    darkGreenOverlay: colors.surfaceWashTeal, // Dark green overlay
    darkGreenSolid: colors.surfaceTint, // Dark green solid color
    darkGray: colors.surfaceWashNeutral, // Dark neutral wash
    darkGray50: colors.surfaceWashNeutral, // Dark neutral wash
    darkGray90: colors.surfaceWashNeutral, // Dark neutral wash
    darkGraySolid: colors.surfaceBase, // Dark base wash
    darkGreenSolidAlt: colors.surfaceWashTaupe, // Alternative dark green solid
    exerciseCardBackground: colors.surfaceAccent, // Exercise card background
    darkBackground: colors.surfaceBase, // Dark background color (landing page, etc.)
    snackbarSuccess: colors.surfaceSuccessTint, // Success snackbar background
    snackbarError: colors.surfaceErrorTint, // Error snackbar background
    buttonCard: colors.surfaceTint, // Button/card background
    buttonCardActive: colors.surfaceTint, // Active button/card background
    separatorLight: colors.textPrimary, // Light separator
    // White background with opacity
    white2: colors.textPrimaryAlpha02, // White with ~2% opacity
    white3: colors.textPrimaryAlpha03, // White with ~3% opacity
    white5: colors.textPrimaryAlpha05, // White with 5% opacity
    white10: colors.textPrimaryAlpha10, // White with 10% opacity
    white12: colors.textPrimaryAlpha12, // White with ~12.5% opacity
    white20: colors.textPrimaryAlpha20, // White with 20% opacity
    white30: colors.textPrimaryAlpha30, // White with 30% opacity
    // Background primary with opacity
    primary20: colors.surfaceBaseAlpha20, // Background primary with 20% opacity
  },

  // Text colors
  text: {
    primary: colors.textPrimary, // Primary text
    secondary: colors.textSecondary, // Secondary text
    tertiary: colors.textTertiary, // Tertiary text — 5.17:1 on surfaceCard
    muted: colors.textTertiary, // Muted text
    accent: colors.brandPrimary, // Accent text (green)
    accentLight: colors.brandVivid, // Light accent text (emerald)
    black: colors.surfaceBase, // Black text (for icons on light backgrounds)
    gray300: colors.textSecondary, // Supporting text
    gray500: colors.textTertiary, // Tertiary text
    white: colors.textPrimary, // White
    // Fixed-white token: always pure white regardless of theme, for text on colorful gradient surfaces
    onColorful: '#ffffff',
    // Text colors with opacity
    primary12: colors.textPrimaryAlpha12, // Primary with 12.5% opacity
    primary20: colors.textPrimaryAlpha20, // Primary with 20% opacity
    primary30: colors.textPrimaryAlpha30, // Primary with 30% opacity
  },

  // Accent colors
  accent: {
    primary: colors.brandPrimary, // Primary green
    secondary: colors.brandVivid, // Secondary green (emerald)
    tertiary: colors.brandDeep, // Tertiary green (teal)
    gradient: {
      start: colors.brandVivid,
      end: colors.brandDeep,
    },
    // Accent colors with opacity
    primary10: colors.brandPrimaryAlpha10, // Primary with 10% opacity
    primary30: colors.brandPrimaryAlpha30, // Primary with 30% opacity
    primary20: colors.brandPrimaryAlpha20, // Primary with 20% opacity
    primary40: colors.brandPrimaryAlpha40, // Primary with 40% opacity
    primary50: colors.brandPrimaryAlpha50, // Primary with 50% opacity
    primary5: colors.brandPrimaryAlpha05, // Primary with 5% opacity
    secondary10: colors.brandVividAlpha10, // Secondary with 10% opacity
    secondary20: colors.brandVividAlpha20, // Secondary with 20% opacity
    secondary31: colors.brandVividAlpha31, // Secondary with 31% opacity
  },

  // Border colors
  border: {
    default: colors.textTertiaryAlpha26, // Hairline on cards
    light: colors.borderHairlineAlpha23, // Softer hairline
    dark: colors.surfaceTint, // Dark border
    accent: colors.surfaceAccent, // Accent border
    dashed: colors.borderHairline, // Dashed border
    emerald: colors.brandSurfaceAlpha30, // Brand surface at 30%
    blue: colors.statusInfoAlpha40, // Info at 40%
    gray600: colors.textTertiaryAlpha20, // Hairline, lighter
  },

  // Status colors
  status: {
    success: colors.brandPrimary,
    warning: colors.statusWarning, // Orange
    error: colors.statusError, // Red
    info: colors.statusInfo, // Blue
    purple: colors.statusPurple, // Purple
    notificationBadge: colors.statusError, // Red notification badge (same as error)
    amber: colors.statusAmber, // Amber
    yellow: colors.statusAmber, // Amber
    indigo: colors.statusIndigo, // Indigo
    indigoLight: colors.statusIndigoLight, // Indigo, lighter — used for label text
    emerald: colors.brandVivid, // Emerald
    emeraldLight: colors.brandBright, // Bright mint
    greenDark: colors.brandVivid, // Deep emerald
    indigoVeryLight: colors.brandPale, // Pale accent
    emeraldVeryLight: colors.brandPale, // Pale mint
    // Status colors with opacity
    success20: colors.brandPrimaryAlpha20, // Success with 20% opacity
    error8: colors.statusErrorAlpha08, // Error with 8% opacity
    error10: colors.statusErrorAlpha10, // Error with 10% opacity
    error12: colors.statusErrorAlpha12, // Error with 12.5% opacity
    error20: colors.statusErrorAlpha20, // Error with 20% opacity
    error50: colors.statusErrorAlpha50, // Error with 50% opacity
    info20: colors.statusInfoAlpha20, // Info with 20% opacity
    info10: colors.statusInfoAlpha10, // Info with 10% opacity
    info50: colors.statusInfoAlpha50, // Info with 50% opacity
    warning50: colors.statusWarningAlpha50, // Warning with 50% opacity
    purple40: colors.statusPurpleAlpha40, // Purple with 40% opacity
    purple20: colors.statusPurpleAlpha20, // Purple with 20% opacity
    purple13: colors.statusPurpleAlpha13, // Purple with 13% opacity
    purple10: colors.statusPurpleAlpha10, // Purple with 10% opacity
    amber10: colors.statusAmberAlpha10, // Amber with 10% opacity
    amber20: colors.statusAmberAlpha20, // Amber with 20% opacity
    warning10: colors.statusWarningAlpha10, // Warning with 10% opacity
    emerald10: colors.brandVividAlpha10, // Emerald with 10% opacity
    emerald20: colors.brandVividAlpha20, // Emerald with 20% opacity
    emerald30: colors.brandVividAlpha30, // Emerald with 30% opacity
    emerald400_10: colors.brandBrightAlpha10, // Bright mint with 10% opacity
    emerald400_20: colors.brandBrightAlpha20, // Bright mint with 20% opacity
    yellow10: colors.statusAmberAlpha10, // Amber with 10% opacity
    indigo10: colors.statusIndigoAlpha10, // Indigo with 10% opacity
    indigo20: colors.statusIndigoAlpha20, // Indigo with 20% opacity
    indigo30: colors.statusIndigoAlpha30, // Indigo with 30% opacity
    indigo600: colors.statusIndigo, // Indigo
    // Red border colors for ungroup action
    redDark: colors.statusErrorShade, // Darker red outline on the solid error fill
    // Emerald border colors for group action
    emeraldDark: colors.brandSurface, // Deep emerald border
    indigo600Purple: colors.statusPurple, // Purple (for indigo gradients)
    blue600: colors.statusInfo, // Blue
    pink500: colors.statusPink, // Pink
    rose600: colors.statusRose, // Rose
    customGreen: colors.brandPale, // Pale mint used in components
    emeraldTeal: colors.brandDeep, // Deep teal (for emerald-teal gradient)
    gray10: colors.textTertiaryAlpha05, // Neutral with 5% opacity
    // Error colors for ungroup action
    errorSolid: colors.statusError, // Solid red for ungroup
    // Success colors for group action
    emeraldSolid: colors.brandVivid, // Solid emerald for group
    // Additional status colors
    red400: colors.statusErrorLight, // Red, lighter (for fat icons, etc.)
    teal400: colors.brandPale, // Pale mint (for monounsat fat, etc.)
    purple400: colors.statusPurpleLight, // Purple, lighter (for fiber icons, etc.)
    violet500: colors.statusPurple, // Purple (for polyunsat fat, etc.)
  },

  // Rose colors (for red button variant)
  rose: {
    brand: colors.statusRose, // Rose
    dark: colors.statusRoseShade, // Rose (darker variant)
    // Rose colors with opacity
    brand10: colors.statusRoseAlpha10, // Rose-brand with 10% opacity
    brand20: colors.statusRoseAlpha20, // Rose-brand with 20% opacity
  },

  // Macro colors
  macros: {
    protein: {
      text: colors.statusIndigo, // Indigo
      bg: colors.statusIndigo, // Indigo
    },
    carbs: {
      text: colors.brandVivid, // Emerald
      bg: colors.brandVivid, // Emerald
    },
    fat: {
      text: colors.statusAmber, // Amber
      bg: colors.statusAmber, // Amber
    },
    fiber: {
      text: colors.statusPink, // Pink
      bg: colors.statusPink, // Pink
    },
  },

  // Avatar colors — these must stay mutually distinct; avatarColorUtils.test.ts asserts it.
  avatar: {
    emerald: colors.brandPrimary, // Primary green
    blue: colors.statusInfo, // Blue
    purple: colors.statusPurple, // Purple
    pink: colors.statusPink, // Pink
    orange: colors.statusWarning, // Orange
    teal: colors.brandDeep, // Teal
    yellow: colors.statusAmber, // Amber
    indigo: colors.statusIndigo, // Indigo
  },

  // Avatar background colors (with opacity)
  avatarBg: {
    emerald: colors.brandPrimaryAlpha20, // primary/20
    blue: colors.statusInfoAlpha20, // info/20
    purple: colors.statusPurpleAlpha20, // purple/20
    pink: colors.statusPinkAlpha20, // pink/20
    orange: colors.statusWarningAlpha20, // orange/20
    teal: colors.brandDeepAlpha20, // teal/20
    yellow: colors.statusAmberAlpha20, // amber/20
    indigo: colors.statusIndigoAlpha20, // indigo/20
  },

  // Google brand colors
  google: {
    borderLight: colors.textTertiary, // Light border for Google button
    borderDark: colors.textSecondary, // Dark border for Google button
    backgroundDark: colors.surfaceBase, // Dark background for Google button
    textLight: colors.surfaceCard, // Light text for Google button
    textDark: colors.textPrimary, // Dark text for Google button
    overlayDark: colors.surfaceRaised, // Dark overlay for Google button
    overlayLight: colors.textPrimary, // Light overlay for Google button
    disabledBorderLight: colors.surfaceRaisedAlpha09, // Disabled border (light variant)
    disabledBorderDark: colors.textSecondaryAlpha11, // Disabled border (dark variant)
    disabledBgLight: colors.surfaceBaseAlpha38, // Disabled background (light variant)
    disabledBgDark: colors.surfaceBaseAlpha38, // Disabled background (dark variant)
  },

  // Overlay and opacity colors
  overlay: {
    black60: colors.surfaceBaseAlpha60, // Base scrim with 60% opacity
    black90: colors.surfaceBaseAlpha90, // Base scrim with 90% opacity
    white50: colors.textPrimaryAlpha50, // White with 50% opacity
    white60: colors.textPrimaryAlpha60, // White with 60% opacity
    white70: colors.textPrimaryAlpha70, // White with 70% opacity
    white90: colors.textPrimaryAlpha90, // White with 90% opacity
    white80: colors.textPrimaryAlpha80, // White with 80% opacity
    white30: colors.textPrimaryAlpha30, // White with 30% opacity
    white20: colors.textPrimaryAlpha20, // White with 20% opacity
    white5: colors.textPrimaryAlpha05, // White with 5% opacity
    black60Opacity: colors.surfaceBaseAlpha60, // Base scrim with 60% opacity (for gradients)
    backdrop: colors.surfaceBaseAlpha80, // Background primary with 80% opacity (for modals)
    backdrop90: colors.surfaceBaseAlpha90, // Background primary with 90% opacity
    darkGreenOverlayGradient: colors.surfaceWashTeal, // Dark green overlay gradient
    // Fixed-white tokens: always pure white regardless of theme, for text on colorful gradient surfaces
    onColorful70: 'rgba(255, 255, 255, 0.7)',
    onColorful90: 'rgba(255, 255, 255, 0.9)',
  },

  // Opacity values (for use in style objects)
  opacity: {
    zero: 0, // 0% opacity (fully transparent)
    veryLight: 0.1, // Very light opacity
    subtle: 0.2, // Subtle opacity
    medium: 0.5,
    strong: 0.7, // Strong opacity
    ultra: 0.9, // Strong opacity
    full: 1.0,
  },

  // Gradient colors
  gradients: {
    primary: [colors.statusInfo, colors.brandDeep, colors.brandVivid],
    accent: [colors.brandVivid, colors.brandDeep],
    card: [colors.surfaceRaised, colors.surfaceCardAlpha50],
    button: [colors.surfaceTint, colors.surfaceCard],
    progress: [colors.statusIndigo, colors.brandDeep, colors.brandVivid],
    workoutsTitle: [colors.statusPurple, colors.statusInfo, colors.brandVivid],
    notification: [colors.surfaceNotification, colors.surfaceCard],
    upNextCard: [colors.surfaceTint, colors.surfaceCard, colors.surfaceRaised],
    cta: [colors.statusIndigo, colors.brandBright], // Indigo to primary green gradient
    userBubble: [colors.brandPrimary, colors.brandVivid], // User message bubble gradient
    // GradientText: these stops ARE the text colour, so every stop stays pale
    // enough to read on the dark background (each is >= 12.6:1).
    celebrationGlow: [colors.brandPale, colors.textPrimary, colors.brandBright],
    restOverTitle: [colors.brandPrimary, colors.statusIndigo], // Rest over title gradient
    workoutStats: [colors.statusIndigo, colors.brandPrimary, colors.brandVivid], // Workout stats gradient
    workoutSessionOverlay: [
      addOpacityToHex(colors.surfaceBase, 0.95),
      addOpacityToHex(colors.surfaceBase, 0.85),
      addOpacityToHex(colors.surfaceBase, 0.7),
    ],
    indigoPurple: [colors.statusIndigo, colors.statusPurple], // Indigo to purple gradient
    emeraldTeal: [colors.brandVivid, colors.brandDeep], // Emerald to teal gradient
    pinkRose: [colors.statusPink, colors.statusRose], // Pink to rose gradient
    blueEmerald: [colors.statusInfo, colors.brandVivid], // Blue to emerald gradient
    overlayDark: ['transparent', colors.surfaceWashTeal, colors.surfaceTint], // Dark overlay gradient
    cameraOverlay: [colors.surfaceBaseAlpha60, 'transparent', colors.surfaceBaseAlpha90], // Camera overlay gradient
    onboardingAmbient: [
      colors.statusIndigoAlpha20, // indigo/20
      colors.brandBrightAlpha20, // primary/20
      colors.brandVividAlpha20, // emerald/20
    ],
    landingBackground: [colors.surfaceBase, colors.surfaceBase, colors.surfaceBase], // Landing page background gradient
    whiteSubtle: [colors.textPrimaryAlpha10, colors.textPrimaryAlpha05], // Subtle white gradient
    backdrop90: colors.surfaceBaseAlpha90, // Background with 90% opacity
  },
};

module.exports = {
  addOpacityToHex,
  colors,
  mixHex,
  themeColors,
};
