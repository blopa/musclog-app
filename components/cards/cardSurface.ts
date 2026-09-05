import type { ViewStyle } from 'react-native';

import type { Theme } from '@/theme';

/**
 * The app's card system has exactly two styles, plus one documented brand
 * exception (see DESIGN.md § Components → Cards and modals):
 *
 * - 'flat' (default): background.card + an ink/5 hairline, no shadow. Use for
 *   almost every card — lists, stats, settings rows.
 * - 'raised': background.cardElevated + the same hairline + shadows.md.
 *   Reserve for the single emphasis/hero card on a screen. Illegal inside
 *   BottomPopUp / CenteredModal — their sheet surface is already
 *   cardElevated, so a raised card disappears into it (Android elevation can
 *   also leak through a SurfaceColorProvider fade; see AGENTS.md).
 * - 'hero': the colorfulCard gradient fill. Reserved for DailySummaryCard —
 *   DESIGN.md forbids deriving its presentation from themeMode, and adding a
 *   second consumer needs a documented decision, not a copy-paste.
 */
export type CardVariant = 'flat' | 'raised' | 'hero';

export type CardSurface = {
  backgroundColor?: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  shadow?: Partial<ViewStyle>;
};

/**
 * Pulled out of GenericCard as a pure function so the two-style contract has
 * an automated test (cardSurface.test.ts) rather than relying on visual
 * review alone.
 */
export function resolveCardSurface(variant: CardVariant, theme: Theme): CardSurface {
  const borderRadius = theme.borderRadius.lg;

  if (variant === 'hero') {
    return {
      borderColor: theme.colors.border.default,
      borderWidth: theme.borderWidth.thin,
      borderRadius,
    };
  }

  if (variant === 'raised') {
    return {
      backgroundColor: theme.colors.background.cardElevated,
      borderColor: theme.colors.background.ink5,
      borderWidth: theme.borderWidth.thin,
      borderRadius,
      shadow: theme.shadows.md,
    };
  }

  return {
    backgroundColor: theme.colors.background.card,
    borderColor: theme.colors.background.ink5,
    borderWidth: theme.borderWidth.thin,
    borderRadius,
  };
}
