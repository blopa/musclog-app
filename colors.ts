/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */

const colors = {
  primary: '#0a1f1a', // Main app background
  secondary: '#0f251f', // Secondary backgrounds (nav bar, cards)
  tertiary: '#0a0f0d', // Darker backgrounds (food page)
  card: '#141a17', // Card backgrounds
  cardElevated: '#1a2520', // Elevated card backgrounds
  secondaryDark: '#0f2419', // Dark card backgrounds (active states)
  overlay: '#1a2f2a', // Overlay backgrounds
  filterTab: '#0f2f27', // Filter tab background
  iconDark: '#1a3d35', // Dark icon backgrounds
  iconDarker: '#243d37', // Darker icon backgrounds
  iconDarkest: '#1a2420', // Darkest icon backgrounds
  workoutIcon: '#16a34a', // Workout action button icon background
  imageLight: '#d4b5a0', // Light image background
  imageMedium: '#8b7d6b', // Medium image background
  notificationCard: '#1a3d2f', // Notification card gradient start
  gray700: '#374151', // Gray-700
  gray800: '#1f2937', // Gray-800
  gray800Opacity50: 'rgba(31, 41, 55, 0.5)', // Gray-800/50
  white: '#ffffff', // White background
  overlayDark: 'rgba(0, 0, 0, 0.6)', // Black overlay with 60% opacity
  purpleBlob: '#3d3162', // Purple blob background
  greenBlob: '#125630', // Green blob background
  darkGreen50: 'rgba(25, 43, 35, 0.5)', // Dark green with 50% opacity
  darkGreen80: 'rgba(27, 50, 39, 0.8)', // Dark green with 80% opacity
  black10: 'rgba(0, 0, 0, 0.1)', // Black with 10% opacity
  black15: 'rgba(0, 0, 0, 0.15)', // Black with 15% opacity
  black20: 'rgba(0, 0, 0, 0.2)', // Black with 20% opacity
  black30: 'rgba(0, 0, 0, 0.3)', // Black with 30% opacity
  black40: 'rgba(0, 0, 0, 0.4)', // Black with 40% opacity
  black80: 'rgba(0, 0, 0, 0.8)', // Black with 80% opacity
  black90: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
  aiCardBackground: '#15261f', // Dark green for AI card background
  darkGreenVariant: '#1a3a2a', // Dark green variant for tags/badges
  darkGreenOverlay: 'rgba(26, 46, 42, 0.9)', // Dark green overlay (rgba(26, 46, 42, 0.9))
  darkGreenSolid: '#1a2e2a', // Dark green solid color
  darkGray: 'rgba(30, 35, 33, 0.4)', // Dark gray background with opacity
  darkGray50: 'rgba(30, 35, 33, 0.5)', // Dark gray with 50% opacity
  darkGray90: 'rgba(30, 35, 33, 0.9)', // Dark gray with 90% opacity
  darkGraySolid: 'rgba(17, 20, 19, 0.5)', // Dark gray solid with opacity
  darkGreenSolidAlt: 'rgba(42, 50, 46, 1)', // Alternative dark green solid
  exerciseCardBackground: '#254637', // Exercise card background
  darkBackground: '#11211a', // Dark background color (landing page, etc.)
  snackbarSuccess: '#0d3520', // Success snackbar background
  snackbarError: '#3d1515', // Error snackbar background
  buttonCard: '#1a3530', // Button/card background
  buttonCardActive: '#1f4039', // Active button/card background
  separatorLight: '#e5e7eb', // Light separator (gray-200)
  // White background with opacity
  white3: 'rgba(255, 255, 255, 0.03)', // White with ~3% opacity
  white5: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
  white10: 'rgba(255, 255, 255, 0.1)', // White with 10% opacity
  white12: 'rgba(255, 255, 255, 0.125)', // White with ~12.5% opacity
  white20: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
  white30: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
  // Background primary with opacity
  primary20: 'rgba(10, 31, 26, 0.2)', // Background primary with 20% opacity

  primary: '#ffffff', // Primary text (white)
  secondary: '#9ca3af', // Secondary text (gray-400)
  tertiary: '#4b5563', // Tertiary text (gray-600)
  muted: '#6b7280', // Muted text
  accent: '#22c55e', // Accent text (green)
  accentLight: '#34d399', // Light accent text (emerald)
  black: '#000000', // Black text (for icons on light backgrounds)
  gray300: '#d1d5db', // Gray-300
  gray500: '#6b7280', // Gray-500
  white: '#ffffff', // White
  // Text colors with opacity
  primary12: 'rgba(255, 255, 255, 0.125)', // Primary with 12.5% opacity
  primary20: 'rgba(255, 255, 255, 0.2)', // Primary with 20% opacity
  primary30: 'rgba(255, 255, 255, 0.3)', // Primary with 30% opacity
  primary: '#22c55e', // Primary green
  secondary: '#34d399', // Secondary green (emerald)
  tertiary: '#14b8a6', // Tertiary green (teal)
  start: '#34d399',
  end: '#14b8a6',
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
  default: 'rgba(75, 85, 99, 0.5)', // gray-800/50
  light: 'rgba(55, 65, 81, 0.3)', // gray-700/30
  dark: '#1a2f2a', // Dark border
  accent: '#2a4d3f', // Accent border
  dashed: '#374151', // Dashed border (gray-700)
  emerald: 'rgba(6, 78, 59, 0.3)', // emerald-900/30
  blue: 'rgba(59, 130, 246, 0.4)', // blue-500/40
  gray600: 'rgba(75, 85, 99, 0.4)', // gray-600/40
  success: '#22c55e',
  warning: '#f97316', // Orange
  error: '#ef4444', // Red
  info: '#3b82f6', // Blue
  purple: '#a855f7', // Purple
  notificationBadge: '#ef4444', // Red notification badge (same as error)
  amber: '#fbbf24', // Amber-400
  yellow: '#eab308', // Yellow-500
  indigo: '#6366f1', // Indigo-500
  indigoLight: '#818cf8', // Indigo-400
  emerald: '#10b981', // Emerald-500
  emeraldLight: '#29e08e', // Emerald-400
  greenDark: '#1aa869', // Green-600
  indigoVeryLight: '#c7d2fe', // Indigo-100
  emeraldVeryLight: '#a7f3d0', // Emerald-200
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
  indigo600: '#4f46e5', // Indigo-600
  // Red border colors for ungroup action
  redDark: '#7f1d1d', // Dark red border
  // Emerald border colors for group action
  emeraldDark: '#064e3b', // Dark emerald border
  indigo600Purple: '#5b21b6', // Purple-700 (for indigo gradients)
  blue600: '#2563eb', // Blue-600
  pink500: '#ec4899', // Pink-500 (already in macros but adding for convenience)
  rose600: '#e11d48', // Rose-600
  customGreen: '#95c6b0', // Custom green used in components
  emeraldTeal: '#0d9488', // Teal-600 (for emerald-teal gradient)
  gray10: 'rgba(107, 114, 128, 0.1)', // Gray with 10% opacity
  // Error colors for ungroup action
  errorSolid: '#ef4444', // Solid red for ungroup
  // Success colors for group action
  emeraldSolid: '#10b981', // Solid emerald for group
  // Additional status colors
  red400: '#f87171', // Red-400 (for fat icons, etc.)
  teal400: '#2dd4bf', // Teal-400 (for monounsat fat, etc.)
  purple400: '#a78bfa', // Purple-400 (for fiber icons, etc.)
  violet500: '#8b5cf6', // Violet-500 (for polyunsat fat, etc.)
  brand: '#da2552', // Rose-700 (darker, less bright)
  dark: '#9f1239', // Rose-800 (darker variant)
  // Rose colors with opacity
  brand10: 'rgba(218, 37, 82, 0.1)', // Rose-brand with 10% opacity
  brand20: 'rgba(190, 18, 60, 0.2)', // Rose-brand with 20% opacity
  text: '#ec4899', // Pink-500
  bg: '#ec4899', // Pink-500
  text: '#f59e0b', // Amber-500
  bg: '#f59e0b', // Amber-500
  text: '#10b981', // Emerald-500
  bg: '#10b981', // Emerald-500
  text: '#6366f1', // Indigo-500
  bg: '#6366f1', // Indigo-500
  emerald: '#22c55e', // Primary green
  blue: '#3b82f6', // Blue-500
  purple: '#8b5cf6', // Violet-500
  pink: '#ec4899', // Pink-500
  orange: '#f97316', // Orange-500
  teal: '#14b8a6', // Teal-500
  yellow: '#eab308', // Yellow-500
  indigo: '#6366f1', // Indigo-500
  emerald: 'rgba(34, 197, 94, 0.2)', // emerald/20
  blue: 'rgba(59, 130, 246, 0.2)', // blue-500/20
  purple: 'rgba(139, 92, 246, 0.2)', // violet-500/20
  pink: 'rgba(236, 72, 153, 0.2)', // pink-500/20
  orange: 'rgba(249, 115, 22, 0.2)', // orange-500/20
  teal: 'rgba(20, 184, 166, 0.2)', // teal-500/20
  yellow: 'rgba(234, 179, 8, 0.2)', // yellow-500/20
  indigo: 'rgba(99, 102, 241, 0.2)', // indigo-500/20

  // Google brand colors
  borderLight: '#747775', // Light border for Google button
  borderDark: '#8e918f', // Dark border for Google button
  backgroundDark: '#131314', // Dark background for Google button
  textLight: '#1f1f1f', // Light text for Google button
  textDark: '#e3e3e3', // Dark text for Google button
  overlayDark: '#303030', // Dark overlay for Google button
  overlayLight: '#e3e3e3', // Light overlay for Google button
  disabledBorderLight: '#1f1f1f1f', // Disabled border (light variant)
  disabledBorderDark: '#8e918f1f', // Disabled border (dark variant)
  disabledBgLight: '#ffffff61', // Disabled background (light variant)
  disabledBgDark: '#13131461', // Disabled background (dark variant)

  black60: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity
  black90: 'rgba(0, 0, 0, 0.9)', // Black with 90% opacity
  white50: 'rgba(255, 255, 255, 0.5)', // White with 50% opacity
  white60: 'rgba(255, 255, 255, 0.6)', // White with 60% opacity
  white70: 'rgba(255, 255, 255, 0.7)', // White with 70% opacity
  white90: 'rgba(255, 255, 255, 0.9)', // White with 90% opacity
  white80: 'rgba(255, 255, 255, 0.8)', // White with 80% opacity
  white30: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
  white20: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
  white5: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
  black60Opacity: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity (for gradients)
  backdrop: 'rgba(10, 31, 26, 0.8)', // Background primary with 80% opacity (for modals)
  backdrop90: 'rgba(10, 31, 26, 0.9)', // Background primary with 90% opacity
  darkGreenOverlayGradient: 'rgba(26, 46, 42, 0.9)', // Dark green overlay gradient

};

const gradients = {
  primary: ['#5b7cf5', '#4a9d8f', '#47d9ba'] as const,
    accent: ['#34d399', '#14b8a6'] as const,
    card: ['#1a2520', '#0f1812'] as const,
    button: ['#1a3530', '#0f1f1a'] as const,
    // progress: ['#6366f1', '#40bdae', '#25956c'] as const,
    progress: ['#6366f1', '#337e75', '#25956c'] as const,
    workoutsTitle: ['#a78bfa', '#60a5fa', '#34d399'] as const,
    notification: ['#1a3d2f', '#0f2419'] as const,
    upNextCard: ['#1a2f2a', '#141a17', '#1a2520'] as const,
    cta: ['#4f46e5', '#29e08e'] as const, // Indigo to primary green gradient
    userBubble: ['#22c55e', '#1aa869'] as const, // User message bubble gradient
    celebrationGlow: ['#c7d2fe', '#ffffff', '#a7f3d0'] as const, // Celebration header gradient
    restOverTitle: ['#22c55e', '#818cf8'] as const, // Rest over title gradient
    workoutStats: ['#818cf8', '#22c55e', '#34d399'] as const, // Workout stats gradient
    workoutSessionOverlay: [
    'rgba(10, 31, 26, 0.95)',
    'rgba(10, 31, 26, 0.85)',
    'rgba(10, 31, 26, 0.7)',
  ] as const,
    indigoPurple: ['#4f46e5', '#5b21b6'] as const, // Indigo to purple gradient
    emeraldTeal: ['#10b981', '#0d9488'] as const, // Emerald to teal gradient
    pinkRose: ['#ec4899', '#e11d48'] as const, // Pink to rose gradient
    blueEmerald: ['#2563eb', '#10b981'] as const, // Blue to emerald gradient
    overlayDark: ['transparent', 'rgba(26, 46, 42, 0.9)', '#1a2e2a'] as const, // Dark overlay gradient
    cameraOverlay: ['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.9)'] as const, // Camera overlay gradient
    onboardingAmbient: [
    'rgba(99, 102, 241, 0.2)', // indigo-600/20
    'rgba(41, 224, 142, 0.2)', // primary/20
    'rgba(16, 185, 129, 0.2)', // emerald-400/20
  ] as const,
    landingBackground: ['#11211a', '#0a1f1a', '#0f251f'] as const, // Landing page background gradient
    whiteSubtle: ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] as const, // Subtle white gradient
    backdrop90: 'rgba(10, 31, 26, 0.9)', // Background with 90% opacity
};
