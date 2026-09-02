/**
 * Theme configuration for the app
 * Centralizes colors, typography, spacing, and other design tokens
 */
import { Appearance } from 'react-native';

import type { ThemeId } from './constants/settings';
import { SettingsService } from './database/services/SettingsService';
import {
  colors,
  kineticDepthThemeColors,
  kineticLightThemeColors,
  kineticShockThemeColors,
  kineticVoltThemeColors,
} from './theme.tokens';
import { resolveThemeId } from './utils/themeSelection';

export { addOpacityToHex } from './theme.tokens';

/** JS theme tokens widen gradient arrays to string[]; gradients need non-empty string tuples for RN */
type GradientStops = readonly [string, string, ...string[]];

type FixGradientTokens<T> = {
  [K in keyof T]: T[K] extends readonly unknown[] ? GradientStops : T[K];
};

/** Everything that does not depend on the palette. Shared by every theme. */
const staticTokens = {
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
      '80': 80,
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
} as const;

/**
 * Utility functions for accessing theme values
 */

/**
 * Get a color value from the theme
 * @example getColor('background.primary') => colors.surfaceBase
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let value: any = theme.colors;
  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      console.warn(`Theme color path "${path}" not found`);
      return colors.surfaceBase;
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
 * Shadows are palette-dependent: `palette.shadow` is the scrim colour, which stays
 * dark in every theme, and the coloured glows follow their accent.
 */
function createShadows(palette: ThemePalette) {
  return {
    sm: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    accent: {
      shadowColor: palette.accent.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    // Additional shadow variants
    none: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // Specific shadow radius values
    radius3: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    radius4: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    radius8: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    radius15: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    radius20: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    radius40: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 40,
      elevation: 20,
    },
    // Custom shadow for sliders
    slider: {
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 5,
    },
    accentGlow: {
      shadowColor: palette.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 5,
    },
    error: {
      shadowColor: palette.status.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
    purpleGlow: {
      shadowColor: palette.status.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 200,
      elevation: 0,
    },
    accentGlowLarge: {
      shadowColor: palette.accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 5,
    },
    roseGlow: {
      shadowColor: palette.rose.brand,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
  };
}

type ThemePalette = typeof kineticDepthThemeColors;

function createTheme(palette: ThemePalette) {
  return {
    ...staticTokens,
    colors: {
      ...palette,
      gradients: palette.gradients as unknown as FixGradientTokens<typeof palette.gradients>,
    },
    shadows: createShadows(palette),
  };
}

export const kineticDepthTheme = createTheme(kineticDepthThemeColors);
export type Theme = typeof kineticDepthTheme;
export const kineticLightTheme: Theme = createTheme(kineticLightThemeColors);
export const kineticShockTheme: Theme = createTheme(kineticShockThemeColors);
export const kineticVoltTheme: Theme = createTheme(kineticVoltThemeColors);

export const THEMES = {
  'kinetic-depth': kineticDepthTheme,
  'kinetic-light': kineticLightTheme,
  'kinetic-shock': kineticShockTheme,
  'kinetic-volt': kineticVoltTheme,
} satisfies Record<ThemeId, Theme>;

// Compatibility aliases for call sites whose concern is specifically display
// mode (for example, camera surfaces that must always be dark).
export const darkTheme = kineticDepthTheme;
export const lightTheme = kineticLightTheme;

/**
 * The default theme, for the few non-React call sites that cannot resolve the
 * user's preference (see `getTheme` for the async alternative).
 */
export const theme = kineticDepthTheme;

// Type exports for TypeScript
export type ThemeColors = Theme['colors'];
export type ThemeTypography = Theme['typography'];

/**
 * Asynchronously get the active theme based on user preference and system settings.
 * Use this in non-React parts (like services or background tasks).
 * This will not dynamically update if the theme is changed while the code is running.
 */
export async function getTheme(): Promise<Theme> {
  try {
    const preference = await SettingsService.getThemePreference();
    const themeId = resolveThemeId(preference, Appearance.getColorScheme());
    return THEMES[themeId];
  } catch (error) {
    console.error('[Theme] Error fetching theme preference, defaulting to Kinetic Depth:', error);
    return darkTheme;
  }
}

/**
 * Usage Examples:
 *
 * Both of these follow the active theme — NativeWind class colours resolve to the
 * CSS variables that `ThemeProvider` swaps, so either is fine:
 *
 * 1. NativeWind classes (preferred for static styling):
 *    <View className="bg-bg-primary p-base rounded-2xl">
 *    <Text className="text-text-primary text-lg font-semibold">
 *
 * 2. Inline styles, for the colours Tailwind does not expose (status hues,
 *    gradients, washes):
 *    const theme = useTheme();
 *    <View style={{ backgroundColor: theme.colors.background.primary }}>
 */
