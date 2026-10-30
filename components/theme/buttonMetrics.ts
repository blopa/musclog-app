import type { Theme } from '@/theme';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ButtonVariant =
  | 'accent'
  | 'discard'
  | 'outline'
  | 'secondary'
  | 'secondaryGradient'
  | 'dashed'
  | 'gradientCta'
  | 'rose'
  | 'roseOutline';

export type ButtonMetrics = {
  /** The button's height for a one-line label; a wrapped label grows past it. */
  minHeight: number;
  paddingVertical: number;
  paddingHorizontal: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: '600';
  iconSize: number;
  gap: number;
};

/**
 * One size table for `Button.tsx` and `Button.web.tsx`. Heights are fixed steps rather than
 * padding plus line height, so two buttons of the same size are the same height whatever their
 * label: `sm` is the smallest that still meets the 44pt target, `xs` is only for dense rows that
 * pad their own hit area. Every size is semibold on the control radius.
 */
export function getButtonMetrics(theme: Theme): Record<ButtonSize, ButtonMetrics> {
  const { fontSize } = theme.typography;
  const base = {
    borderRadius: theme.borderRadius.control,
    fontWeight: theme.typography.fontWeight.semibold,
  } as const;

  return {
    xs: {
      ...base,
      minHeight: 36,
      paddingVertical: theme.spacing.padding['1half'],
      paddingHorizontal: theme.spacing.padding.md,
      fontSize: fontSize.xs,
      iconSize: theme.iconSize.xs,
      gap: theme.spacing.gap.xs,
    },
    sm: {
      ...base,
      minHeight: theme.components.button.height.md,
      paddingVertical: theme.spacing.padding.sm,
      paddingHorizontal: theme.spacing.padding.md,
      fontSize: fontSize.sm,
      iconSize: theme.iconSize.sm,
      gap: theme.spacing.gap.sm,
    },
    md: {
      ...base,
      minHeight: 48,
      paddingVertical: theme.spacing.padding['2half'],
      paddingHorizontal: theme.spacing.padding.base,
      fontSize: fontSize.base,
      iconSize: theme.iconSize.md,
      gap: theme.spacing.gap.sm,
    },
    lg: {
      ...base,
      minHeight: theme.components.button.height.lg,
      paddingVertical: theme.spacing.padding.md,
      paddingHorizontal: theme.spacing.padding.lg,
      fontSize: fontSize.base,
      iconSize: theme.iconSize.lg,
      gap: theme.spacing.gap.sm,
    },
    xl: {
      ...base,
      minHeight: 56,
      paddingVertical: theme.spacing.padding['3half'],
      paddingHorizontal: theme.spacing.padding.xl,
      fontSize: fontSize.lg,
      iconSize: theme.iconSize.lg,
      gap: theme.spacing.gap.md,
    },
  };
}

/** The fill behind the label. Every button is flat: `gradientCta` is `accent` by another name. */
export function getButtonFill(
  theme: Theme,
  variant: ButtonVariant,
  isDisabled: boolean
): string | undefined {
  if (isDisabled) {
    return variant === 'outline' || variant === 'roseOutline' || variant === 'dashed'
      ? undefined
      : theme.colors.background.ink10;
  }

  switch (variant) {
    case 'discard':
    case 'rose':
      return theme.colors.rose.brand;
    case 'secondary':
    case 'secondaryGradient':
      return theme.colors.background.overlay;
    case 'outline':
    case 'dashed':
    case 'roseOutline':
      return undefined;
    default:
      return theme.colors.accent.primary;
  }
}

export function getButtonInk(theme: Theme, variant: ButtonVariant, isDisabled: boolean): string {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  switch (variant) {
    case 'outline':
    case 'dashed':
      return theme.colors.text.secondary;
    case 'roseOutline':
      return theme.colors.rose.brand;
    case 'secondary':
    case 'secondaryGradient':
      return theme.colors.text.primary;
    case 'discard':
    case 'rose':
      return theme.colors.text.alwaysWhite;
    default:
      return theme.colors.text.onAccent;
  }
}

/** Secondary buttons keep their accent icon; every other variant draws its icon in the label ink. */
export function getButtonIconInk(
  theme: Theme,
  variant: ButtonVariant,
  isDisabled: boolean
): string {
  if (!isDisabled && variant === 'secondary') {
    return theme.colors.accent.secondary;
  }

  return getButtonInk(theme, variant, isDisabled);
}

export function getButtonBorder(
  theme: Theme,
  variant: ButtonVariant
): { borderWidth: number; borderStyle: 'solid' | 'dashed'; borderColor: string } {
  switch (variant) {
    case 'outline':
      return {
        borderWidth: theme.borderWidth.thin,
        borderStyle: 'solid',
        borderColor: theme.colors.background.ink10,
      };
    case 'roseOutline':
      return {
        borderWidth: theme.borderWidth.thin,
        borderStyle: 'solid',
        borderColor: theme.colors.rose.brand,
      };
    case 'dashed':
      return {
        borderWidth: theme.borderWidth.thin,
        borderStyle: 'dashed',
        borderColor: theme.colors.border.dashed,
      };
    case 'secondary':
      return {
        borderWidth: theme.borderWidth.thin,
        borderStyle: 'solid',
        borderColor: theme.colors.border.default,
      };
    case 'secondaryGradient':
      return {
        borderWidth: theme.borderWidth.thin,
        borderStyle: 'solid',
        borderColor: theme.colors.border.brand,
      };
    default:
      return { borderWidth: 0, borderStyle: 'solid', borderColor: 'transparent' };
  }
}
