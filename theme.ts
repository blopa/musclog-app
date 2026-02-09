/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */

const baseColors = {
  black: '#000000',
  emerald900: '#064e3b',
  blackOlive: '#0a0f0d',
  deepJungle: '#0a1f1a',
  darkForest: '#0d3520',
  teal600: '#0d9488',
  darkMint: '#0f2419',
  darkPine: '#0f251f',
  darkEmerald: '#0f2f27',
  emerald500: '#10b981',
  darkMoss: '#11211a',
  green800: '#125630',
  surfaceBlack: '#131314',
  charcoalGreen: '#141a17',
  teal500: '#14b8a6',
  swampGreen: '#15261f',
  green600: '#16a34a',
  gunmetalGreen: '#1a2420',
  gunmetalGreenDark: '#1a2520',
  darkSlateGreen: '#1a2e2a',
  jungleCard: '#1a2f2a',
  deepAquamarine: '#1a3530',
  deepGreen: '#1a3a2a',
  pineShadow: '#1a3d2f',
  pineDark: '#1a3d35',
  jade: '#1aa869',
  gray900: '#1f1f1f',
  gray800: '#1f2937',
  darkTealBg: '#1f4039',
  green500: '#22c55e',
  darkSeaGreen: '#243d37',
  hunterGreen: '#254637',
  blue600: '#2563eb',
  neonMint: '#29e08e',
  darkViridian: '#2a4d3f',
  teal400: '#2dd4bf',
  gray850: '#303030',
  emerald300: '#34d399',
  gray700: '#374151',
  blue500: '#3b82f6',
  darkRedBg: '#3d1515',
  darkPurpleBg: '#3d3162',
  gray600: '#4b5563',
  indigo600: '#4f46e5',
  violet800: '#5b21b6',
  indigo500: '#6366f1',
  gray500: '#6b7280',
  zinc500: '#747775',
  red900: '#7f1d1d',
  indigo400: '#818cf8',
  violet500: '#8b5cf6',
  warmGray: '#8b7d6b',
  zinc400: '#8e918f',
  sage: '#95c6b0',
  gray400: '#9ca3af',
  rose900: '#9f1239',
  violet300: '#a78bfa',
  emerald200: '#a7f3d0',
  purple500: '#a855f7',
  indigo200: '#c7d2fe',
  gray300: '#d1d5db',
  tan: '#d4b5a0',
  rose500: '#da2552',
  rose600: '#e11d48',
  gray200: '#e3e3e3',
  gray200Tailwind: '#e5e7eb',
  yellow500: '#eab308',
  pink500: '#ec4899',
  red500: '#ef4444',
  amber500: '#f59e0b',
  red400: '#f87171',
  orange500: '#f97316',
  amber400: '#fbbf24',
  white: '#ffffff',
};

const colors = {
  ...baseColors,
  surfaceBlackFade: addOpacityToHex(baseColors.surfaceBlack, 0.38),
  gray900Fade: addOpacityToHex(baseColors.gray900, 0.12),
  zinc400Fade: addOpacityToHex(baseColors.zinc400, 0.12),
  whiteFade: addOpacityToHex(baseColors.black, 0.38),
  blackAlpha10: addOpacityToHex(baseColors.black, 0.1),
  blackAlpha15: addOpacityToHex(baseColors.black, 0.15),
  blackAlpha20: addOpacityToHex(baseColors.black, 0.2),
  blackAlpha30: addOpacityToHex(baseColors.black, 0.3),
  blackAlpha40: addOpacityToHex(baseColors.black, 0.4),
  blackAlpha60: addOpacityToHex(baseColors.black, 0.6),
  overlayDark: addOpacityToHex(baseColors.black, 0.6),
  blackAlpha80: addOpacityToHex(baseColors.black, 0.8),
  blackAlpha90: addOpacityToHex(baseColors.black, 0.9),
  overlayDarker: addOpacityToHex(baseColors.black, 0.9),
  darkJungleAlpha20: addOpacityToHex(baseColors.deepJungle, 0.2),
  darkJungleAlpha80: addOpacityToHex(baseColors.deepJungle, 0.8),
  darkJungleAlpha90: addOpacityToHex(baseColors.deepJungle, 0.9),
  gray500Alpha10: addOpacityToHex(baseColors.gray500, 0.1),
  gray800Alpha50: addOpacityToHex(baseColors.gray800, 0.5),
  gray700Alpha30: addOpacityToHex(baseColors.gray700, 0.3),
  gray600Alpha40: addOpacityToHex(baseColors.gray600, 0.4),
  gray600Alpha50: addOpacityToHex(baseColors.gray600, 0.5),
  violetAlpha20: addOpacityToHex(baseColors.violet500, 0.2),
  purpleAlpha10: addOpacityToHex(baseColors.purple500, 0.1),
  purpleAlpha13: addOpacityToHex(baseColors.purple500, 0.13),
  purpleAlpha20: addOpacityToHex(baseColors.purple500, 0.2),
  purpleAlpha40: addOpacityToHex(baseColors.purple500, 0.4),
  emeraldAlpha10: addOpacityToHex(baseColors.emerald500, 0.1),
  emeraldAlpha20: addOpacityToHex(baseColors.emerald500, 0.2),
  emeraldAlpha30: addOpacityToHex(baseColors.emerald500, 0.3),
  greenAlpha05: addOpacityToHex(baseColors.green500, 0.05),
  greenAlpha10: addOpacityToHex(baseColors.green500, 0.1),
  greenAlpha20: addOpacityToHex(baseColors.green500, 0.2),
  successHighlight20: addOpacityToHex(baseColors.green500, 0.2),
  successBg20: addOpacityToHex(baseColors.green500, 0.2),
  greenAlpha30: addOpacityToHex(baseColors.green500, 0.3),
  greenAlpha40: addOpacityToHex(baseColors.green500, 0.4),
  greenAlpha50: addOpacityToHex(baseColors.green500, 0.5),
  emerald300Alpha10: addOpacityToHex(baseColors.emerald300, 0.1),
  emerald300Alpha20: addOpacityToHex(baseColors.emerald300, 0.2),
  emerald300Alpha31: addOpacityToHex(baseColors.emerald300, 0.31),
  tealAlpha20: addOpacityToHex(baseColors.teal500, 0.2),
  roseAlpha20: addOpacityToHex(baseColors.rose600, 0.2),
  pinkRedAlpha10: addOpacityToHex(baseColors.rose500, 0.1),
  pinkAlpha20: addOpacityToHex(baseColors.pink500, 0.2),
  yellowAlpha10: addOpacityToHex(baseColors.yellow500, 0.1),
  yellowAlpha20: addOpacityToHex(baseColors.yellow500, 0.2),
  amberAlpha10: addOpacityToHex(baseColors.amber400, 0.1),
  orangeAlpha10: addOpacityToHex(baseColors.orange500, 0.1),
  orangeAlpha20: addOpacityToHex(baseColors.orange500, 0.2),
  orangeAlpha50: addOpacityToHex(baseColors.orange500, 0.5),
  redAlpha08: addOpacityToHex(baseColors.red500, 0.08),
  redAlpha10: addOpacityToHex(baseColors.red500, 0.1),
  redAlpha12: addOpacityToHex(baseColors.red500, 0.125),
  redAlpha20: addOpacityToHex(baseColors.red500, 0.2),
  redAlpha50: addOpacityToHex(baseColors.red500, 0.5),
  whiteAlpha02: addOpacityToHex(baseColors.white, 0.02),
  whiteAlpha03: addOpacityToHex(baseColors.white, 0.03),
  whiteAlpha05: addOpacityToHex(baseColors.white, 0.05),
  surfaceHighlight05: addOpacityToHex(baseColors.white, 0.05),
  whiteAlpha10: addOpacityToHex(baseColors.white, 0.1),
  whiteAlpha12: addOpacityToHex(baseColors.white, 0.125),
  surfaceHighlight12: addOpacityToHex(baseColors.white, 0.125),
  whiteAlpha20: addOpacityToHex(baseColors.white, 0.2),
  surfaceHighlight20: addOpacityToHex(baseColors.white, 0.2),
  borderWhite20: addOpacityToHex(baseColors.white, 0.2),
  whiteAlpha30: addOpacityToHex(baseColors.white, 0.3),
  surfaceHighlight30: addOpacityToHex(baseColors.white, 0.3),
  borderWhite30: addOpacityToHex(baseColors.white, 0.3),
  whiteAlpha50: addOpacityToHex(baseColors.white, 0.5),
  whiteAlpha60: addOpacityToHex(baseColors.white, 0.6),
  whiteAlpha70: addOpacityToHex(baseColors.white, 0.7),
  whiteAlpha80: addOpacityToHex(baseColors.white, 0.8),
  whiteAlpha90: addOpacityToHex(baseColors.white, 0.9),
  darkMossAlpha50: addOpacityToHex('#111413', 0.5),
  darkGreenAlpha50: addOpacityToHex('#192b23', 0.5),
  deepTealAlpha90: addOpacityToHex('#1a2e2a', 0.9),
  darkPineAlpha80: addOpacityToHex('#1b3227', 0.8),
  blackGrayAlpha40: addOpacityToHex('#1e2321', 0.4),
  blackGrayAlpha50: addOpacityToHex('#1e2321', 0.5),
  blackGrayAlpha90: addOpacityToHex('#1e2321', 0.9),
  neonMintAlpha10: addOpacityToHex(baseColors.neonMint, 0.1),
  neonMintAlpha20: addOpacityToHex(baseColors.neonMint, 0.2),
  darkTaupeSolid: addOpacityToHex('#2a322e', 1),
  blueAlpha10: addOpacityToHex(baseColors.blue500, 0.1),
  blueAlpha20: addOpacityToHex(baseColors.blue500, 0.2),
  infoBg20: addOpacityToHex(baseColors.blue500, 0.2),
  blueAlpha40: addOpacityToHex(baseColors.blue500, 0.4),
  blueAlpha50: addOpacityToHex(baseColors.blue500, 0.5),
  emerald900Alpha30: addOpacityToHex(baseColors.emerald900, 0.3),
  indigoAlpha30: addOpacityToHex(baseColors.indigo600, 0.3),
  indigoLightAlpha10: addOpacityToHex(baseColors.indigo500, 0.1),
  indigoLightAlpha20: addOpacityToHex(baseColors.indigo500, 0.2),
  indigoLightAlpha20Alt: addOpacityToHex(baseColors.indigo500, 0.2),
};

// Light theme base colors
const lightBaseColors = {
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray150: '#eef0f2',
  gray200: '#e5e7eb',
  gray250: '#dfe2e6',
  gray300: '#d1d5db',
  gray350: '#c4c9cf',
  gray400: '#9ca3af',
  gray450: '#8891a0',
  gray500: '#6b7280',
  gray550: '#5d6775',
  gray600: '#4b5563',
  gray700: '#374151',
  gray750: '#2d3748',
  gray800: '#1f2937',
  gray850: '#1a202c',
  gray900: '#111827',
  emerald50: '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald300: '#6ee7b7',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',
  teal50: '#f0fdfa',
  teal100: '#ccfbf1',
  teal200: '#99f6e4',
  teal300: '#5eead4',
  teal400: '#2dd4bf',
  teal500: '#14b8a6',
  green50: '#f0fdf4',
  green100: '#dcfce7',
  green200: '#bbf7d0',
  green300: '#86efac',
  green400: '#4ade80',
  green500: '#22c55e',
  green600: '#16a34a',
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  indigo50: '#eef2ff',
  indigo100: '#e0e7ff',
  indigo200: '#c7d2fe',
  indigo300: '#a5b4fc',
  indigo400: '#818cf8',
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  violet50: '#f5f3ff',
  violet100: '#ede9fe',
  violet200: '#ddd6fe',
  violet300: '#c4b5fd',
  violet400: '#a78bfa',
  violet500: '#8b5cf6',
  purple50: '#faf5ff',
  purple100: '#f3e8ff',
  purple200: '#e9d5ff',
  purple300: '#d8b4fe',
  purple400: '#c084fc',
  purple500: '#a855f7',
  pink50: '#fdf2f8',
  pink100: '#fce7f3',
  pink200: '#fbcfe8',
  pink300: '#f9a8d4',
  pink400: '#f472b6',
  pink500: '#ec4899',
  rose50: '#fff1f2',
  rose100: '#ffe4e6',
  rose200: '#fecdd3',
  rose300: '#fda4af',
  rose400: '#fb7185',
  rose500: '#f43f5e',
  rose600: '#e11d48',
  red50: '#fef2f2',
  red100: '#fee2e2',
  red200: '#fecaca',
  red300: '#fca5a5',
  red400: '#f87171',
  red500: '#ef4444',
  orange50: '#fff7ed',
  orange100: '#ffedd5',
  orange200: '#fed7aa',
  orange300: '#fdba74',
  orange400: '#fb923c',
  orange500: '#f97316',
  amber50: '#fffbeb',
  amber100: '#fef3c7',
  amber200: '#fde68a',
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  yellow50: '#fefce8',
  yellow100: '#fef9c3',
  yellow200: '#fef08a',
  yellow300: '#fde047',
  yellow400: '#facc15',
  yellow500: '#eab308',
};

const darkThemeColors = {
  // Background colors
  background: {
    primary: colors.deepJungle, // Main app background
    secondary: colors.darkPine, // Secondary backgrounds (nav bar, cards)
    tertiary: colors.blackOlive, // Darker backgrounds (food page)
    card: colors.charcoalGreen, // Card backgrounds
    cardElevated: colors.gunmetalGreenDark, // Elevated card backgrounds
    secondaryDark: colors.darkMint, // Dark card backgrounds (active states)
    overlay: colors.jungleCard, // Overlay backgrounds
    filterTab: colors.darkEmerald, // Filter tab background
    iconDark: colors.pineDark, // Dark icon backgrounds
    iconDarker: colors.darkSeaGreen, // Darker icon backgrounds
    iconDarkest: colors.gunmetalGreen, // Darkest icon backgrounds
    workoutIcon: colors.green600, // Workout action button icon background
    imageLight: colors.tan, // Light image background
    imageMedium: colors.warmGray, // Medium image background
    notificationCard: colors.pineShadow, // Notification card gradient start
    gray700: colors.gray700, // Gray-700
    gray800: colors.gray800, // Gray-800
    gray800Opacity50: colors.gray800Alpha50, // Gray-800/50
    white: colors.white, // White background
    overlayDark: colors.blackAlpha60, // Black overlay with 60% opacity
    purpleBlob: colors.darkPurpleBg, // Purple blob background
    greenBlob: colors.green800, // Green blob background
    darkGreen50: colors.darkGreenAlpha50, // Dark green with 50% opacity
    darkGreen80: colors.darkPineAlpha80, // Dark green with 80% opacity
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
    darkGreenSolid: colors.darkSlateGreen, // Dark green solid color
    darkGray: colors.blackGrayAlpha40, // Dark gray background with opacity
    darkGray50: colors.blackGrayAlpha50, // Dark gray with 50% opacity
    darkGray90: colors.blackGrayAlpha90, // Dark gray with 90% opacity
    darkGraySolid: colors.darkMossAlpha50, // Dark gray solid with opacity
    darkGreenSolidAlt: colors.darkTaupeSolid, // Alternative dark green solid
    exerciseCardBackground: colors.hunterGreen, // Exercise card background
    darkBackground: colors.darkMoss, // Dark background color (landing page, etc.)
    snackbarSuccess: colors.darkForest, // Success snackbar background
    snackbarError: colors.darkRedBg, // Error snackbar background
    buttonCard: colors.deepAquamarine, // Button/card background
    buttonCardActive: colors.darkTealBg, // Active button/card background
    separatorLight: colors.gray200Tailwind, // Light separator (gray-200)
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
    primary: colors.white, // Primary text (white)
    secondary: colors.gray400, // Secondary text (gray-400)
    tertiary: colors.gray600, // Tertiary text (gray-600)
    muted: colors.gray500, // Muted text
    accent: colors.green500, // Accent text (green)
    accentLight: colors.emerald300, // Light accent text (emerald)
    black: colors.black, // Black text (for icons on light backgrounds)
    gray300: colors.gray300, // Gray-300
    gray500: colors.gray500, // Gray-500
    white: colors.white, // White
    // Text colors with opacity
    primary12: colors.surfaceHighlight12, // Primary with 12.5% opacity
    primary20: colors.borderWhite20, // Primary with 20% opacity
    primary30: colors.borderWhite30, // Primary with 30% opacity
  },

  // Accent colors
  accent: {
    primary: colors.green500, // Primary green
    secondary: colors.emerald300, // Secondary green (emerald)
    tertiary: colors.teal500, // Tertiary green (teal)
    gradient: {
      start: colors.emerald300,
      end: colors.teal500,
    },
    // Accent colors with opacity
    primary10: colors.greenAlpha10, // Primary with 10% opacity
    primary30: colors.greenAlpha30, // Primary with 30% opacity
    primary20: colors.successBg20, // Primary with 20% opacity
    primary40: colors.greenAlpha40, // Primary with 40% opacity
    primary50: colors.greenAlpha50, // Primary with 50% opacity
    primary5: colors.greenAlpha05, // Primary with 5% opacity
    secondary10: colors.emerald300Alpha10, // Secondary with 10% opacity
    secondary20: colors.emerald300Alpha20, // Secondary with 20% opacity
    secondary31: colors.emerald300Alpha31, // Secondary with 31% opacity
  },

  // Border colors
  border: {
    default: colors.gray600Alpha50, // gray-800/50
    light: colors.gray700Alpha30, // gray-700/30
    dark: colors.jungleCard, // Dark border
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
    emerald: colors.emerald500, // Emerald-500
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
    emeraldSolid: colors.emerald500, // Solid emerald for group
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
      text: colors.emerald500, // Emerald-500
      bg: colors.emerald500, // Emerald-500
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
    primary: [colors.blue500, colors.teal600, colors.emerald500] as const,
    accent: [colors.emerald300, colors.teal500] as const,
    card: [colors.gunmetalGreenDark, colors.darkMossAlpha50] as const,
    button: [colors.deepAquamarine, colors.charcoalGreen] as const,
    progress: [colors.indigo500, colors.teal600, colors.emerald500] as const,
    workoutsTitle: [colors.violet300, colors.blue500, colors.emerald300] as const,
    notification: [colors.pineShadow, colors.darkMint] as const,
    upNextCard: [colors.jungleCard, colors.charcoalGreen, colors.gunmetalGreenDark] as const,
    cta: [colors.indigo600, colors.neonMint] as const, // Indigo to primary green gradient
    userBubble: [colors.green500, colors.jade] as const, // User message bubble gradient
    celebrationGlow: [colors.indigo200, colors.white, colors.emerald200] as const, // Celebration header gradient
    restOverTitle: [colors.green500, colors.indigo400] as const, // Rest over title gradient
    workoutStats: [colors.indigo400, colors.green500, colors.emerald300] as const, // Workout stats gradient
    workoutSessionOverlay: [
      addOpacityToHex(colors.deepJungle, 0.95),
      addOpacityToHex(colors.deepJungle, 0.85),
      addOpacityToHex(colors.deepJungle, 0.7),
    ] as const,
    indigoPurple: [colors.indigo600, colors.violet800] as const, // Indigo to purple gradient
    emeraldTeal: [colors.emerald500, colors.teal600] as const, // Emerald to teal gradient
    pinkRose: [colors.pink500, colors.rose600] as const, // Pink to rose gradient
    blueEmerald: [colors.blue600, colors.emerald500] as const, // Blue to emerald gradient
    overlayDark: ['transparent', colors.deepTealAlpha90, colors.darkSlateGreen] as const, // Dark overlay gradient
    cameraOverlay: [colors.blackAlpha60, 'transparent', colors.blackAlpha90] as const, // Camera overlay gradient
    onboardingAmbient: [
      colors.indigoLightAlpha20Alt, // indigo-600/20
      colors.neonMintAlpha20, // primary/20
      colors.emeraldAlpha20, // emerald-400/20
    ] as const,
    landingBackground: [colors.darkMoss, colors.deepJungle, colors.darkPine] as const, // Landing page background gradient
    whiteSubtle: [colors.whiteAlpha10, colors.surfaceHighlight05] as const, // Subtle white gradient
    backdrop90: colors.darkJungleAlpha90, // Background with 90% opacity
  },
};

// Light theme colors - inverted from dark theme with light-optimized palette
const lightThemeColors = {
  // Background colors
  background: {
    primary: lightBaseColors.white, // Main app background
    secondary: lightBaseColors.gray50, // Secondary backgrounds (nav bar, cards)
    tertiary: lightBaseColors.gray100, // Lighter backgrounds (food page)
    card: lightBaseColors.white, // Card backgrounds
    cardElevated: lightBaseColors.gray50, // Elevated card backgrounds
    secondaryDark: lightBaseColors.gray100, // Card backgrounds (active states)
    overlay: lightBaseColors.gray100, // Overlay backgrounds
    filterTab: lightBaseColors.gray150, // Filter tab background
    iconDark: lightBaseColors.emerald50, // Light icon backgrounds
    iconDarker: lightBaseColors.emerald100, // Lighter icon backgrounds
    iconDarkest: lightBaseColors.emerald200, // Lightest icon backgrounds
    workoutIcon: lightBaseColors.green600, // Workout action button icon background
    imageLight: lightBaseColors.gray200, // Light image background
    imageMedium: lightBaseColors.gray300, // Medium image background
    notificationCard: lightBaseColors.gray100, // Notification card gradient start
    gray700: lightBaseColors.gray700, // Gray-700
    gray800: lightBaseColors.gray800, // Gray-800
    gray800Opacity50: addOpacityToHex(lightBaseColors.gray800, 0.5), // Gray-800/50
    white: lightBaseColors.white, // White background
    overlayDark: addOpacityToHex(lightBaseColors.gray900, 0.6), // Dark overlay with 60% opacity
    purpleBlob: lightBaseColors.purple50, // Purple blob background
    greenBlob: lightBaseColors.green100, // Green blob background
    darkGreen50: addOpacityToHex(lightBaseColors.emerald600, 0.5), // Dark green with 50% opacity
    darkGreen80: addOpacityToHex(lightBaseColors.emerald600, 0.8), // Dark green with 80% opacity
    black10: addOpacityToHex(lightBaseColors.gray900, 0.1), // Black with 10% opacity
    black15: addOpacityToHex(lightBaseColors.gray900, 0.15), // Black with 15% opacity
    black20: addOpacityToHex(lightBaseColors.gray900, 0.2), // Black with 20% opacity
    black30: addOpacityToHex(lightBaseColors.gray900, 0.3), // Black with 30% opacity
    black40: addOpacityToHex(lightBaseColors.gray900, 0.4), // Black with 40% opacity
    black80: addOpacityToHex(lightBaseColors.gray900, 0.8), // Black with 80% opacity
    black90: addOpacityToHex(lightBaseColors.gray900, 0.9), // Black with 90% opacity
    aiCardBackground: lightBaseColors.emerald50, // Light green for AI card background
    darkGreenVariant: lightBaseColors.emerald100, // Light green variant for tags/badges
    darkGreenOverlay: addOpacityToHex(lightBaseColors.gray100, 0.9), // Light overlay
    darkGreenSolid: lightBaseColors.gray200, // Light solid color
    darkGray: addOpacityToHex(lightBaseColors.gray900, 0.4), // Gray background with opacity
    darkGray50: addOpacityToHex(lightBaseColors.gray900, 0.5), // Gray with 50% opacity
    darkGray90: addOpacityToHex(lightBaseColors.gray900, 0.9), // Gray with 90% opacity
    darkGraySolid: addOpacityToHex(lightBaseColors.gray200, 0.5), // Gray solid with opacity
    darkGreenSolidAlt: lightBaseColors.gray250, // Alternative light solid
    exerciseCardBackground: lightBaseColors.emerald50, // Exercise card background
    darkBackground: lightBaseColors.gray100, // Light background color (landing page, etc.)
    snackbarSuccess: lightBaseColors.green50, // Success snackbar background
    snackbarError: lightBaseColors.red50, // Error snackbar background
    buttonCard: lightBaseColors.emerald50, // Button/card background
    buttonCardActive: lightBaseColors.emerald100, // Active button/card background
    separatorLight: lightBaseColors.gray200, // Light separator
    // White background with opacity
    white2: addOpacityToHex(lightBaseColors.white, 0.02), // White with ~2% opacity
    white3: addOpacityToHex(lightBaseColors.white, 0.03), // White with ~3% opacity
    white5: addOpacityToHex(lightBaseColors.white, 0.05), // White with 5% opacity
    white10: addOpacityToHex(lightBaseColors.white, 0.1), // White with 10% opacity
    white12: addOpacityToHex(lightBaseColors.white, 0.125), // White with ~12.5% opacity
    white20: addOpacityToHex(lightBaseColors.white, 0.2), // White with 20% opacity
    white30: addOpacityToHex(lightBaseColors.white, 0.3), // White with 30% opacity
    // Background primary with opacity
    primary20: addOpacityToHex(lightBaseColors.white, 0.2), // Background primary with 20% opacity
  },

  // Text colors
  text: {
    primary: lightBaseColors.gray900, // Primary text (dark gray)
    secondary: lightBaseColors.gray600, // Secondary text (medium gray)
    tertiary: lightBaseColors.gray500, // Tertiary text (lighter gray)
    muted: lightBaseColors.gray500, // Muted text
    accent: lightBaseColors.green600, // Accent text (green)
    accentLight: lightBaseColors.emerald500, // Light accent text (emerald)
    black: lightBaseColors.gray900, // Black text
    gray300: lightBaseColors.gray300, // Gray-300
    gray500: lightBaseColors.gray500, // Gray-500
    white: lightBaseColors.white, // White
    // Text colors with opacity
    primary12: addOpacityToHex(lightBaseColors.gray900, 0.125), // Primary with 12.5% opacity
    primary20: addOpacityToHex(lightBaseColors.gray900, 0.2), // Primary with 20% opacity
    primary30: addOpacityToHex(lightBaseColors.gray900, 0.3), // Primary with 30% opacity
  },

  // Accent colors
  accent: {
    primary: lightBaseColors.green600, // Primary green
    secondary: lightBaseColors.emerald500, // Secondary green (emerald)
    tertiary: lightBaseColors.teal500, // Tertiary green (teal)
    gradient: {
      start: lightBaseColors.emerald500,
      end: lightBaseColors.teal500,
    },
    // Accent colors with opacity
    primary10: addOpacityToHex(lightBaseColors.green600, 0.1), // Primary with 10% opacity
    primary30: addOpacityToHex(lightBaseColors.green600, 0.3), // Primary with 30% opacity
    primary20: addOpacityToHex(lightBaseColors.green600, 0.2), // Primary with 20% opacity
    primary40: addOpacityToHex(lightBaseColors.green600, 0.4), // Primary with 40% opacity
    primary50: addOpacityToHex(lightBaseColors.green600, 0.5), // Primary with 50% opacity
    primary5: addOpacityToHex(lightBaseColors.green600, 0.05), // Primary with 5% opacity
    secondary10: addOpacityToHex(lightBaseColors.emerald500, 0.1), // Secondary with 10% opacity
    secondary20: addOpacityToHex(lightBaseColors.emerald500, 0.2), // Secondary with 20% opacity
    secondary31: addOpacityToHex(lightBaseColors.emerald500, 0.31), // Secondary with 31% opacity
  },

  // Border colors
  border: {
    default: addOpacityToHex(lightBaseColors.gray300, 0.5), // Light border
    light: addOpacityToHex(lightBaseColors.gray200, 0.8), // Lighter border
    dark: lightBaseColors.gray300, // Darker border
    accent: lightBaseColors.emerald300, // Accent border
    dashed: lightBaseColors.gray300, // Dashed border
    emerald: addOpacityToHex(lightBaseColors.emerald500, 0.3), // emerald/30
    blue: addOpacityToHex(lightBaseColors.blue500, 0.4), // blue-500/40
    gray600: addOpacityToHex(lightBaseColors.gray400, 0.4), // gray-400/40
  },

  // Status colors
  status: {
    success: lightBaseColors.green600,
    warning: lightBaseColors.orange500,
    error: lightBaseColors.red500,
    info: lightBaseColors.blue500,
    purple: lightBaseColors.purple500,
    notificationBadge: lightBaseColors.red500,
    amber: lightBaseColors.amber400,
    yellow: lightBaseColors.yellow500,
    indigo: lightBaseColors.indigo500,
    indigoLight: lightBaseColors.indigo400,
    emerald: lightBaseColors.emerald500,
    emeraldLight: lightBaseColors.emerald400,
    greenDark: lightBaseColors.green600,
    indigoVeryLight: lightBaseColors.indigo200,
    emeraldVeryLight: lightBaseColors.emerald200,
    // Status colors with opacity
    success20: addOpacityToHex(lightBaseColors.green600, 0.2),
    error8: addOpacityToHex(lightBaseColors.red500, 0.08),
    error10: addOpacityToHex(lightBaseColors.red500, 0.1),
    error12: addOpacityToHex(lightBaseColors.red500, 0.125),
    error20: addOpacityToHex(lightBaseColors.red500, 0.2),
    error50: addOpacityToHex(lightBaseColors.red500, 0.5),
    info20: addOpacityToHex(lightBaseColors.blue500, 0.2),
    info10: addOpacityToHex(lightBaseColors.blue500, 0.1),
    info50: addOpacityToHex(lightBaseColors.blue500, 0.5),
    warning50: addOpacityToHex(lightBaseColors.orange500, 0.5),
    purple40: addOpacityToHex(lightBaseColors.purple500, 0.4),
    purple20: addOpacityToHex(lightBaseColors.purple500, 0.2),
    purple13: addOpacityToHex(lightBaseColors.purple500, 0.13),
    purple10: addOpacityToHex(lightBaseColors.purple500, 0.1),
    amber10: addOpacityToHex(lightBaseColors.amber400, 0.1),
    warning10: addOpacityToHex(lightBaseColors.orange500, 0.1),
    emerald10: addOpacityToHex(lightBaseColors.emerald500, 0.1),
    emerald20: addOpacityToHex(lightBaseColors.emerald500, 0.2),
    emerald30: addOpacityToHex(lightBaseColors.emerald500, 0.3),
    emerald400_10: addOpacityToHex(lightBaseColors.emerald400, 0.1),
    emerald400_20: addOpacityToHex(lightBaseColors.emerald400, 0.2),
    yellow10: addOpacityToHex(lightBaseColors.yellow500, 0.1),
    indigo10: addOpacityToHex(lightBaseColors.indigo500, 0.1),
    indigo20: addOpacityToHex(lightBaseColors.indigo500, 0.2),
    indigo30: addOpacityToHex(lightBaseColors.indigo600, 0.3),
    indigo600: lightBaseColors.indigo600,
    redDark: lightBaseColors.red400,
    emeraldDark: lightBaseColors.emerald600,
    indigo600Purple: lightBaseColors.violet500,
    blue600: lightBaseColors.blue600,
    pink500: lightBaseColors.pink500,
    rose600: lightBaseColors.rose600,
    customGreen: lightBaseColors.emerald400,
    emeraldTeal: lightBaseColors.teal500,
    gray10: addOpacityToHex(lightBaseColors.gray500, 0.1),
    errorSolid: lightBaseColors.red500,
    emeraldSolid: lightBaseColors.emerald500,
    red400: lightBaseColors.red400,
    teal400: lightBaseColors.teal400,
    purple400: lightBaseColors.purple400,
    violet500: lightBaseColors.violet500,
  },

  // Rose colors
  rose: {
    brand: lightBaseColors.rose500,
    dark: lightBaseColors.rose600,
    brand10: addOpacityToHex(lightBaseColors.rose500, 0.1),
    brand20: addOpacityToHex(lightBaseColors.rose600, 0.2),
  },

  // Macro colors
  macros: {
    protein: {
      text: lightBaseColors.indigo500,
      bg: lightBaseColors.indigo500,
    },
    carbs: {
      text: lightBaseColors.emerald500,
      bg: lightBaseColors.emerald500,
    },
    fat: {
      text: lightBaseColors.amber500,
      bg: lightBaseColors.amber500,
    },
    fiber: {
      text: lightBaseColors.pink500,
      bg: lightBaseColors.pink500,
    },
  },

  // Avatar colors
  avatar: {
    emerald: lightBaseColors.green600,
    blue: lightBaseColors.blue500,
    purple: lightBaseColors.violet500,
    pink: lightBaseColors.pink500,
    orange: lightBaseColors.orange500,
    teal: lightBaseColors.teal500,
    yellow: lightBaseColors.yellow500,
    indigo: lightBaseColors.indigo500,
  },

  // Avatar background colors (with opacity)
  avatarBg: {
    emerald: addOpacityToHex(lightBaseColors.green600, 0.2),
    blue: addOpacityToHex(lightBaseColors.blue500, 0.2),
    purple: addOpacityToHex(lightBaseColors.violet500, 0.2),
    pink: addOpacityToHex(lightBaseColors.pink500, 0.2),
    orange: addOpacityToHex(lightBaseColors.orange500, 0.2),
    teal: addOpacityToHex(lightBaseColors.teal500, 0.2),
    yellow: addOpacityToHex(lightBaseColors.yellow500, 0.2),
    indigo: addOpacityToHex(lightBaseColors.indigo500, 0.2),
  },

  // Google brand colors
  google: {
    borderLight: lightBaseColors.gray300,
    borderDark: lightBaseColors.gray400,
    backgroundDark: lightBaseColors.white,
    textLight: lightBaseColors.gray900,
    textDark: lightBaseColors.gray700,
    overlayDark: lightBaseColors.gray100,
    overlayLight: lightBaseColors.gray50,
    disabledBorderLight: addOpacityToHex(lightBaseColors.gray300, 0.12),
    disabledBorderDark: addOpacityToHex(lightBaseColors.gray400, 0.12),
    disabledBgLight: addOpacityToHex(lightBaseColors.gray900, 0.38),
    disabledBgDark: addOpacityToHex(lightBaseColors.gray100, 0.38),
  },

  // Overlay and opacity colors
  overlay: {
    black60: addOpacityToHex(lightBaseColors.gray900, 0.6),
    black90: addOpacityToHex(lightBaseColors.gray900, 0.9),
    white50: addOpacityToHex(lightBaseColors.white, 0.5),
    white60: addOpacityToHex(lightBaseColors.white, 0.6),
    white70: addOpacityToHex(lightBaseColors.white, 0.7),
    white90: addOpacityToHex(lightBaseColors.white, 0.9),
    white80: addOpacityToHex(lightBaseColors.white, 0.8),
    white30: addOpacityToHex(lightBaseColors.white, 0.3),
    white20: addOpacityToHex(lightBaseColors.white, 0.2),
    white5: addOpacityToHex(lightBaseColors.white, 0.05),
    black60Opacity: addOpacityToHex(lightBaseColors.gray900, 0.6),
    backdrop: addOpacityToHex(lightBaseColors.white, 0.8),
    backdrop90: addOpacityToHex(lightBaseColors.white, 0.9),
    darkGreenOverlayGradient: addOpacityToHex(lightBaseColors.gray100, 0.9),
  },

  // Opacity values (for use in style objects)
  opacity: {
    zero: 0,
    veryLight: 0.1,
    subtle: 0.2,
    medium: 0.5,
    strong: 0.7,
    ultra: 0.9,
    full: 1.0,
  },

  // Gradient colors
  gradients: {
    primary: [
      lightBaseColors.blue500,
      lightBaseColors.teal500,
      lightBaseColors.emerald500,
    ] as const,
    accent: [lightBaseColors.emerald500, lightBaseColors.teal500] as const,
    card: [lightBaseColors.gray50, lightBaseColors.white] as const,
    button: [lightBaseColors.emerald50, lightBaseColors.emerald100] as const,
    progress: [
      lightBaseColors.indigo500,
      lightBaseColors.teal500,
      lightBaseColors.emerald500,
    ] as const,
    workoutsTitle: [
      lightBaseColors.violet400,
      lightBaseColors.blue500,
      lightBaseColors.emerald400,
    ] as const,
    notification: [lightBaseColors.gray100, lightBaseColors.gray50] as const,
    upNextCard: [lightBaseColors.gray100, lightBaseColors.gray50, lightBaseColors.white] as const,
    cta: [lightBaseColors.indigo600, lightBaseColors.emerald500] as const,
    userBubble: [lightBaseColors.green600, lightBaseColors.emerald600] as const,
    celebrationGlow: [
      lightBaseColors.indigo200,
      lightBaseColors.white,
      lightBaseColors.emerald200,
    ] as const,
    restOverTitle: [lightBaseColors.green600, lightBaseColors.indigo400] as const,
    workoutStats: [
      lightBaseColors.indigo400,
      lightBaseColors.green600,
      lightBaseColors.emerald400,
    ] as const,
    workoutSessionOverlay: [
      addOpacityToHex(lightBaseColors.white, 0.95),
      addOpacityToHex(lightBaseColors.white, 0.85),
      addOpacityToHex(lightBaseColors.white, 0.7),
    ] as const,
    indigoPurple: [lightBaseColors.indigo600, lightBaseColors.violet500] as const,
    emeraldTeal: [lightBaseColors.emerald500, lightBaseColors.teal500] as const,
    pinkRose: [lightBaseColors.pink500, lightBaseColors.rose600] as const,
    blueEmerald: [lightBaseColors.blue600, lightBaseColors.emerald500] as const,
    overlayDark: [
      'transparent',
      addOpacityToHex(lightBaseColors.gray100, 0.9),
      lightBaseColors.gray200,
    ] as const,
    cameraOverlay: [
      addOpacityToHex(lightBaseColors.gray900, 0.6),
      'transparent',
      addOpacityToHex(lightBaseColors.gray900, 0.9),
    ] as const,
    onboardingAmbient: [
      addOpacityToHex(lightBaseColors.indigo500, 0.2),
      addOpacityToHex(lightBaseColors.emerald500, 0.2),
      addOpacityToHex(lightBaseColors.emerald400, 0.2),
    ] as const,
    landingBackground: [
      lightBaseColors.gray50,
      lightBaseColors.white,
      lightBaseColors.gray100,
    ] as const,
    whiteSubtle: [
      addOpacityToHex(lightBaseColors.gray900, 0.1),
      addOpacityToHex(lightBaseColors.gray900, 0.05),
    ] as const,
    backdrop90: addOpacityToHex(lightBaseColors.white, 0.9),
  },
};

export const darkTheme = {
  colors: darkThemeColors,
  typography: {
    // Font sizes
    fontSize: {
      xxs: 10, // Extra extra small font size (for badges, etc.)
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
      '7xl': 80,
    },

    // Font weights
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
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
      '4xl': 120, // Large margin for footer spacing
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

  shadows: {
    sm: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    accent: {
      shadowColor: darkThemeColors.accent.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    // Additional shadow variants
    none: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Specific shadow radius values
    radius3: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    radius4: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    radius8: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    radius15: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    radius20: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    radius40: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 40,
      elevation: 20,
    },
    // Custom shadow for sliders
    slider: {
      shadowColor: darkThemeColors.text.black,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    accentGlow: {
      shadowColor: darkThemeColors.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    error: {
      shadowColor: darkThemeColors.status.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    purpleGlow: {
      shadowColor: darkThemeColors.status.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 200,
      elevation: 0,
    },
    accentGlowLarge: {
      shadowColor: darkThemeColors.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 5,
    },
    roseGlow: {
      shadowColor: darkThemeColors.rose.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
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
} as const;

export const lightTheme = {
  ...darkTheme,
  colors: lightThemeColors,
} as const;

// Default export is dark theme for backward compatibility
export const theme = darkTheme;

// Type exports for TypeScript
export type Theme = typeof darkTheme;
export type ThemeColors = typeof darkTheme.colors;
export type ThemeTypography = typeof darkTheme.typography;

/**
 * Utility functions for accessing theme values
 */

/**
 * Get a color value from the theme
 * @example getColor('background.primary') => colors.deepJungle
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let value: any = theme.colors;
  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      console.warn(`Theme color path "${path}" not found`);
      return colors.black;
    }
  }
  return value as string;
}

/**
 * Get a spacing value from the theme
 */
export function getSpacing(size: keyof typeof theme.spacing.padding): number {
  return theme.spacing.padding[size];
}

/**
 * Get a font size from the theme
 */
export function getFontSize(size: keyof typeof theme.typography.fontSize): number {
  return theme.typography.fontSize[size];
}

/**
 * Get a border radius from the theme
 */
export function getBorderRadius(size: keyof typeof theme.borderRadius): number {
  return theme.borderRadius[size];
}

/**
 * Add opacity to a hex color
 * @param hexColor - Hex color string (e.g., colors.green500)
 * @param opacity - Opacity value between 0 and 1 (e.g., 0.125 for 12.5%)
 * @returns RGBA color string
 */
export function addOpacityToHex(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Usage Examples:
 *
 * 1. Using with NativeWind classes:
 *    <View className="bg-bg-primary text-text-primary">
 *
 * 2. Using with inline styles:
 *    <View style={{ backgroundColor: theme.colors.background.primary }}>
 *
 * 3. Using utility functions:
 *    <View style={{ backgroundColor: getColor('background.primary') }}>
 *
 * 4. Using Tailwind classes (recommended for NativeWind):
 *    <View className="bg-bg-primary p-base rounded-2xl">
 *    <Text className="text-text-primary text-lg font-semibold">
 */
