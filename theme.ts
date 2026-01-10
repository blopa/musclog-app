/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */

export const theme = {
  colors: {
    // Background colors
    background: {
      primary: '#0a1f1a', // Main app background
      secondary: '#0f251f', // Secondary backgrounds (nav bar, cards)
      tertiary: '#0a0f0d', // Darker backgrounds (food page)
      card: '#141a17', // Card backgrounds
      cardElevated: '#1a2520', // Elevated card backgrounds
      cardDark: '#0f2419', // Dark card backgrounds (active states)
      navBar: '#0f251f', // Navigation bar background
      navActive: '#0f2419', // Active navigation item background
      screen: '#0a1f1a', // Screen backgrounds
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
    },

    // Text colors
    text: {
      primary: '#ffffff', // Primary text (white)
      secondary: '#9ca3af', // Secondary text (gray-400)
      tertiary: '#4b5563', // Tertiary text (gray-600)
      muted: '#6b7280', // Muted text
      accent: '#22c55e', // Accent text (green)
      accentLight: '#34d399', // Light accent text (emerald)
      black: '#000000', // Black text (for icons on light backgrounds)
      gray300: '#d1d5db', // Gray-300
      gray400: '#9ca3af', // Gray-400
      gray500: '#6b7280', // Gray-500
      white: '#ffffff', // White
      // Text colors with opacity
      primary12: 'rgba(255, 255, 255, 0.125)', // Primary with 12.5% opacity
      primary20: 'rgba(255, 255, 255, 0.2)', // Primary with 20% opacity
      primary30: 'rgba(255, 255, 255, 0.3)', // Primary with 30% opacity
    },

    // Accent colors
    accent: {
      primary: '#22c55e', // Primary green
      secondary: '#34d399', // Secondary green (emerald)
      tertiary: '#14b8a6', // Tertiary green (teal)
      gradient: {
        start: '#34d399',
        end: '#14b8a6',
      },
      // Accent colors with opacity
      primary10: 'rgba(34, 197, 94, 0.1)', // Primary with 10% opacity
      primary20: 'rgba(34, 197, 94, 0.2)', // Primary with 20% opacity
      primary40: 'rgba(34, 197, 94, 0.4)', // Primary with 40% opacity
      primary5: 'rgba(34, 197, 94, 0.05)', // Primary with 5% opacity
      secondary10: 'rgba(52, 211, 153, 0.1)', // Secondary with 10% opacity
      secondary20: 'rgba(52, 211, 153, 0.2)', // Secondary with 20% opacity
    },

    // Border colors
    border: {
      default: 'rgba(75, 85, 99, 0.5)', // gray-800/50
      light: 'rgba(55, 65, 81, 0.3)', // gray-700/30
      dark: '#1a2f2a', // Dark border
      accent: '#2a4d3f', // Accent border
      dashed: '#374151', // Dashed border (gray-700)
      emerald: 'rgba(6, 78, 59, 0.3)', // emerald-900/30
      blue: 'rgba(59, 130, 246, 0.4)', // blue-500/40
      gray600: 'rgba(75, 85, 99, 0.4)', // gray-600/40
    },

    // Status colors
    status: {
      success: '#22c55e',
      warning: '#f97316', // Orange
      error: '#ef4444', // Red
      info: '#3b82f6', // Blue
      purple: '#a855f7', // Purple
      notificationBadge: '#ef4444', // Red notification badge (same as error)
      // Status colors with opacity
      success20: 'rgba(34, 197, 94, 0.2)', // Success with 20% opacity
      error8: 'rgba(239, 68, 68, 0.08)', // Error with 8% opacity
      error20: 'rgba(239, 68, 68, 0.2)', // Error with 20% opacity
      error12: 'rgba(239, 68, 68, 0.125)', // Error with 12.5% opacity
      info20: 'rgba(59, 130, 246, 0.2)', // Info with 20% opacity
      purple40: 'rgba(168, 85, 247, 0.4)', // Purple with 40% opacity
      purple20: 'rgba(168, 85, 247, 0.2)', // Purple with 20% opacity
    },

    // Rose colors (for red button variant)
    rose: {
      brand: '#da2552', // Rose-700 (darker, less bright)
      dark: '#9f1239', // Rose-800 (darker variant)
      // Rose colors with opacity
      brand20: 'rgba(190, 18, 60, 0.2)', // Rose-brand with 20% opacity
    },

    // Macro colors
    macros: {
      protein: {
        text: '#6366f1', // Indigo-500
        bg: '#6366f1', // Indigo-500
      },
      carbs: {
        text: '#10b981', // Emerald-500
        bg: '#10b981', // Emerald-500
      },
      fat: {
        text: '#f59e0b', // Amber-500
        bg: '#f59e0b', // Amber-500
      },
      fiber: {
        text: '#ec4899', // Pink-500
        bg: '#ec4899', // Pink-500
      },
    },

    // Overlay and opacity colors
    overlay: {
      black60: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity
      white50: 'rgba(255, 255, 255, 0.5)', // White with 50% opacity
      white60: 'rgba(255, 255, 255, 0.6)', // White with 60% opacity
      white70: 'rgba(255, 255, 255, 0.7)', // White with 70% opacity
      white80: 'rgba(255, 255, 255, 0.8)', // White with 80% opacity
      white30: 'rgba(255, 255, 255, 0.3)', // White with 30% opacity
      white20: 'rgba(255, 255, 255, 0.2)', // White with 20% opacity
      white5: 'rgba(255, 255, 255, 0.05)', // White with 5% opacity
      black60Opacity: 'rgba(0, 0, 0, 0.6)', // Black with 60% opacity (for gradients)
      backdrop: 'rgba(10, 31, 26, 0.8)', // Background primary with 80% opacity (for modals)
    },

    // Opacity values (for use in style objects)
    opacity: {
      light: 0.4,
      medium: 0.5,
      heavy: 0.6,
      veryHeavy: 0.8,
      full: 1.0,
      // Specific opacity values
      iconBackground: 0.125, // 12.5% for icon backgrounds
    },

    // Gradient colors
    gradients: {
      primary: ['#5b7cf5', '#4a9d8f', '#47d9ba'] as const,
      accent: ['#34d399', '#14b8a6'] as const,
      card: ['#1a2520', '#0f1812'] as const,
      button: ['#1a3530', '#0f1f1a'] as const,
      progress: ['#6366f1', '#2dd4bf', '#34d399'] as const,
      workoutsTitle: ['#a78bfa', '#60a5fa', '#34d399'] as const,
      notification: ['#1a3d2f', '#0f2419'] as const,
      upNextCard: ['#1a2f2a', '#141a17', '#1a2520'] as const,
      cta: ['#4f46e5', '#29e08e'] as const, // Indigo to primary green gradient
      workoutSessionOverlay: [
        'rgba(10, 31, 26, 0.95)',
        'rgba(10, 31, 26, 0.85)',
        'rgba(10, 31, 26, 0.7)',
      ] as const,
    },
  },

  typography: {
    // Font sizes
    fontSize: {
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
    },

    // Line heights
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: {
    // Padding
    padding: {
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
    },

    // Margin/Gap
    gap: {
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
    },
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    full: 9999,
  },

  // Border widths
  borderWidth: {
    thin: 1,
    medium: 2,
    thick: 3,
    // Additional border widths
    accent: 5, // For accent borders like snackbar
  },

  // Stroke widths (for icons and SVG)
  strokeWidth: {
    thin: 1,
    normal: 2.5,
    thick: 3,
  },

  shadows: {
    sm: {
      shadowColor: '#000000', // Using theme.colors.text.black value
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000000', // Using theme.colors.text.black value
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000000', // Using theme.colors.text.black value
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    accent: {
      shadowColor: '#22c55e', // Using theme.colors.accent.primary value
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    // Additional shadow variants
    none: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Custom shadow for sliders
    slider: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    accentGlow: {
      shadowColor: '#22c55e', // Using theme.colors.accent.primary value
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    error: {
      shadowColor: '#ef4444', // Using theme.colors.status.error value
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    purpleGlow: {
      shadowColor: '#a855f7', // Using theme.colors.status.purple value
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 200,
      elevation: 0,
    },
    accentGlowLarge: {
      shadowColor: '#22c55e', // Using theme.colors.accent.primary value
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 5,
    },
    roseGlow: {
      shadowColor: '#da2552', // Using theme.colors.rose.brand value
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
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
    '20': 80,
    '22': 88,
    '24': 96,
    '32': 128,
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
  },

  // Component-specific sizes
  components: {
    navBar: {
      height: 80,
      itemHeight: 40,
      itemWidth: 64,
      cameraButtonSize: 80,
    },
    button: {
      height: {
        sm: 36,
        md: 44,
        lg: 52,
      },
    },
    card: {
      padding: 16,
      borderRadius: 24,
    },
    exerciseImage: {
      size: 48,
    },
    progressBar: {
      height: 48,
    },
    modal: {
      defaultMaxWidth: 384,
      confirmationMaxWidth: 416,
      bottomSheetInitialOffset: 300, // Initial offset for bottom sheet animations
    },
    workoutSession: {
      heroImageHeight: 520,
    },
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
 * @example getColor('background.primary') => '#0a1f1a'
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let value: any = theme.colors;
  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      console.warn(`Theme color path "${path}" not found`);
      return '#000000';
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
 * @param hexColor - Hex color string (e.g., '#22c55e')
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
