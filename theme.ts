import { Appearance } from 'react-native';

/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */

const kineticDepthLight = {
  // --- Core Surfaces — Luminous Analyst palette ---
  surfaceBlack: '#F7F9FB', // background Level 0: the airy, sophisticated base (not pure white)
  white: '#191C1E', // on_surface: primary text — never pure black, maintains soft-light aesthetic

  // --- Surface Layering — tonal neutral scale (light backgrounds → dark text) ---
  gray900: '#F2F4F6', // surface_container_low: section backgrounds
  gray850: '#E8EEEB', // light neutral surface
  gray800: '#BBCABF', // outline_variant: ghost borders (use at 30% opacity for accessibility)
  gray700: '#6B8070', // muted/disabled text (green-tinted)
  gray600: '#4D6058', // secondary text
  gray500: '#3C4A42', // on_surface_variant: icons and tertiary text
  gray400: '#2D3D35', // dark accents
  gray300: '#1E2E28', // near-dark text
  gray200: '#191C1E', // on_surface: deepest dark text (matches white token)
  zinc400: '#71817A', // teal-tinted zinc
  zinc500: '#9CABA4', // lighter teal-tinted zinc
  warmGray: '#FAF9F7', // very light warm off-white for warning card backgrounds

  // --- Primary Emerald Action Palette ---
  jade: '#006C49', // primary action: deep authoritative emerald
  green500: '#4EDEA3', // primary_fixed_dim: large background accents and illustrative shapes
  green600: '#10B981', // primary_container: CTA gradient end (Emerald → Teal)
  green800: '#006C49', // deepest primary (repeat of jade)
  teal400: '#38BDF8', // sky blue: hydration or rest tracking
  teal500: '#0EA5E9', // main blue-teal
  teal600: '#0284C7', // deeper cyan/blue
  emerald200: '#BAEED1', // secondary_fixed: "Data Pulse" chip background

  // --- Soft Background Wash Colors (tonal layering, no borders) ---
  emerald900: '#B7EBCE', // secondary_container: light green wash for hover states
  swampGreen: '#F0FDF5', // soft neutral green wash background
  darkMint: '#ECFDF5', // very soft mint wash background
  darkForest: '#FEF3C7', // soft amber wash (streaks)
  deepGreen: '#FEFCE8', // soft yellow wash (warnings)
  darkViridian: '#B7EBCE', // secondary_container
  gunmetalGreen: '#E0F2FE', // soft blue wash
  darkSeaGreen: '#E0F2FE', // soft blue wash
  charcoalGreen: '#F2F4F6', // surface_container_low: card surface background

  // --- Accent Colors ---
  neonMint: '#BAEED1', // secondary_fixed: calm mint chip/tint background
  tan: '#FED7AA', // soft warm taupe
  sage: '#B7EBCE', // secondary_container soft green accent (recovery goals)
  orange500: '#F97316',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  yellow500: '#FDE047',

  // --- Purples, Blues, Indigos (Rest & Recovery Tones) ---
  indigo200: '#EEF2FF',
  indigo400: '#A5B4FC',
  indigo500: '#818CF8',
  indigo600: '#6366F1',
  blue500: '#3B82F6',
  blue600: '#2563EB',
  violet300: '#DDD6FE',
  violet500: '#A78BFA',
  violet800: '#8B5CF6',
  purple500: '#C084FC',
  darkPurpleBg: '#F3E8FF',

  // --- Red/Danger Accents ---
  darkRedBg: '#FEE2E2', // very soft light red wash for error backgrounds
  red400: '#FCA5A5', // soft coral red
  red500: '#F87171', // rose red
  red900: '#A43A3A', // tertiary editorial red: informs rather than screams
  rose500: '#FB7185',
  rose600: '#F43F5E',
  rose900: '#E11D48',
  pink500: '#EC4899',
};

const kineticDepth = {
  surfaceBlack: '#0d1511', // Obsidian surface base
  gray900: '#1a1f1c', // Darkest neutral surface (obsidian-tinted)
  charcoalGreen: '#111a15', // Dark obsidian green surface
  emerald900: '#064e3b', // Data Series 4: Forest Accent
  darkViridian: '#1c3829', // Medium dark obsidian green
  green800: '#0d4a2d', // Deep green surface
  deepGreen: '#132a1e', // Dark green surface
  darkForest: '#0a1c13', // Very dark forest surface
  swampGreen: '#091310', // Darkest obsidian variant
  darkMint: '#0c1a13', // Near-obsidian dark
  gunmetalGreen: '#152020', // Dark neutral-green surface
  darkSeaGreen: '#0c2419', // Dark teal surface
  jade: '#10b981', // Primary Vibrant Emerald
  green500: '#29a577', // Data Series 1: Bright Mint
  teal500: '#0f766e', // Data Series 2: Deep Teal
  teal400: '#99f6e4', // Data Series 3: Soft Sage
  gray800: '#1c2620', // Dark surface with green tint
  gray700: '#2c3a32', // Medium-dark green-gray
  gray850: '#1e2922', // Medium dark green surface
  blue600: '#2563eb',
  indigo500: '#6366f1',
  blue500: '#3b82f6',
  indigo400: '#818cf8',
  gray500: '#587068', // Muted teal-gray
  zinc500: '#6a7874', // Muted teal-zinc
  red900: '#7f1d1d',
  rose900: '#9f1239',
  violet500: '#8b5cf6',
  purple500: '#a855f7',
  zinc400: '#8e9e96', // Teal-tinted zinc
  gray400: '#9cb0a8', // Teal-tinted gray
  gray300: '#c0cfc6', // Light green-tinted gray
  gray200: '#dce5de', // On-Surface off-white
  white: '#dce5de', // On-Surface: high-readability off-white (not pure white)
  rose500: '#da2552',
  rose600: '#e11d48',
  yellow500: '#eab308',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  red500: '#ef4444',
  red400: '#f87171',
  teal600: '#007068', // Gradient end: Emerald-to-Teal CTA
  green600: '#10b981', // Repeat of primary emerald
  neonMint: '#34d399', // Bright Mint (Data Series 1)
  darkRedBg: '#3d1515',
  darkPurpleBg: '#3d3162',
  gray600: '#476058', // Muted teal-gray
  indigo600: '#4f46e5',
  violet800: '#5b21b6',
  warmGray: '#8a9690', // Teal-tinted warm gray
  sage: '#99f6e4', // Data Series 3: Soft Sage
  violet300: '#a78bfa',
  emerald200: '#a7f3d0', // Supporting Accent: Subtle Lime
  indigo200: '#c7d2fe',
  tan: '#d4b5a0',
  pink500: '#ec4899',
  orange500: '#f97316',
};

export function addOpacityToHex(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Handle shorthand hex colors
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  // Parse RGB values
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function generateColors(palette: typeof kineticDepth) {
  return {
    ...palette,
    surfaceBlackFade: addOpacityToHex(palette.surfaceBlack, 0.38),
    gray900Fade: addOpacityToHex(palette.gray900, 0.12),
    zinc400Fade: addOpacityToHex(palette.zinc400, 0.12),
    whiteFade: addOpacityToHex(palette.surfaceBlack, 0.38),
    blackAlpha10: addOpacityToHex(palette.surfaceBlack, 0.1),
    blackAlpha15: addOpacityToHex(palette.surfaceBlack, 0.15),
    blackAlpha20: addOpacityToHex(palette.surfaceBlack, 0.2),
    blackAlpha30: addOpacityToHex(palette.surfaceBlack, 0.3),
    blackAlpha40: addOpacityToHex(palette.surfaceBlack, 0.4),
    blackAlpha60: addOpacityToHex(palette.surfaceBlack, 0.6),
    overlayDark: addOpacityToHex(palette.surfaceBlack, 0.6),
    blackAlpha80: addOpacityToHex(palette.surfaceBlack, 0.8),
    blackAlpha90: addOpacityToHex(palette.surfaceBlack, 0.9),
    overlayDarker: addOpacityToHex(palette.surfaceBlack, 0.9),
    darkJungleAlpha20: addOpacityToHex(palette.swampGreen, 0.2),
    darkJungleAlpha80: addOpacityToHex(palette.swampGreen, 0.8),
    darkJungleAlpha90: addOpacityToHex(palette.swampGreen, 0.9),
    gray500Alpha10: addOpacityToHex(palette.gray500, 0.1),
    gray800Alpha50: addOpacityToHex(palette.gray800, 0.5),
    gray700Alpha30: addOpacityToHex(palette.gray700, 0.3),
    gray600Alpha40: addOpacityToHex(palette.gray600, 0.4),
    gray600Alpha50: addOpacityToHex(palette.gray600, 0.5),
    violetAlpha20: addOpacityToHex(palette.violet500, 0.2),
    purpleAlpha10: addOpacityToHex(palette.purple500, 0.1),
    purpleAlpha13: addOpacityToHex(palette.purple500, 0.13),
    purpleAlpha20: addOpacityToHex(palette.purple500, 0.2),
    purpleAlpha40: addOpacityToHex(palette.purple500, 0.4),
    emeraldAlpha10: addOpacityToHex(palette.jade, 0.1),
    emeraldAlpha20: addOpacityToHex(palette.jade, 0.2),
    emeraldAlpha30: addOpacityToHex(palette.jade, 0.3),
    greenAlpha05: addOpacityToHex(palette.green500, 0.05),
    greenAlpha10: addOpacityToHex(palette.green500, 0.1),
    greenAlpha20: addOpacityToHex(palette.green500, 0.2),
    successHighlight20: addOpacityToHex(palette.green500, 0.2),
    successBg20: addOpacityToHex(palette.green500, 0.2),
    greenAlpha30: addOpacityToHex(palette.green500, 0.3),
    greenAlpha40: addOpacityToHex(palette.green500, 0.4),
    greenAlpha50: addOpacityToHex(palette.green500, 0.5),
    jadeAlpha10: addOpacityToHex(palette.jade, 0.1),
    jadeAlpha20: addOpacityToHex(palette.jade, 0.2),
    jadeAlpha31: addOpacityToHex(palette.jade, 0.31),
    tealAlpha20: addOpacityToHex(palette.teal500, 0.2),
    roseAlpha20: addOpacityToHex(palette.rose600, 0.2),
    pinkRedAlpha10: addOpacityToHex(palette.rose500, 0.1),
    pinkAlpha20: addOpacityToHex(palette.pink500, 0.2),
    yellowAlpha10: addOpacityToHex(palette.yellow500, 0.1),
    yellowAlpha20: addOpacityToHex(palette.yellow500, 0.2),
    amberAlpha10: addOpacityToHex(palette.amber400, 0.1),
    orangeAlpha10: addOpacityToHex(palette.orange500, 0.1),
    orangeAlpha20: addOpacityToHex(palette.orange500, 0.2),
    orangeAlpha50: addOpacityToHex(palette.orange500, 0.5),
    redAlpha08: addOpacityToHex(palette.red500, 0.08),
    redAlpha10: addOpacityToHex(palette.red500, 0.1),
    redAlpha12: addOpacityToHex(palette.red500, 0.125),
    redAlpha20: addOpacityToHex(palette.red500, 0.2),
    redAlpha50: addOpacityToHex(palette.red500, 0.5),
    whiteAlpha02: addOpacityToHex(palette.white, 0.02),
    whiteAlpha03: addOpacityToHex(palette.white, 0.03),
    whiteAlpha05: addOpacityToHex(palette.white, 0.05),
    surfaceHighlight05: addOpacityToHex(palette.white, 0.05),
    whiteAlpha10: addOpacityToHex(palette.white, 0.1),
    whiteAlpha12: addOpacityToHex(palette.white, 0.125),
    surfaceHighlight12: addOpacityToHex(palette.white, 0.125),
    whiteAlpha20: addOpacityToHex(palette.white, 0.2),
    surfaceHighlight20: addOpacityToHex(palette.white, 0.2),
    borderWhite20: addOpacityToHex(palette.white, 0.2),
    whiteAlpha30: addOpacityToHex(palette.white, 0.3),
    surfaceHighlight30: addOpacityToHex(palette.white, 0.3),
    borderWhite30: addOpacityToHex(palette.white, 0.3),
    whiteAlpha50: addOpacityToHex(palette.white, 0.5),
    whiteAlpha60: addOpacityToHex(palette.white, 0.6),
    whiteAlpha70: addOpacityToHex(palette.white, 0.7),
    whiteAlpha80: addOpacityToHex(palette.white, 0.8),
    whiteAlpha90: addOpacityToHex(palette.white, 0.9),
    swampGreenAlpha50: addOpacityToHex(palette === kineticDepth ? '#111413' : palette.swampGreen, 0.5),
    darkGreenAlpha50: addOpacityToHex(palette === kineticDepth ? '#192b23' : palette.swampGreen, 0.5),
    deepTealAlpha90: addOpacityToHex(palette === kineticDepth ? '#1a2e2a' : palette.swampGreen, 0.9),
    swampGreenAlpha80: addOpacityToHex(palette === kineticDepth ? '#1b3227' : palette.swampGreen, 0.8),
    blackGrayAlpha40: addOpacityToHex(palette === kineticDepth ? '#1e2321' : palette.gray900, 0.4),
    blackGrayAlpha50: addOpacityToHex(palette === kineticDepth ? '#1e2321' : palette.gray900, 0.5),
    blackGrayAlpha90: addOpacityToHex(palette === kineticDepth ? '#1e2321' : palette.gray900, 0.9),
    neonMintAlpha10: addOpacityToHex(palette.neonMint, 0.1),
    neonMintAlpha20: addOpacityToHex(palette.neonMint, 0.2),
    darkTaupeSolid: addOpacityToHex(palette === kineticDepth ? '#2a322e' : palette.gray850, 1),
    blueAlpha10: addOpacityToHex(palette.blue500, 0.1),
    blueAlpha20: addOpacityToHex(palette.blue500, 0.2),
    infoBg20: addOpacityToHex(palette.blue500, 0.2),
    blueAlpha40: addOpacityToHex(palette.blue500, 0.4),
    blueAlpha50: addOpacityToHex(palette.blue500, 0.5),
    emerald900Alpha30: addOpacityToHex(palette.emerald900, 0.3),
    indigoAlpha30: addOpacityToHex(palette.indigo600, 0.3),
    indigoLightAlpha10: addOpacityToHex(palette.indigo500, 0.1),
    indigoLightAlpha20: addOpacityToHex(palette.indigo500, 0.2),
    indigoLightAlpha20Alt: addOpacityToHex(palette.indigo500, 0.2),
  };
}

function generateThemeColors(colors: ReturnType<typeof generateColors>) {
  return {
    // Background colors
    background: {
      primary: colors.swampGreen, // Main app background
      secondary: colors.swampGreen, // Secondary backgrounds (nav bar, cards)
      tertiary: colors.surfaceBlack, // Darker backgrounds (food page)
      card: colors.charcoalGreen, // Card backgrounds
      cardElevated: colors.gunmetalGreen, // Elevated card backgrounds
      secondaryDark: colors.darkMint, // Dark card backgrounds (active states)
      overlay: colors.darkSeaGreen, // Overlay backgrounds
      filterTab: colors.darkSeaGreen, // Filter tab background
      iconDark: colors.darkSeaGreen, // Dark icon backgrounds
      iconDarker: colors.darkSeaGreen, // Darker icon backgrounds
      iconDarkest: colors.gunmetalGreen, // Darkest icon backgrounds
      workoutIcon: colors.green600, // Workout action button icon background
      imageLight: colors.tan, // Light image background
      imageMedium: colors.warmGray, // Medium image background
      notificationCard: colors.deepGreen, // Notification card gradient start
      gray700: colors.gray700, // Gray-700
      gray800: colors.gray800, // Gray-800
      gray800Opacity50: colors.gray800Alpha50, // Gray-800/50
      white: colors.white, // White background
      overlayDark: colors.blackAlpha60, // Black overlay with 60% opacity
      purpleBlob: colors.darkPurpleBg, // Purple blob background
      greenBlob: colors.green800, // Green blob background
      darkGreen50: colors.darkGreenAlpha50, // Dark green with 50% opacity
      darkGreen80: colors.swampGreenAlpha80, // Dark green with 80% opacity
      black10: colors.blackAlpha10, // Black with 10% opacity
      black15: colors.blackAlpha15, // Black with 15% opacity
      black20: colors.blackAlpha20, // Black with 20% opacity
      black30: colors.blackAlpha30, // Black with 30% opacity
      black40: colors.blackAlpha40, // Black with 40% opacity
      black80: colors.blackAlpha80, // Black with 80% opacity
      black90: colors.blackAlpha90, // Black with 90% opacity
      aiCardBackground: colors.swampGreen, // Dark green for AI card background
      darkGreenVariant: colors.deepGreen, // Dark green variant for tags/badges
      darkGreenOverlay: colors.deepTealAlpha90, // Dark green overlay (rgba(26, 46, 42, 0.9))
      darkGreenSolid: colors.darkSeaGreen, // Dark green solid color
      darkGray: colors.blackGrayAlpha40, // Dark gray background with opacity
      darkGray50: colors.blackGrayAlpha50, // Dark gray with 50% opacity
      darkGray90: colors.blackGrayAlpha90, // Dark gray with 90% opacity
      darkGraySolid: colors.swampGreenAlpha50, // Dark gray solid with opacity
      darkGreenSolidAlt: colors.darkTaupeSolid, // Alternative dark green solid
      exerciseCardBackground: colors.darkViridian, // Exercise card background
      darkBackground: colors.swampGreen, // Dark background color (landing page, etc.)
      snackbarSuccess: colors.darkForest, // Success snackbar background
      snackbarError: colors.darkRedBg, // Error snackbar background
      buttonCard: colors.darkSeaGreen, // Button/card background
      buttonCardActive: colors.darkSeaGreen, // Active button/card background
      separatorLight: colors.gray200, // Light separator (gray-200)
      // White background with opacity
      white2: colors.whiteAlpha02, // White with ~3% opacity
      white3: colors.whiteAlpha03, // White with ~3% opacity
      white5: colors.surfaceHighlight05, // White with 5% opacity
      white10: colors.whiteAlpha10, // White with 10% opacity
      white12: colors.surfaceHighlight12, // White with ~12.5% opacity
      white20: colors.borderWhite20, // White with 20% opacity
      white30: colors.borderWhite30, // White with 30% opacity
      // Background primary with opacity
      primary20: colors.darkJungleAlpha20, // Background primary with 20% opacity
    },

    // Text colors
    text: {
      primary: colors.white, // Primary text (white token which is dark in light theme)
      secondary: colors.gray400, // Secondary text (gray-400)
      tertiary: colors.gray600, // Tertiary text (gray-600)
      muted: colors.gray500, // Muted text
      accent: colors.green500, // Accent text (green)
      accentLight: colors.jade, // Light accent text (emerald)
      black: colors.surfaceBlack, // Black text (for icons on light backgrounds)
      gray300: colors.gray300, // Gray-300
      gray500: colors.gray500, // Gray-500
      white: colors.white, // White
      // Fixed-white token: always pure white regardless of theme, for text on colorful gradient surfaces
      onColorful: '#ffffff',
      // Text colors with opacity
      primary12: colors.surfaceHighlight12, // Primary with 12.5% opacity
      primary20: colors.borderWhite20, // Primary with 20% opacity
      primary30: colors.borderWhite30, // Primary with 30% opacity
    },

    // Accent colors
    accent: {
      primary: colors.green500, // Primary green
      secondary: colors.jade, // Secondary green (emerald)
      tertiary: colors.teal500, // Tertiary green (teal)
      gradient: {
        start: colors.jade,
        end: colors.teal500,
      },
      // Accent colors with opacity
      primary10: colors.greenAlpha10, // Primary with 10% opacity
      primary30: colors.greenAlpha30, // Primary with 30% opacity
      primary20: colors.successBg20, // Primary with 20% opacity
      primary40: colors.greenAlpha40, // Primary with 40% opacity
      primary50: colors.greenAlpha50, // Primary with 50% opacity
      primary5: colors.greenAlpha05, // Primary with 5% opacity
      secondary10: colors.jadeAlpha10, // Secondary with 10% opacity
      secondary20: colors.jadeAlpha20, // Secondary with 20% opacity
      secondary31: colors.jadeAlpha31, // Secondary with 31% opacity
    },

    // Border colors
    border: {
      default: colors.gray600Alpha50, // gray-800/50
      light: colors.gray700Alpha30, // gray-700/30
      dark: colors.darkSeaGreen, // Dark border
      accent: colors.darkViridian, // Accent border
      dashed: colors.gray700, // Dashed border (gray-700)
      emerald: colors.emerald900Alpha30, // emerald-900/30
      blue: colors.blueAlpha40, // blue-500/40
      gray600: colors.gray600Alpha40, // gray-600/40
    },

    // Status colors
    status: {
      success: colors.green500,
      warning: colors.orange500, // Orange
      error: colors.red500, // Red
      info: colors.blue500, // Blue
      purple: colors.purple500, // Purple
      notificationBadge: colors.red500, // Red notification badge (same as error)
      amber: colors.amber400, // Amber-400
      yellow: colors.yellow500, // Yellow-500
      indigo: colors.indigo500, // Indigo-500
      indigoLight: colors.indigo400, // Indigo-400
      emerald: colors.jade, // Emerald-500
      emeraldLight: colors.neonMint, // Emerald-400
      greenDark: colors.jade, // Green-600
      indigoVeryLight: colors.indigo200, // Indigo-100
      emeraldVeryLight: colors.emerald200, // Emerald-200
      // Status colors with opacity
      success20: colors.successBg20, // Success with 20% opacity
      error8: colors.redAlpha08, // Error with 8% opacity
      error10: colors.redAlpha10, // Error with 10% opacity
      error12: colors.redAlpha12, // Error with 12.5% opacity
      error20: colors.redAlpha20, // Error with 20% opacity
      error50: colors.redAlpha50, // Error with 50% opacity
      info20: colors.infoBg20, // Info with 20% opacity
      info10: colors.blueAlpha10, // Info with 10% opacity
      info50: colors.blueAlpha50, // Info with 50% opacity
      warning50: colors.orangeAlpha50, // Warning with 50% opacity
      purple40: colors.purpleAlpha40, // Purple with 40% opacity
      purple20: colors.purpleAlpha20, // Purple with 20% opacity
      purple13: colors.purpleAlpha13, // Purple with 13% opacity (hex '22')
      purple10: colors.purpleAlpha10, // Purple with 10% opacity
      amber10: colors.amberAlpha10, // Amber with 10% opacity
      warning10: colors.orangeAlpha10, // Warning with 10% opacity
      emerald10: colors.emeraldAlpha10, // Emerald with 10% opacity
      emerald20: colors.emeraldAlpha20, // Emerald with 20% opacity
      emerald30: colors.emeraldAlpha30, // Emerald with 30% opacity
      emerald400_10: colors.neonMintAlpha10, // Emerald-400 with 10% opacity
      emerald400_20: colors.neonMintAlpha20, // Emerald-400 with 20% opacity
      yellow10: colors.yellowAlpha10, // Yellow with 10% opacity
      indigo10: colors.indigoLightAlpha10, // Indigo with 10% opacity
      indigo20: colors.indigoLightAlpha20Alt, // Indigo with 20% opacity
      indigo30: colors.indigoAlpha30, // Indigo-600 with 30% opacity
      indigo600: colors.indigo600, // Indigo-600
      // Red border colors for ungroup action
      redDark: colors.red900, // Dark red border
      // Emerald border colors for group action
      emeraldDark: colors.emerald900, // Dark emerald border
      indigo600Purple: colors.violet800, // Purple-700 (for indigo gradients)
      blue600: colors.blue600, // Blue-600
      pink500: colors.pink500, // Pink-500 (already in macros but adding for convenience)
      rose600: colors.rose600, // Rose-600
      customGreen: colors.sage, // Custom green used in components
      emeraldTeal: colors.teal600, // Teal-600 (for emerald-teal gradient)
      gray10: colors.gray500Alpha10, // Gray with 10% opacity
      // Error colors for ungroup action
      errorSolid: colors.red500, // Solid red for ungroup
      // Success colors for group action
      emeraldSolid: colors.jade, // Solid emerald for group
      // Additional status colors
      red400: colors.red400, // Red-400 (for fat icons, etc.)
      teal400: colors.teal400, // Teal-400 (for monounsat fat, etc.)
      purple400: '#a78bfa', // Purple-400 (for fiber icons, etc.)
      violet500: colors.violet500, // Violet-500 (for polyunsat fat, etc.)
    },

    // Rose colors (for red button variant)
    rose: {
      brand: colors.rose500, // Rose-700 (darker, less bright)
      dark: colors.rose900, // Rose-800 (darker variant)
      // Rose colors with opacity
      brand10: colors.pinkRedAlpha10, // Rose-brand with 10% opacity
      brand20: colors.roseAlpha20, // Rose-brand with 20% opacity
    },

    // Macro colors
    macros: {
      protein: {
        text: colors.indigo500, // Indigo-500
        bg: colors.indigo500, // Indigo-500
      },
      carbs: {
        text: colors.jade, // Emerald-500
        bg: colors.jade, // Emerald-500
      },
      fat: {
        text: colors.amber500, // Amber-500
        bg: colors.amber500, // Amber-500
      },
      fiber: {
        text: colors.pink500, // Pink-500
        bg: colors.pink500, // Pink-500
      },
    },

    // Avatar colors
    avatar: {
      emerald: colors.green500, // Primary green
      blue: colors.blue500, // Blue-500
      purple: colors.violet500, // Violet-500
      pink: colors.pink500, // Pink-500
      orange: colors.orange500, // Orange-500
      teal: colors.teal500, // Teal-500
      yellow: colors.yellow500, // Yellow-500
      indigo: colors.indigo500, // Indigo-500
    },

    // Avatar background colors (with opacity)
    avatarBg: {
      emerald: colors.successBg20, // emerald/20
      blue: colors.infoBg20, // blue-500/20
      purple: colors.violetAlpha20, // violet-500/20
      pink: colors.pinkAlpha20, // pink-500/20
      orange: colors.orangeAlpha20, // orange-500/20
      teal: colors.tealAlpha20, // teal-500/20
      yellow: colors.yellowAlpha20, // yellow-500/20
      indigo: colors.indigoLightAlpha20Alt, // indigo-500/20
    },

    // Google brand colors
    google: {
      borderLight: colors.zinc500, // Light border for Google button
      borderDark: colors.zinc400, // Dark border for Google button
      backgroundDark: colors.surfaceBlack, // Dark background for Google button
      textLight: colors.gray900, // Light text for Google button
      textDark: colors.gray200, // Dark text for Google button
      overlayDark: colors.gray850, // Dark overlay for Google button
      overlayLight: colors.gray200, // Light overlay for Google button
      disabledBorderLight: colors.gray900Fade, // Disabled border (light variant)
      disabledBorderDark: colors.zinc400Fade, // Disabled border (dark variant)
      disabledBgLight: colors.whiteFade, // Disabled background (light variant)
      disabledBgDark: colors.surfaceBlackFade, // Disabled background (dark variant)
    },

    // Overlay and opacity colors
    overlay: {
      black60: colors.blackAlpha60, // Black with 60% opacity
      black90: colors.overlayDarker, // Black with 90% opacity
      white50: colors.whiteAlpha50, // White with 50% opacity
      white60: colors.whiteAlpha60, // White with 60% opacity
      white70: colors.whiteAlpha70, // White with 70% opacity
      white90: colors.whiteAlpha90, // White with 90% opacity
      white80: colors.whiteAlpha80, // White with 80% opacity
      white30: colors.borderWhite30, // White with 30% opacity
      white20: colors.borderWhite20, // White with 20% opacity
      white5: colors.surfaceHighlight05, // White with 5% opacity
      black60Opacity: colors.blackAlpha60, // Black with 60% opacity (for gradients)
      backdrop: colors.darkJungleAlpha80, // Background primary with 80% opacity (for modals)
      backdrop90: colors.darkJungleAlpha90, // Background primary with 90% opacity
      darkGreenOverlayGradient: colors.deepTealAlpha90, // Dark green overlay gradient
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
      primary: [colors.blue500, colors.teal600, colors.jade] as const,
      accent: [colors.jade, colors.teal500] as const,
      card: [colors.gunmetalGreen, colors.swampGreenAlpha50] as const,
      button: [colors.darkSeaGreen, colors.charcoalGreen] as const,
      progress: [colors.indigo500, colors.teal600, colors.jade] as const,
      workoutsTitle: [colors.violet300, colors.blue500, colors.jade] as const,
      notification: [colors.deepGreen, colors.darkMint] as const,
      upNextCard: [colors.darkSeaGreen, colors.charcoalGreen, colors.gunmetalGreen] as const,
      cta: [colors.indigo600, colors.neonMint] as const, // Indigo to primary green gradient
      userBubble: [colors.green500, colors.jade] as const, // User message bubble gradient
      celebrationGlow: [colors.indigo200, colors.white, colors.emerald200] as const, // Celebration header gradient
      restOverTitle: [colors.green500, colors.indigo400] as const, // Rest over title gradient
      workoutStats: [colors.indigo400, colors.green500, colors.jade] as const, // Workout stats gradient
      workoutSessionOverlay: [
        addOpacityToHex(colors.swampGreen, 0.95),
        addOpacityToHex(colors.swampGreen, 0.85),
        addOpacityToHex(colors.swampGreen, 0.7),
      ] as const,
      indigoPurple: [colors.indigo600, colors.violet800] as const, // Indigo to purple gradient
      emeraldTeal: [colors.jade, colors.teal600] as const, // Emerald to teal gradient
      pinkRose: [colors.pink500, colors.rose600] as const, // Pink to rose gradient
      blueEmerald: [colors.blue600, colors.jade] as const, // Blue to emerald gradient
      overlayDark: ['transparent', colors.deepTealAlpha90, colors.darkSeaGreen] as const, // Dark overlay gradient
      cameraOverlay: [colors.blackAlpha60, 'transparent', colors.blackAlpha90] as const, // Camera overlay gradient
      onboardingAmbient: [
        colors.indigoLightAlpha20Alt, // indigo-600/20
        colors.neonMintAlpha20, // primary/20
        colors.emeraldAlpha20, // emerald-400/20
      ] as const,
      landingBackground: [colors.swampGreen, colors.swampGreen, colors.swampGreen] as const, // Landing page background gradient
      whiteSubtle: [colors.whiteAlpha10, colors.surfaceHighlight05] as const, // Subtle white gradient
      backdrop90: colors.darkJungleAlpha90, // Background with 90% opacity
    },
  };
}

const sharedTheme = {
  typography: {
    // Font sizes
    fontSize: {
      xxs: 10, // Extra extra small font size (for badges, etc.)
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '40': 40,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
      '7xl': 80,
      '8xl': 96,
    },

    // Font weights
    fontWeight: {
      normal: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      extrabold: '800' as const,
      black: '900' as const,
    },

    // Line heights
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },

    // Letter spacing
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1,
      extraWide: 1.5,
    },
  },

  spacing: {
    // Padding
    padding: {
      zero: 0, // Zero padding
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
      // Additional padding values for fractional spacing
      '1half': 6, // 1.5 * 4 = 6px
      '2half': 10, // 2.5 * 4 = 10px
      '3half': 14, // 3.5 * 4 = 14px
      '4half': 18, // 4.5 * 4 = 18px
      // Specific padding values found in codebase
      '5': 20,
      '6': 24,
      '4xl': 120, // Large padding for footer spacing
      '5xl': 160, // Padding for modal content
      // Fractional padding values
      xsHalf: 2, // xs / 2 = 4 / 2 = 2px
      bottomButton: 165,
    },

    // Margin/Gap
    gap: {
      zero: 0, // Zero gap
      xs: 4,
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
      // Additional gap values for fractional spacing
      '2half': 10, // 2.5 * 4 = 10px
      '3half': 14, // 3.5 * 4 = 14px
      '4half': 18, // 4.5 * 4 = 18px
      // Specific gap values found in codebase
      '8': 8,
      // Very small spacing values
      '1': 1, // 1px gap (for dividers)
      '2': 2, // 2px gap
    },

    // Margin (same values as padding for consistency)
    margin: {
      zero: 0, // Zero margin
      '2': 2, // 2px margin
      xs: 4,
      '1half': 6, // 1.5 * 4 = 6px
      sm: 8,
      md: 12,
      base: 16,
      lg: 20,
      xl: 24,
      '2xl': 32,
      '3xl': 48,
      '4xl': 64,
      '5xl': 96,
      '6xl': 112,
      '7xl': 128,
      '8xl': 144,
    },
  },

  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    full: 9999,
    // Additional border radius values
    '2': 2, // 2px border radius (for small dots)
    '10': 10, // 10px border radius
    '20': 20, // 20px border radius
    '125': 125, // 125px for large circular backgrounds
    '150': 150, // 150px for large circular backgrounds
  },

  // Border widths
  borderWidth: {
    none: 0, // No border
    thin: 1,
    medium: 2,
    thick: 3, // 3px border width (for group indicators)
    // Additional border widths
    accent: 5, // For accent borders like snackbar
    thick6: 6, // 6px border width
  },

  // Negative offsets (for decorative positioning, glows, badges, etc.)
  offset: {
    glowSmall: -1, // Small offset for border glows
    badge: -8, // Badge positioning offset
    glowMedium: -40, // Medium offset for glow effects
    glowLarge: -50, // Large offset for glow effects
  },

  // Stroke widths (for icons and SVG)
  strokeWidth: {
    none: 0, // No stroke
    extraThin: 0.5, // 0.5px stroke width
    thin: 1,
    medium: 2, // 2px stroke width
    thick: 3,
  },

  // Icon sizes
  iconSize: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
    '7xl': 96,
    // Large background icons
    background: 160,
  },

  // Common sizes (for width, height, etc.)
  size: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
    '5xl': 80,
    // Specific sizes (matching Tailwind scale)
    '1': 4,
    '2': 8,
    '3': 12,
    '4': 16,
    '5': 20,
    '6': 24,
    '8': 32,
    '10': 40,
    '12': 48,
    '14': 56,
    '16': 64,
    '18': 72,
    '20': 80,
    '22': 88,
    '24': 96,
    '30': 120,
    '32': 128,
    '40': 160,
    '48': 192,
    '56': 224,
    '64': 256,
    '44': 44, // 44px size (for button heights)
    '60': 60, // 60px size (common width)
    '96': 96, // 96px size (for widths)
    '100': 100, // Common spacing/height value
    '120': 120, // Common spacing/height value
    '150': 150, // Common size value
    '180': 180, // Common height value (for cards)
    '400': 400, // Common max width value
    '480': 480, // Common max width value
    '160': 160, // Common size value (for illustrations/glows)
    '240': 240, // Common min width value (for cards)
    '250': 250, // Common size value (for background glows)
    '256': 256, // Common size value (for illustrations)
    '280': 280, // Common max width value
    '300': 300, // Common size value (for background glows)
    '384': 384, // Common height value
    // Fractional sizes (using valid keys)
    half: 2, // 0.5 * 4 = 2px
    '1half': 6, // 1.5 * 4 = 6px
    '2half': 10, // 2.5 * 4 = 10px
    '3half': 14, // 3.5 * 4 = 14px
  },

  // Max widths
  maxWidth: {
    sm: 384,
    md: 416,
    lg: 520,
    '400': 400, // 400px max width
    '480': 480, // 480px max width
  },

  // Component-specific sizes
  components: {
    button: {
      height: {
        sm: 36,
        md: 44,
        lg: 52,
      },
    },
  },

  // Aspect ratios
  aspectRatio: {
    square: 1, // 1:1
    portrait: 4 / 5, // 4:5 (portrait)
    landscape: 4 / 3, // 4:3 (landscape)
  },

  // Shadow offset values (for individual shadow properties)
  shadowOffset: {
    zero: { width: 0, height: 0 }, // No offset
    sm: { width: 0, height: 1 }, // Small offset
    md: { width: 0, height: 2 }, // Medium offset
    lg: { width: 0, height: 4 }, // Large offset
  },

  // Shadow opacity values (for individual shadow properties)
  shadowOpacity: {
    veryLight: 0.03, // Very light shadow (3%)
    light: 0.1, // Light shadow (10%)
    medium: 0.3, // Medium shadow (30%)
    mediumHeavy: 0.4, // Medium-heavy shadow (40%)
    medium50: 0.5, // Medium shadow (50%)
    heavy: 0.8, // Heavy shadow (80%)
    full: 1.0, // Full opacity
  },

  // Shadow radius values (for individual shadow properties)
  shadowRadius: {
    sm: 2, // Small radius
    md: 8, // Medium radius
    lg: 10, // Large radius
    xl: 20, // Extra large radius
    '2xl': 40, // 2x extra large radius
  },

  // Elevation values (for Android shadow elevation)
  elevation: {
    none: 0, // No elevation
    sm: 2, // Small elevation
    md: 3, // Medium elevation
    lg: 5, // Large elevation
    xl: 8, // Extra large elevation
    '2xl': 10, // 2x extra large elevation
    '3xl': 20, // 3x extra large elevation
  },

  // Z-index values (for layering elements)
  zIndex: {
    base: 0, // Base layer
    aboveBase: 1, // Just above base layer (for sliders, etc.)
    overlayLow: 5, // Low-level overlays (gradients, backgrounds)
    dropdown: 10, // Dropdown menus
    sticky: 20, // Sticky headers
    overlay: 30, // Overlays
    modal: 40, // Modals
    popover: 50, // Popovers and tooltips
    tooltip: 100, // Tooltips
    max: 2000, // Maximum z-index (for critical overlays)
  },
} as const;

function generateShadows(themeColors: ReturnType<typeof generateThemeColors>) {
  return {
    sm: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    accent: {
      shadowColor: themeColors.accent.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    // Additional shadow variants
    none: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Specific shadow radius values
    radius3: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    radius4: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    radius8: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    radius15: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    radius20: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    radius40: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 40,
      elevation: 20,
    },
    // Custom shadow for sliders
    slider: {
      shadowColor: themeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    accentGlow: {
      shadowColor: themeColors.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    error: {
      shadowColor: themeColors.status.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    purpleGlow: {
      shadowColor: themeColors.status.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 200,
      elevation: 0,
    },
    accentGlowLarge: {
      shadowColor: themeColors.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 5,
    },
    roseGlow: {
      shadowColor: themeColors.rose.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
  };
}

function createTheme(palette: typeof kineticDepth) {
  const colors = generateColors(palette);
  const themeColors = generateThemeColors(colors);
  const shadows = generateShadows(themeColors);

  return {
    ...sharedTheme,
    colors: themeColors,
    shadows,
  } as const;
}

export const darkTheme = createTheme(kineticDepth);
export const lightTheme = createTheme(kineticDepthLight);

export const theme = darkTheme;

// Type exports for TypeScript
export type Theme = typeof darkTheme;
export type ThemeColors = typeof darkTheme.colors;

/**
 * Utility functions for accessing theme values
 */

/**
 * Get a color value from the theme
 * @example getColor('background.primary') => colors.swampGreen
 */
export function getColor(path: string, currentTheme: Theme = theme): string {
  const parts = path.split('.');
  let value: any = currentTheme.colors;
  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      console.warn(`Theme color path "${path}" not found`);
      return currentTheme.colors.background.primary;
    }
  }

  return value as string;
}

/**
 * Get a spacing value from the theme
 */
export function getSpacing(size: keyof typeof sharedTheme.spacing.padding): number {
  return sharedTheme.spacing.padding[size];
}

/**
 * Get a font size from the theme
 */
export function getFontSize(size: keyof typeof sharedTheme.typography.fontSize): number {
  return sharedTheme.typography.fontSize[size];
}

/**
 * Get a border radius from the theme
 */
export function getBorderRadius(size: keyof typeof sharedTheme.borderRadius): number {
  return sharedTheme.borderRadius[size];
}

/**
 * Get the active theme based on database preference.
 * This can be used in non-React contexts.
 */
export async function getAsyncTheme(): Promise<Theme> {
  try {
    const { database } = await import('./database/database-instance');
    const { Q } = await import('@nozbe/watermelondb');
    const { THEME_SETTING_TYPE } = await import('./constants/settings');
    const SettingModel = (await import('./database/models/Setting')).default;

    const settings = (await database
      .get('settings')
      .query(Q.where('type', THEME_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch()) as unknown as InstanceType<typeof SettingModel>[];

    let preference = 'system';
    if (settings.length > 0) {
      const mostRecent = settings.reduce((latest, current) =>
        (current as any).updatedAt > (latest as any).updatedAt ? current : latest
      );
      preference = (mostRecent as any).value;
    }

    if (preference === 'system') {
      return Appearance.getColorScheme() === 'light' ? lightTheme : darkTheme;
    }

    return preference === 'light' ? lightTheme : darkTheme;
  } catch (error) {
    console.warn('[getAsyncTheme] Error fetching theme, falling back to darkTheme:', error);
    return darkTheme;
  }
}

/**
 * Usage Examples:
 *
 * 1. Using with NativeWind classes:
 *    <View className="bg-bg-primary text-text-primary">
 *
 * 2. Using with inline styles:
 *    const theme = useTheme();
 *    <View style={{ backgroundColor: theme.colors.background.primary }}>
 *
 * 3. Using utility functions:
 *    <View style={{ backgroundColor: getColor('background.primary') }}>
 *
 * 4. Using Tailwind classes (recommended for NativeWind):
 *    <View className="bg-bg-primary p-base rounded-2xl">
 *    <Text className="text-text-primary text-lg font-semibold">
 */
