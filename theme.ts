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
    },

    // Text colors
    text: {
      primary: '#ffffff', // Primary text (white)
      secondary: '#9ca3af', // Secondary text (gray-400)
      tertiary: '#4b5563', // Tertiary text (gray-600)
      muted: '#6b7280', // Muted text
      accent: '#22c55e', // Accent text (green)
      accentLight: '#34d399', // Light accent text (emerald)
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
    },

    // Border colors
    border: {
      default: 'rgba(75, 85, 99, 0.5)', // gray-800/50
      light: 'rgba(55, 65, 81, 0.3)', // gray-700/30
      dark: '#1a2f2a', // Dark border
      accent: '#2a4d3f', // Accent border
      dashed: '#374151', // Dashed border (gray-700)
    },

    // Status colors
    status: {
      success: '#22c55e',
      warning: '#f97316', // Orange
      error: '#ef4444', // Red
      info: '#3b82f6', // Blue
      purple: '#a855f7', // Purple
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

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    accent: {
      shadowColor: '#22c55e',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
  },

  // Icon sizes
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
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
