/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */

const colors = {
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
  // TODO: use these in the theme variable
  surfaceBlackFade: 'rgba(19, 19, 20, 0.38)',
  gray900Fade: 'rgba(31, 31, 31, 0.12)',
  zinc400Fade: 'rgba(142, 145, 143, 0.12)',
  whiteFade: 'rgba(255, 255, 255, 0.38)',
  blackAlpha10: 'rgba(0, 0, 0, 0.1)',
  blackAlpha15: 'rgba(0, 0, 0, 0.15)',
  blackAlpha20: 'rgba(0, 0, 0, 0.2)',
  blackAlpha30: 'rgba(0, 0, 0, 0.3)',
  blackAlpha40: 'rgba(0, 0, 0, 0.4)',
  blackAlpha60: 'rgba(0, 0, 0, 0.6)',
  blackAlpha80: 'rgba(0, 0, 0, 0.8)',
  blackAlpha90: 'rgba(0, 0, 0, 0.9)',
  overlayDarker: 'rgba(0, 0, 0, 0.9)',
  darkJungleAlpha20: 'rgba(10, 31, 26, 0.2)',
  darkJungleAlpha80: 'rgba(10, 31, 26, 0.8)',
  darkJungleAlpha90: 'rgba(10, 31, 26, 0.9)',
  gray500Alpha10: 'rgba(107, 114, 128, 0.1)',
  violetAlpha20: 'rgba(139, 92, 246, 0.2)',
  emeraldAlpha10: 'rgba(16, 185, 129, 0.1)',
  emeraldAlpha20: 'rgba(16, 185, 129, 0.2)',
  emeraldAlpha30: 'rgba(16, 185, 129, 0.3)',
  purpleAlpha10: 'rgba(168, 85, 247, 0.1)',
  purpleAlpha13: 'rgba(168, 85, 247, 0.13)',
  purpleAlpha20: 'rgba(168, 85, 247, 0.2)',
  purpleAlpha40: 'rgba(168, 85, 247, 0.4)',
  darkMossAlpha50: 'rgba(17, 20, 19, 0.5)',
  roseAlpha20: 'rgba(190, 18, 60, 0.2)',
  tealAlpha20: 'rgba(20, 184, 166, 0.2)',
  pinkRedAlpha10: 'rgba(218, 37, 82, 0.1)',
  yellowAlpha10: 'rgba(234, 179, 8, 0.1)',
  yellowAlpha20: 'rgba(234, 179, 8, 0.2)',
  pinkAlpha20: 'rgba(236, 72, 153, 0.2)',
  redAlpha08: 'rgba(239, 68, 68, 0.08)',
  redAlpha10: 'rgba(239, 68, 68, 0.1)',
  redAlpha12: 'rgba(239, 68, 68, 0.125)',
  redAlpha20: 'rgba(239, 68, 68, 0.2)',
  redAlpha50: 'rgba(239, 68, 68, 0.5)',
  orangeAlpha10: 'rgba(249, 115, 22, 0.1)',
  orangeAlpha20: 'rgba(249, 115, 22, 0.2)',
  orangeAlpha50: 'rgba(249, 115, 22, 0.5)',
  darkGreenAlpha50: 'rgba(25, 43, 35, 0.5)',
  amberAlpha10: 'rgba(251, 191, 36, 0.1)',
  whiteAlpha03: 'rgba(255, 255, 255, 0.03)',
  whiteAlpha05: 'rgba(255, 255, 255, 0.05)',
  surfaceHighlight05: 'rgba(255, 255, 255, 0.05)',
  whiteAlpha10: 'rgba(255, 255, 255, 0.1)',
  whiteAlpha12: 'rgba(255, 255, 255, 0.125)',
  surfaceHighlight12: 'rgba(255, 255, 255, 0.125)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.2)',
  surfaceHighlight20: 'rgba(255, 255, 255, 0.2)',
  borderWhite20: 'rgba(255, 255, 255, 0.2)',
  whiteAlpha30: 'rgba(255, 255, 255, 0.3)',
  surfaceHighlight30: 'rgba(255, 255, 255, 0.3)',
  borderWhite30: 'rgba(255, 255, 255, 0.3)',
  whiteAlpha50: 'rgba(255, 255, 255, 0.5)',
  whiteAlpha60: 'rgba(255, 255, 255, 0.6)',
  whiteAlpha70: 'rgba(255, 255, 255, 0.7)',
  whiteAlpha80: 'rgba(255, 255, 255, 0.8)',
  whiteAlpha90: 'rgba(255, 255, 255, 0.9)',
  deepTealAlpha90: 'rgba(26, 46, 42, 0.9)',
  darkPineAlpha80: 'rgba(27, 50, 39, 0.8)',
  blackGrayAlpha40: 'rgba(30, 35, 33, 0.4)',
  blackGrayAlpha50: 'rgba(30, 35, 33, 0.5)',
  blackGrayAlpha90: 'rgba(30, 35, 33, 0.9)',
  gray800Alpha50: 'rgba(31, 41, 55, 0.5)',
  greenAlpha05: 'rgba(34, 197, 94, 0.05)',
  greenAlpha10: 'rgba(34, 197, 94, 0.1)',
  greenAlpha20: 'rgba(34, 197, 94, 0.2)',
  successHighlight20: 'rgba(34, 197, 94, 0.2)',
  successBg20: 'rgba(34, 197, 94, 0.2)',
  greenAlpha30: 'rgba(34, 197, 94, 0.3)',
  greenAlpha40: 'rgba(34, 197, 94, 0.4)',
  greenAlpha50: 'rgba(34, 197, 94, 0.5)',
  neonMintAlpha10: 'rgba(41, 224, 142, 0.1)',
  neonMintAlpha20: 'rgba(41, 224, 142, 0.2)',
  darkTaupeSolid: 'rgba(42, 50, 46, 1)',
  emerald300Alpha10: 'rgba(52, 211, 153, 0.1)',
  emerald300Alpha20: 'rgba(52, 211, 153, 0.2)',
  emerald300Alpha31: 'rgba(52, 211, 153, 0.31)',
  gray700Alpha30: 'rgba(55, 65, 81, 0.3)',
  blueAlpha10: 'rgba(59, 130, 246, 0.1)',
  blueAlpha20: 'rgba(59, 130, 246, 0.2)',
  infoBg20: 'rgba(59, 130, 246, 0.2)',
  blueAlpha40: 'rgba(59, 130, 246, 0.4)',
  blueAlpha50: 'rgba(59, 130, 246, 0.5)',
  emerald900Alpha30: 'rgba(6, 78, 59, 0.3)',
  gray600Alpha40: 'rgba(75, 85, 99, 0.4)',
  gray600Alpha50: 'rgba(75, 85, 99, 0.5)',
  indigoAlpha30: 'rgba(79, 70, 229, 0.3)',
  indigoLightAlpha10: 'rgba(99, 102, 241, 0.1)',
  indigoLightAlpha20: 'rgba(99, 102, 241, 0.2)',
  indigoLightAlpha20Alt: 'rgba(99, 102, 241, 0.2)',
};

const themeColors = {
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
    darkGray: 'rgba(30, 35, 33, 0.4)', // Dark gray background with opacity
    darkGray50: 'rgba(30, 35, 33, 0.5)', // Dark gray with 50% opacity
    darkGray90: 'rgba(30, 35, 33, 0.9)', // Dark gray with 90% opacity
    darkGraySolid: 'rgba(17, 20, 19, 0.5)', // Dark gray solid with opacity
    darkGreenSolidAlt: 'rgba(42, 50, 46, 1)', // Alternative dark green solid
    exerciseCardBackground: colors.hunterGreen, // Exercise card background
    darkBackground: colors.darkMoss, // Dark background color (landing page, etc.)
    snackbarSuccess: colors.darkForest, // Success snackbar background
    snackbarError: colors.darkRedBg, // Error snackbar background
    buttonCard: colors.deepAquamarine, // Button/card background
    buttonCardActive: colors.darkTealBg, // Active button/card background
    separatorLight: colors.gray200Tailwind, // Light separator (gray-200)
    // White background with opacity
    white3: 'rgba(255, 255, 255, 0.03)', // White with ~3% opacity
    white5: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
    white10: 'rgba(255, 255, 255, 0.1)', // White with 10% opacity
    white12: 'rgba(255, 255, 255, 0.125)', // White with ~12.5% opacity
    white20: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
    white30: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
    // Background primary with opacity
    primary20: 'rgba(10, 31, 26, 0.2)', // Background primary with 20% opacity
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
    primary12: 'rgba(255, 255, 255, 0.125)', // Primary with 12.5% opacity
    primary20: 'rgba(255, 255, 255, 0.2)', // Primary with 20% opacity
    primary30: 'rgba(255, 255, 255, 0.3)', // Primary with 30% opacity
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
    primary10: 'rgba(34, 197, 94, 0.1)', // Primary with 10% opacity
    primary30: 'rgba(34, 197, 94, 0.3)', // Primary with 30% opacity
    primary20: 'rgba(34, 197, 94, 0.2)', // Primary with 20% opacity
    primary40: 'rgba(34, 197, 94, 0.4)', // Primary with 40% opacity
    primary50: 'rgba(34, 197, 94, 0.5)', // Primary with 50% opacity
    primary5: 'rgba(34, 197, 94, 0.05)', // Primary with 5% opacity
    secondary10: 'rgba(52, 211, 153, 0.1)', // Secondary with 10% opacity
    secondary20: 'rgba(52, 211, 153, 0.2)', // Secondary with 20% opacity
    secondary31: 'rgba(52, 211, 153, 0.31)', // Secondary with 31% opacity
  },

  // Border colors
  border: {
    default: 'rgba(75, 85, 99, 0.5)', // gray-800/50
    light: 'rgba(55, 65, 81, 0.3)', // gray-700/30
    dark: colors.jungleCard, // Dark border
    accent: colors.darkViridian, // Accent border
    dashed: colors.gray700, // Dashed border (gray-700)
    emerald: 'rgba(6, 78, 59, 0.3)', // emerald-900/30
    blue: 'rgba(59, 130, 246, 0.4)', // blue-500/40
    gray600: 'rgba(75, 85, 99, 0.4)', // gray-600/40
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
    success20: 'rgba(34, 197, 94, 0.2)', // Success with 20% opacity
    error8: 'rgba(239, 68, 68, 0.08)', // Error with 8% opacity
    error10: 'rgba(239, 68, 68, 0.1)', // Error with 10% opacity
    error12: 'rgba(239, 68, 68, 0.125)', // Error with 12.5% opacity
    error20: 'rgba(239, 68, 68, 0.2)', // Error with 20% opacity
    error50: 'rgba(239, 68, 68, 0.5)', // Error with 50% opacity
    info20: 'rgba(59, 130, 246, 0.2)', // Info with 20% opacity
    info10: 'rgba(59, 130, 246, 0.1)', // Info with 10% opacity
    info50: 'rgba(59, 130, 246, 0.5)', // Info with 50% opacity
    warning50: 'rgba(249, 115, 22, 0.5)', // Warning with 50% opacity
    purple40: 'rgba(168, 85, 247, 0.4)', // Purple with 40% opacity
    purple20: 'rgba(168, 85, 247, 0.2)', // Purple with 20% opacity
    purple13: 'rgba(168, 85, 247, 0.13)', // Purple with 13% opacity (hex '22')
    purple10: 'rgba(168, 85, 247, 0.1)', // Purple with 10% opacity
    amber10: 'rgba(251, 191, 36, 0.1)', // Amber with 10% opacity
    warning10: 'rgba(249, 115, 22, 0.1)', // Warning with 10% opacity
    emerald10: 'rgba(16, 185, 129, 0.1)', // Emerald with 10% opacity
    emerald20: 'rgba(16, 185, 129, 0.2)', // Emerald with 20% opacity
    emerald30: 'rgba(16, 185, 129, 0.3)', // Emerald with 30% opacity
    emerald400_10: 'rgba(41, 224, 142, 0.1)', // Emerald-400 with 10% opacity
    emerald400_20: 'rgba(41, 224, 142, 0.2)', // Emerald-400 with 20% opacity
    yellow10: 'rgba(234, 179, 8, 0.1)', // Yellow with 10% opacity
    indigo10: 'rgba(99, 102, 241, 0.1)', // Indigo with 10% opacity
    indigo20: 'rgba(99, 102, 241, 0.2)', // Indigo with 20% opacity
    indigo30: 'rgba(79, 70, 229, 0.3)', // Indigo-600 with 30% opacity
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
    gray10: 'rgba(107, 114, 128, 0.1)', // Gray with 10% opacity
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
    brand10: 'rgba(218, 37, 82, 0.1)', // Rose-brand with 10% opacity
    brand20: 'rgba(190, 18, 60, 0.2)', // Rose-brand with 20% opacity
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
    emerald: 'rgba(34, 197, 94, 0.2)', // emerald/20
    blue: 'rgba(59, 130, 246, 0.2)', // blue-500/20
    purple: 'rgba(139, 92, 246, 0.2)', // violet-500/20
    pink: 'rgba(236, 72, 153, 0.2)', // pink-500/20
    orange: 'rgba(249, 115, 22, 0.2)', // orange-500/20
    teal: 'rgba(20, 184, 166, 0.2)', // teal-500/20
    yellow: 'rgba(234, 179, 8, 0.2)', // yellow-500/20
    indigo: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
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
    black90: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
    white50: 'rgba(255, 255, 255, 0.5)', // White with 50% opacity
    white60: 'rgba(255, 255, 255, 0.6)', // White with 60% opacity
    white70: 'rgba(255, 255, 255, 0.7)', // White with 70% opacity
    white90: 'rgba(255, 255, 255, 0.9)', // White with 90% opacity
    white80: 'rgba(255, 255, 255, 0.8)', // White with 80% opacity
    white30: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
    white20: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
    white5: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
    black60Opacity: colors.blackAlpha60, // Black with 60% opacity (for gradients)
    backdrop: 'rgba(10, 31, 26, 0.8)', // Background primary with 80% opacity (for modals)
    backdrop90: 'rgba(10, 31, 26, 0.9)', // Background primary with 90% opacity
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
    primary: ['#5b7cf5', '#4a9d8f', '#47d9ba'] as const,
    accent: [colors.emerald300, colors.teal500] as const,
    card: [colors.gunmetalGreenDark, '#0f1812'] as const,
    button: [colors.deepAquamarine, '#0f1f1a'] as const,
    // progress: [colors.indigo500, '#40bdae', '#25956c'] as const,
    progress: [colors.indigo500, '#337e75', '#25956c'] as const,
    workoutsTitle: ['#a78bfa', '#60a5fa', colors.emerald300] as const,
    notification: [colors.pineShadow, colors.darkMint] as const,
    upNextCard: [colors.jungleCard, colors.charcoalGreen, colors.gunmetalGreenDark] as const,
    cta: [colors.indigo600, colors.neonMint] as const, // Indigo to primary green gradient
    userBubble: [colors.green500, colors.jade] as const, // User message bubble gradient
    celebrationGlow: [colors.indigo200, colors.white, colors.emerald200] as const, // Celebration header gradient
    restOverTitle: [colors.green500, colors.indigo400] as const, // Rest over title gradient
    workoutStats: [colors.indigo400, colors.green500, colors.emerald300] as const, // Workout stats gradient
    workoutSessionOverlay: [
      'rgba(10, 31, 26, 0.95)',
      'rgba(10, 31, 26, 0.85)',
      'rgba(10, 31, 26, 0.7)',
    ] as const,
    indigoPurple: [colors.indigo600, colors.violet800] as const, // Indigo to purple gradient
    emeraldTeal: [colors.emerald500, colors.teal600] as const, // Emerald to teal gradient
    pinkRose: [colors.pink500, colors.rose600] as const, // Pink to rose gradient
    blueEmerald: [colors.blue600, colors.emerald500] as const, // Blue to emerald gradient
    overlayDark: ['transparent', colors.deepTealAlpha90, colors.darkSlateGreen] as const, // Dark overlay gradient
    cameraOverlay: ['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.9)'] as const, // Camera overlay gradient
    onboardingAmbient: [
      'rgba(99, 102, 241, 0.2)', // indigo-600/20
      'rgba(41, 224, 142, 0.2)', // primary/20
      'rgba(16, 185, 129, 0.2)', // emerald-400/20
    ] as const,
    landingBackground: [colors.darkMoss, colors.deepJungle, colors.darkPine] as const, // Landing page background gradient
    whiteSubtle: ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] as const, // Subtle white gradient
    backdrop90: 'rgba(10, 31, 26, 0.9)', // Background with 90% opacity
  },
};

export const theme = {
  colors: themeColors,
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

// Type exports for TypeScript
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeTypography = typeof theme.typography;

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
