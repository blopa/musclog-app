'use strict';

const { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS, THEME_IDS } = require('./theme.registry');

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

/** Pure white, for the handful of surfaces that are white in every theme. */
const ALWAYS_WHITE = '#ffffff';

/**
 * Expand a palette into the full flat colour set: the primaries plus every
 * translucent wash, scrim and tinted surface derived from them.
 */
function createColors(palette) {
  const { alphas } = palette;
  const colorfulCardInk =
    palette.colorfulCardInk ??
    (palette.colorfulCardUsesSurfaceInk
      ? mixHex(palette.textPrimary, palette.textSecondary, 0.65)
      : ALWAYS_WHITE);
  const colorfulCardSupportingInk =
    palette.colorfulCardSupportingInk ??
    (palette.colorfulCardUsesSurfaceInk
      ? palette.textSecondary
      : addOpacityToHex(colorfulCardInk, 0.7));

  return {
    ...palette,

    // --- Scrims, backdrops and overlays. Derived from `scrimBase`, which is dark
    // in every theme: a backdrop's job is to darken what is behind it. ---
    scrimAlpha10: addOpacityToHex(palette.scrimBase, 0.1),
    scrimAlpha15: addOpacityToHex(palette.scrimBase, 0.15),
    scrimAlpha20: addOpacityToHex(palette.scrimBase, 0.2),
    scrimAlpha30: addOpacityToHex(palette.scrimBase, 0.3),
    scrimAlpha40: addOpacityToHex(palette.scrimBase, 0.4),
    scrimAlpha60: addOpacityToHex(palette.scrimBase, 0.6),
    scrimAlpha80: addOpacityToHex(palette.scrimBase, 0.8),
    scrimAlpha90: addOpacityToHex(palette.scrimBase, 0.9),

    // --- The app background at partial opacity, for fading content into the page
    // rather than darkening it. These DO follow the theme. ---
    surfaceBaseAlpha20: addOpacityToHex(palette.surfaceBase, 0.2),
    surfaceBaseAlpha38: addOpacityToHex(palette.surfaceBase, 0.38),
    surfaceBaseAlpha70: addOpacityToHex(palette.surfaceBase, 0.7),
    surfaceBaseAlpha85: addOpacityToHex(palette.surfaceBase, 0.85),
    surfaceBaseAlpha95: addOpacityToHex(palette.surfaceBase, 0.95),

    // --- Surface washes ---
    surfaceCardAlpha50: addOpacityToHex(palette.surfaceCard, 0.5),
    surfaceRaisedAlpha09: addOpacityToHex(palette.surfaceRaised, 0.09),
    surfaceRaisedAlpha49: addOpacityToHex(palette.surfaceRaised, 0.49),
    borderHairlineSoft: addOpacityToHex(palette.borderHairline, alphas.borderLight),

    // --- Opaque tinted surfaces, blended rather than added to the palette ---
    // Deep washes that used to be one-off hex literals.
    surfaceWashNeutral: mixHex(palette.surfaceBase, palette.textPrimary, 0.09), // was #1e2321
    surfaceWashNeutralStrong: mixHex(palette.surfaceBase, palette.textPrimary, 0.15), // was #2a322e
    surfaceWashBrand: mixHex(palette.surfaceRaised, palette.brandSurface, 0.09), // was #192b23
    surfaceWashBrandDeep: mixHex(palette.surfaceRaised, palette.brandDeep, 0.09), // was #1a2e2a
    surfaceWashTint: mixHex(palette.surfaceTint, palette.textPrimary, 0.07), // was #1b3227
    // Tinted surfaces that must stay opaque because they float over arbitrary content.
    surfaceErrorTint: mixHex(palette.surfaceBase, palette.statusError, 0.25), // was #3d1515
    surfaceSuccessTint: mixHex(palette.surfaceBase, palette.brandPrimary, 0.08), // was #0a1c13
    surfacePurpleTint: mixHex(palette.surfaceBase, palette.statusPurple, 0.33), // was #3d3162
    surfaceBrandTint: mixHex(palette.surfaceBase, palette.brandPrimary, 0.39), // was #0d4a2d
    surfaceNotification: mixHex(palette.surfaceBase, palette.brandPrimary, 0.15), // was #132a1e
    colorfulCardStart: mixHex(
      palette.surfaceCard,
      palette.statusIndigo,
      palette.colorfulCardBlend.start
    ),
    colorfulCardMiddle: mixHex(
      palette.surfaceCard,
      palette.brandDeep,
      palette.colorfulCardBlend.middle
    ),
    colorfulCardEnd: mixHex(palette.surfaceCard, palette.brandVivid, palette.colorfulCardBlend.end),
    colorfulCardInk,
    colorfulCardInkAlpha30: addOpacityToHex(colorfulCardInk, 0.3),
    colorfulCardInkAlpha70: colorfulCardSupportingInk,
    colorfulCardInkAlpha90: palette.colorfulCardUsesSurfaceInk
      ? colorfulCardInk
      : addOpacityToHex(colorfulCardInk, 0.9),
    colorfulCardTrack: palette.colorfulCardUsesSurfaceInk
      ? addOpacityToHex(colorfulCardInk, 0.25)
      : addOpacityToHex(palette.scrimBase, 0.6),
    // Darker shades of an accent, for the outline on a solid accent-filled button.
    // Mixed towards the scrim (dark in every theme) so the outline stays darker
    // than its fill even when the surfaces invert.
    statusErrorShade: mixHex(palette.scrimBase, palette.statusError, 0.52), // was #7f1d1d
    statusRoseShade: mixHex(palette.scrimBase, palette.statusRose, 0.7), // was #9f1239
    // Higher-legibility variants of an accent. The -400 variants they replace were
    // doing real work on small icons and label text, so they are derived rather
    // than collapsed into the base hue. Mixing towards `textPrimary` lightens them
    // on the dark theme and darkens them on the light one — either way, towards ink.
    statusErrorLight: mixHex(palette.statusError, palette.textPrimary, 0.28), // was #f87171
    statusIndigoLight: mixHex(palette.statusIndigo, palette.textPrimary, 0.28), // was #818cf8
    statusPurpleLight: mixHex(palette.statusPurple, palette.textPrimary, 0.33), // was #a78bfa

    // --- Ink neutrals with opacity. Named "white" downstream for historical
    // reasons; they are the on-surface ink, so they invert with the theme. ---
    textPrimaryAlpha02: addOpacityToHex(palette.textPrimary, 0.02),
    textPrimaryAlpha03: addOpacityToHex(palette.textPrimary, 0.03),
    textPrimaryAlpha05: addOpacityToHex(palette.textPrimary, 0.05),
    textPrimaryAlpha10: addOpacityToHex(palette.textPrimary, 0.1),
    textPrimaryAlpha12: addOpacityToHex(palette.textPrimary, 0.125),
    textPrimaryAlpha20: addOpacityToHex(palette.textPrimary, 0.2),
    textPrimaryAlpha30: addOpacityToHex(palette.textPrimary, 0.3),
    textPrimaryAlpha50: addOpacityToHex(palette.textPrimary, 0.5),
    textPrimaryAlpha60: addOpacityToHex(palette.textPrimary, 0.6),
    textPrimaryAlpha70: addOpacityToHex(palette.textPrimary, 0.7),
    textPrimaryAlpha80: addOpacityToHex(palette.textPrimary, 0.8),
    textPrimaryAlpha90: addOpacityToHex(palette.textPrimary, 0.9),
    textSecondaryAlpha11: addOpacityToHex(palette.textSecondary, 0.11),
    // Border alphas are tuned per theme (see `alphas`) so the composite lands at
    // the same visual weight on a near-black card and a near-white one.
    textTertiaryFill: addOpacityToHex(palette.textTertiary, alphas.hairlineFill),
    textTertiarySoft: addOpacityToHex(palette.textTertiary, alphas.borderSubtle),
    textTertiaryBorder: addOpacityToHex(palette.textTertiary, alphas.borderDefault),

    // --- Fixed white, for ink and surfaces that stay white in every theme ---
    alwaysWhite: ALWAYS_WHITE,
    alwaysWhiteAlpha20: 'rgba(255, 255, 255, 0.2)',
    alwaysWhiteAlpha30: 'rgba(255, 255, 255, 0.3)',
    alwaysWhiteAlpha70: 'rgba(255, 255, 255, 0.7)',
    alwaysWhiteAlpha90: 'rgba(255, 255, 255, 0.9)',

    // --- Brand with opacity ---
    brandPrimaryAlpha05: addOpacityToHex(palette.brandPrimary, 0.05),
    brandPrimaryAlpha10: addOpacityToHex(palette.brandPrimary, 0.1),
    brandPrimaryAlpha20: addOpacityToHex(palette.brandPrimary, 0.2),
    brandPrimaryAlpha30: addOpacityToHex(palette.brandPrimary, 0.3),
    brandPrimaryAlpha40: addOpacityToHex(palette.brandPrimary, 0.4),
    brandPrimaryAlpha50: addOpacityToHex(palette.brandPrimary, 0.5),
    brandVividAlpha10: addOpacityToHex(palette.brandVivid, 0.1),
    brandVividAlpha20: addOpacityToHex(palette.brandVivid, 0.2),
    brandVividAlpha30: addOpacityToHex(palette.brandVivid, 0.3),
    brandVividAlpha31: addOpacityToHex(palette.brandVivid, 0.31),
    brandBrightAlpha10: addOpacityToHex(palette.brandBright, 0.1),
    brandBrightAlpha20: addOpacityToHex(palette.brandBright, 0.2),
    brandDeepAlpha20: addOpacityToHex(palette.brandDeep, 0.2),
    brandSurfaceAlpha30: addOpacityToHex(palette.brandSurface, 0.3),

    // --- Status with opacity ---
    statusErrorAlpha08: addOpacityToHex(palette.statusError, 0.08),
    statusErrorAlpha10: addOpacityToHex(palette.statusError, 0.1),
    statusErrorAlpha12: addOpacityToHex(palette.statusError, 0.125),
    statusErrorAlpha20: addOpacityToHex(palette.statusError, 0.2),
    statusErrorAlpha50: addOpacityToHex(palette.statusError, 0.5),
    statusRoseAlpha10: addOpacityToHex(palette.statusRose, 0.1),
    statusRoseAlpha20: addOpacityToHex(palette.statusRose, 0.2),
    statusWarningAlpha10: addOpacityToHex(palette.statusWarning, 0.1),
    statusWarningAlpha20: addOpacityToHex(palette.statusWarning, 0.2),
    statusWarningAlpha50: addOpacityToHex(palette.statusWarning, 0.5),
    statusAmberAlpha10: addOpacityToHex(palette.statusAmber, 0.1),
    statusAmberAlpha20: addOpacityToHex(palette.statusAmber, 0.2),
    statusInfoAlpha10: addOpacityToHex(palette.statusInfo, 0.1),
    statusInfoAlpha20: addOpacityToHex(palette.statusInfo, 0.2),
    statusInfoAlpha40: addOpacityToHex(palette.statusInfo, 0.4),
    statusInfoAlpha50: addOpacityToHex(palette.statusInfo, 0.5),
    statusIndigoAlpha10: addOpacityToHex(palette.statusIndigo, 0.1),
    statusIndigoAlpha20: addOpacityToHex(palette.statusIndigo, 0.2),
    statusIndigoAlpha30: addOpacityToHex(palette.statusIndigo, 0.3),
    statusPurpleAlpha10: addOpacityToHex(palette.statusPurple, 0.1),
    statusPurpleAlpha13: addOpacityToHex(palette.statusPurple, 0.13),
    statusPurpleAlpha20: addOpacityToHex(palette.statusPurple, 0.2),
    statusPurpleAlpha40: addOpacityToHex(palette.statusPurple, 0.4),
    statusPinkAlpha20: addOpacityToHex(palette.statusPink, 0.2),
  };
}

/** Map a flat colour set onto the semantic token tree the app actually consumes. */
function createThemeColors(colors) {
  return {
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
      hairline: colors.borderHairline, // Hairline-weight fill
      raised: colors.surfaceRaised, // Raised fill
      raised50: colors.surfaceRaisedAlpha49, // Raised fill at 50%
      alwaysWhite: colors.alwaysWhite, // Fixed-white fill: slider/switch thumbs, icon wells
      overlayDark: colors.scrimAlpha60, // Scrim with 60% opacity
      purpleBlob: colors.surfacePurpleTint, // Purple blob background
      brandBlob: colors.surfaceBrandTint, // Brand blob background
      brandWash: colors.surfaceWashBrand, // Brand wash over the raised surface
      tintWash: colors.surfaceWashTint, // Tinted surface, lifted towards ink
      scrim10: colors.scrimAlpha10, // Scrim with 10% opacity
      scrim15: colors.scrimAlpha15, // Scrim with 15% opacity
      scrim20: colors.scrimAlpha20, // Scrim with 20% opacity
      scrim30: colors.scrimAlpha30, // Scrim with 30% opacity
      scrim40: colors.scrimAlpha40, // Scrim with 40% opacity
      scrim80: colors.scrimAlpha80, // Scrim with 80% opacity
      scrim90: colors.scrimAlpha90, // Scrim with 90% opacity
      aiCardBackground: colors.surfaceBase, // Dark green for AI card background
      tint: colors.surfaceTint, // Tinted surface, solid
      neutralWash: colors.surfaceWashNeutral, // Neutral wash over the base
      neutralWashStrong: colors.surfaceWashNeutralStrong, // Neutral wash, stronger
      exerciseCardBackground: colors.surfaceAccent, // Exercise card background
      darkBackground: colors.surfaceBase, // Dark background color (landing page, etc.)
      snackbarSuccess: colors.surfaceSuccessTint, // Success snackbar background
      snackbarError: colors.surfaceErrorTint, // Error snackbar background
      buttonCard: colors.surfaceTint, // Button/card background
      buttonCardActive: colors.surfaceTint, // Active button/card background
      separatorLight: colors.surfacePlaceholder, // Separator and image placeholder fill
      // On-surface ink at low opacity — a wash, not a colour
      ink2: colors.textPrimaryAlpha02, // Ink with ~2% opacity
      ink3: colors.textPrimaryAlpha03, // Ink with ~3% opacity
      ink5: colors.textPrimaryAlpha05, // Ink with 5% opacity
      ink10: colors.textPrimaryAlpha10, // Ink with 10% opacity
      ink12: colors.textPrimaryAlpha12, // Ink with ~12.5% opacity
      ink20: colors.textPrimaryAlpha20, // Ink with 20% opacity
      ink30: colors.textPrimaryAlpha30, // Ink with 30% opacity
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
      // Ink printed ON a solid accent fill — near-black on the dark theme's light
      // greens, white on the light theme's dark ones.
      onAccent: colors.inkOnAccent,
      // Always pure white regardless of theme: ink on a photo, a camera preview or
      // any other surface that is not the app's own background. Gradient-card ink
      // is `colorfulCard.*`, which does follow the theme.
      alwaysWhite: colors.alwaysWhite,
      // Text colors with opacity
      primary12: colors.textPrimaryAlpha12, // Primary with 12.5% opacity
      primary20: colors.textPrimaryAlpha20, // Primary with 20% opacity
      primary30: colors.textPrimaryAlpha30, // Primary with 30% opacity
    },

    colorfulCard: {
      ink: colors.colorfulCardInk,
      ink30: colors.colorfulCardInkAlpha30,
      ink70: colors.colorfulCardInkAlpha70,
      ink90: colors.colorfulCardInkAlpha90,
      track: colors.colorfulCardTrack,
    },

    // Drop-shadow / text-shadow colour. Dark in every theme; a shadow tinted with
    // the light theme's surface would simply not render.
    shadow: colors.scrimBase,

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
      default: colors.textTertiaryBorder, // Hairline on cards
      light: colors.borderHairlineSoft, // Softer hairline
      dark: colors.surfaceTint, // Dark border
      accent: colors.surfaceAccent, // Accent border
      dashed: colors.borderHairline, // Dashed border
      brand: colors.brandSurfaceAlpha30, // Brand surface at 30%
      info: colors.statusInfoAlpha40, // Info at 40%
      subtle: colors.textTertiarySoft, // Hairline, lighter
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
      indigo: colors.statusIndigo, // Indigo
      indigoLight: colors.statusIndigoLight, // Indigo, lighter — used for label text
      brandVivid: colors.brandVivid, // Brand, vivid
      brandBright: colors.brandBright, // Brand, bright
      brandPale: colors.brandPale, // Brand, pale — readable on every dark surface
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
      brandVivid10: colors.brandVividAlpha10, // Brand vivid with 10% opacity
      brandVivid20: colors.brandVividAlpha20, // Brand vivid with 20% opacity
      brandVivid30: colors.brandVividAlpha30, // Brand vivid with 30% opacity
      brandBright10: colors.brandBrightAlpha10, // Brand bright with 10% opacity
      brandBright20: colors.brandBrightAlpha20, // Brand bright with 20% opacity
      indigo10: colors.statusIndigoAlpha10, // Indigo with 10% opacity
      indigo20: colors.statusIndigoAlpha20, // Indigo with 20% opacity
      indigo30: colors.statusIndigoAlpha30, // Indigo with 30% opacity
      errorShade: colors.statusErrorShade, // Darker outline on the solid error fill
      brandSurface: colors.brandSurface, // Brand surface
      pink: colors.statusPink, // Pink
      rose: colors.statusRose, // Rose
      brandDeep: colors.brandDeep, // Brand, deep
      neutralWash: colors.textTertiaryFill, // Neutral wash
      errorLight: colors.statusErrorLight, // Error, higher legibility (fat icons, etc.)
      purpleLight: colors.statusPurpleLight, // Purple, higher legibility (fiber icons, etc.)
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

    // Overlay and opacity colors
    overlay: {
      scrim60: colors.scrimAlpha60, // Scrim with 60% opacity
      scrim90: colors.scrimAlpha90, // Scrim with 90% opacity
      ink50: colors.textPrimaryAlpha50, // On-surface ink with 50% opacity
      ink60: colors.textPrimaryAlpha60, // On-surface ink with 60% opacity
      ink70: colors.textPrimaryAlpha70, // On-surface ink with 70% opacity
      ink90: colors.textPrimaryAlpha90, // On-surface ink with 90% opacity
      ink80: colors.textPrimaryAlpha80, // On-surface ink with 80% opacity
      ink30: colors.textPrimaryAlpha30, // On-surface ink with 30% opacity
      ink20: colors.textPrimaryAlpha20, // On-surface ink with 20% opacity
      ink5: colors.textPrimaryAlpha05, // On-surface ink with 5% opacity
      backdrop: colors.scrimAlpha80, // Modal backdrop
      backdrop90: colors.scrimAlpha90, // Modal backdrop, stronger
      // Always pure white regardless of theme, for content over photos and camera
      // previews.
      alwaysWhite20: colors.alwaysWhiteAlpha20,
      alwaysWhite30: colors.alwaysWhiteAlpha30,
      alwaysWhite70: colors.alwaysWhiteAlpha70,
      alwaysWhite90: colors.alwaysWhiteAlpha90,
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
      colorfulCard: [colors.colorfulCardStart, colors.colorfulCardMiddle, colors.colorfulCardEnd],
      workoutsTitle: [colors.statusPurple, colors.statusInfo, colors.brandVivid],
      notification: [colors.surfaceNotification, colors.surfaceCard],
      upNextCard: [colors.surfaceTint, colors.surfaceCard, colors.surfaceRaised],
      cta: [colors.statusIndigo, colors.brandBright], // Indigo to primary green gradient
      userBubble: [colors.brandPrimary, colors.brandVivid], // User message bubble gradient
      // GradientText: these stops ARE the text colour, so every stop stays on the
      // readable side of the theme's ground (>= 3:1 as large display type).
      celebrationGlow: [colors.brandPale, colors.textPrimary, colors.brandBright],
      restOverTitle: [colors.brandPrimary, colors.statusIndigo], // Rest over title gradient
      workoutStats: [colors.statusIndigo, colors.brandPrimary, colors.brandVivid], // Workout stats gradient
      // Fades the screen behind the session sheet — follows the theme surface.
      workoutSessionOverlay: [
        colors.surfaceBaseAlpha95,
        colors.surfaceBaseAlpha85,
        colors.surfaceBaseAlpha70,
      ],
      indigoPurple: [colors.statusIndigo, colors.statusPurple], // Indigo to purple gradient
      emeraldTeal: [colors.brandVivid, colors.brandDeep], // Emerald to teal gradient
      pinkRose: [colors.statusPink, colors.statusRose], // Pink to rose gradient
      blueEmerald: [colors.statusInfo, colors.brandVivid], // Blue to emerald gradient
      overlayDark: ['transparent', colors.surfaceWashBrandDeep, colors.surfaceTint], // Dark overlay gradient
      // Camera scrim: sits over a live preview, so it darkens in every theme.
      cameraOverlay: [colors.scrimAlpha60, 'transparent', colors.scrimAlpha90],
      onboardingAmbient: [
        colors.statusIndigoAlpha20, // indigo/20
        colors.brandBrightAlpha20, // primary/20
        colors.brandVividAlpha20, // emerald/20
      ],
      landingBackground: [colors.surfaceBase, colors.surfaceBase, colors.surfaceBase], // Landing page background gradient
      inkSubtle: [colors.textPrimaryAlpha10, colors.textPrimaryAlpha05], // Subtle ink gradient
      backdrop90: colors.scrimAlpha90, // Backdrop with 90% opacity
    },
  };
}

const themeColorSets = Object.fromEntries(
  THEME_IDS.map((themeId) => [themeId, createColors(THEME_DEFINITIONS[themeId].palette)])
);
const themeColorsById = Object.fromEntries(
  THEME_IDS.map((themeId) => [themeId, createThemeColors(themeColorSets[themeId])])
);

const darkColors = themeColorSets[DEFAULT_THEME_BY_MODE.dark];
const lightColors = themeColorSets[DEFAULT_THEME_BY_MODE.light];
const darkThemeColors = themeColorsById[DEFAULT_THEME_BY_MODE.dark];

module.exports = {
  addOpacityToHex,
  themeColorsById,
  // The two mode defaults, for the pre-boot surfaces and Tailwind's static build.
  darkColors,
  lightColors,
  darkThemeColors,
};

/**
 * --- Tailwind / NativeWind bridge ---------------------------------------------
 *
 * NativeWind compiles `className` colours at build time, so a Tailwind class
 * cannot resolve to several palettes on its own. The way out is CSS custom
 * properties: every Tailwind colour below is emitted as `var(--c-*)`, and
 * `ThemeProvider` publishes the active named palette's values at runtime.
 * `tailwind.config.js` still provides Kinetic Light/Depth defaults before the
 * provider mounts.
 *
 * The map is deliberately the SAME set of tokens the Tailwind theme exposes, so
 * there is one place to add a themed utility class.
 */
const TAILWIND_TOKEN_MAP = {
  bg: {
    primary: (t) => t.background.primary,
    secondary: (t) => t.background.secondary,
    tertiary: (t) => t.background.tertiary,
    card: (t) => t.background.card,
    cardElevated: (t) => t.background.cardElevated,
    cardDark: (t) => t.background.secondaryDark,
    navBar: (t) => t.background.secondary,
    navActive: (t) => t.background.secondaryDark,
    screen: (t) => t.background.primary,
    overlay: (t) => t.background.overlay,
    filterTab: (t) => t.background.filterTab,
  },
  // On-surface ink, for the low-alpha hairlines and washes that used to be written
  // as literal `border-white/10` / `bg-white/5`. Those read as an ink wash, not as
  // the colour white, so they have to invert with the theme.
  ink: {
    DEFAULT: (t) => t.text.primary,
  },
  text: {
    primary: (t) => t.text.primary,
    secondary: (t) => t.text.secondary,
    tertiary: (t) => t.text.tertiary,
    muted: (t) => t.text.muted,
    accent: (t) => t.text.accent,
    accentLight: (t) => t.text.accentLight,
    'on-accent': (t) => t.text.onAccent,
    'always-white': (t) => t.text.alwaysWhite,
  },
  accent: {
    primary: (t) => t.accent.primary,
    secondary: (t) => t.accent.secondary,
    tertiary: (t) => t.accent.tertiary,
  },
  // Semantic status hues, so a conditional className does not have to reach for a
  // literal Tailwind hue that only clears contrast on one of the two grounds.
  status: {
    success: (t) => t.status.success,
    error: (t) => t.status.error,
    warning: (t) => t.status.warning,
    info: (t) => t.status.info,
  },
  border: {
    default: (t) => t.border.default,
    light: (t) => t.border.light,
    dark: (t) => t.border.dark,
    accent: (t) => t.border.accent,
    dashed: (t) => t.border.dashed,
  },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function cssVariableName(group, key) {
  return `--c-${group}-${key}`;
}

/**
 * Opaque tokens are stored as bare `r g b` channels so Tailwind's opacity
 * modifiers (`bg-accent-primary/20`) keep working. Tokens that already carry an
 * alpha are stored whole — there is no channel form for them, and none of them
 * is used with a modifier.
 */
function cssVariableValue(value) {
  if (!HEX_COLOR.test(value)) {
    return value;
  }

  const hex = value.slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16)).join(' ');
}

/** The Tailwind `colors` tree: every entry points at a custom property. */
function createTailwindColors() {
  const result = {};

  for (const [group, tokens] of Object.entries(TAILWIND_TOKEN_MAP)) {
    result[group] = {};
    for (const [key, pick] of Object.entries(tokens)) {
      const name = cssVariableName(group, key);
      // The reference form has to match how the value is stored, and the dark
      // reference palette decides it — every palette uses the same token shapes.
      result[group][key] = HEX_COLOR.test(pick(darkThemeColors))
        ? `rgb(var(${name}) / <alpha-value>)`
        : `var(${name})`;
    }
  }

  return result;
}

/** The `{ '--c-*': value }` map for one theme, for `addBase` and NativeWind `vars()`. */
function createCssVariables(themeColors) {
  const result = {};

  for (const [group, tokens] of Object.entries(TAILWIND_TOKEN_MAP)) {
    for (const [key, pick] of Object.entries(tokens)) {
      result[cssVariableName(group, key)] = cssVariableValue(pick(themeColors));
    }
  }

  return result;
}

module.exports.createTailwindColors = createTailwindColors;
module.exports.themeCssVariables = Object.fromEntries(
  THEME_IDS.map((themeId) => [themeId, createCssVariables(themeColorsById[themeId])])
);
module.exports.darkCssVariables = module.exports.themeCssVariables[DEFAULT_THEME_BY_MODE.dark];
module.exports.lightCssVariables = module.exports.themeCssVariables[DEFAULT_THEME_BY_MODE.light];

/**
 * The same variable map for NativeWind's runtime `vars()` helper.
 *
 * `vars()` passes values through untouched, while the build-time CSS parser hands
 * the runtime already-parsed channels. So an opaque token has to be supplied as an
 * `[r, g, b]` tuple here or `rgb(var(--x) / a)` has nothing numeric to work with.
 * Web keeps the string form: there, `vars()` stringifies into real CSS.
 */
function createRuntimeCssVariables(themeColors, { web = false } = {}) {
  const result = {};

  for (const [name, value] of Object.entries(createCssVariables(themeColors))) {
    const channels = /^\d+ \d+ \d+$/.test(value) ? value.split(' ').map(Number) : null;
    result[name] = channels && !web ? channels : value;
  }

  return result;
}

module.exports.themeNativeCssVariables = Object.fromEntries(
  THEME_IDS.map((themeId) => [themeId, createRuntimeCssVariables(themeColorsById[themeId])])
);
