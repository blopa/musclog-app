import { LucideIcon } from 'lucide-react-native';
import { isValidElement, ReactNode } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { Theme } from '@/theme';

type ThemeButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';
type ThemeButtonVariant =
  | 'accent'
  | 'discard'
  | 'outline'
  | 'secondary'
  | 'secondaryGradient'
  | 'dashed'
  | 'gradientCta';

type ThemeButtonProps = {
  label: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
  icon?: LucideIcon | ReactNode | ((props: { size?: number; color?: string }) => ReactNode);
  iconPosition?: 'left' | 'right';
  size?: ThemeButtonSize;
  width?: ThemeButtonWidth;
  variant?: ThemeButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

const getSizeConfig = (theme: Theme) => ({
  xs: {
    paddingVertical: theme.spacing.padding.sm,
    paddingHorizontal: theme.spacing.padding.base,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.xs,
    gap: theme.spacing.gap.xs,
    minHeight: theme.spacing.padding.sm * 2 + theme.typography.fontSize.xs * 1.5,
  },
  sm: {
    paddingVertical: theme.spacing.padding.md,
    paddingHorizontal: theme.spacing.padding.base,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.sm,
    gap: theme.spacing.gap.sm,
    minHeight: theme.spacing.padding.md * 2 + theme.typography.fontSize.sm * 1.5,
  },
  md: {
    paddingVertical: theme.spacing.padding.base,
    paddingHorizontal: theme.spacing.padding.base,
    borderRadius: theme.borderRadius.xl,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.md,
    gap: theme.spacing.gap.md,
    minHeight: theme.spacing.padding.base * 2 + theme.typography.fontSize.base * 1.5,
  },
  lg: {
    paddingVertical: theme.spacing.padding.lg,
    paddingHorizontal: theme.spacing.padding.base,
    borderRadius: theme.borderRadius['2xl'],
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.lg,
    gap: theme.spacing.gap.md,
    minHeight: theme.spacing.padding.lg * 2 + theme.typography.fontSize.xl * 1.5,
  },
  xl: {
    paddingVertical: theme.spacing.padding.xl,
    paddingHorizontal: theme.spacing.padding.base,
    borderRadius: theme.borderRadius['2xl'],
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.lg,
    gap: theme.spacing.gap.md,
    minHeight: theme.spacing.padding.xl * 2 + theme.typography.fontSize.xl * 1.5,
  },
});

function getBackground(theme: Theme, variant: ThemeButtonVariant, isDisabled: boolean): string {
  if (isDisabled) {
    return theme.colors.background.white10;
  }

  const g = (colors: readonly string[]) => `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`;

  switch (variant) {
    case 'gradientCta':
      return g(theme.colors.gradients.cta);
    case 'discard':
      return theme.colors.rose.brand;
    case 'secondaryGradient':
      return g(theme.colors.gradients.button);
    case 'secondary':
      return theme.colors.background.overlay;
    case 'outline':
    case 'dashed':
      return 'transparent';
    default:
      return g(theme.colors.gradients.accent);
  }
}

function getTextColor(theme: Theme, variant: ThemeButtonVariant, isDisabled: boolean): string {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  if (variant === 'outline') {
    return theme.colors.text.gray300;
  }

  if (variant === 'dashed') {
    return theme.colors.text.secondary;
  }

  if (variant === 'secondary') {
    return theme.colors.text.primary;
  }

  return theme.colors.text.onColorful;
}

function getBorder(
  theme: Theme,
  variant: ThemeButtonVariant
): { borderWidth: number; borderStyle: string; borderColor: string } {
  if (variant === 'outline') {
    return {
      borderWidth: theme.borderWidth.medium,
      borderStyle: 'solid',
      borderColor: theme.colors.background.white10,
    };
  }

  if (variant === 'dashed') {
    return {
      borderWidth: theme.borderWidth.medium,
      borderStyle: 'dashed',
      borderColor: theme.colors.border.dashed,
    };
  }

  if (variant === 'secondary') {
    return {
      borderWidth: theme.borderWidth.thin,
      borderStyle: 'solid',
      borderColor: theme.colors.border.default,
    };
  }

  if (variant === 'secondaryGradient') {
    return {
      borderWidth: theme.borderWidth.thin,
      borderStyle: 'solid',
      borderColor: theme.colors.border.emerald,
    };
  }

  return { borderWidth: 0, borderStyle: 'none', borderColor: 'transparent' };
}

function getWidthStyle(width: ThemeButtonWidth): React.CSSProperties {
  switch (width) {
    case 'full':
      return { width: '100%' };
    case 'flex-1':
      return { flex: 1 };
    case 'flex-2':
      return { flex: 2 };
    default:
      return { alignSelf: 'flex-start' };
  }
}

function renderIcon(
  Icon: ThemeButtonProps['icon'],
  iconSize: number,
  iconColor: string,
  iconBgColor?: string
): ReactNode {
  if (!Icon) {
    return null;
  }

  let iconEl: ReactNode;

  if (isValidElement(Icon)) {
    iconEl = Icon;
  } else if (typeof Icon === 'function') {
    const Comp = Icon as any;
    iconEl = <Comp size={iconSize} color={iconColor} />;
  } else if (typeof Icon === 'object' && (Icon as any).render) {
    const Comp = Icon as any;
    iconEl = <Comp size={iconSize} color={iconColor} />;
  } else {
    iconEl = Icon as ReactNode;
  }

  if (iconBgColor) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: iconBgColor,
          flexShrink: 0,
        }}
      >
        {iconEl}
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {iconEl}
    </span>
  );
}

export function Button({
  label,
  onPress,
  icon: Icon,
  iconBgColor,
  iconColor: customIconColor,
  iconPosition = 'left',
  size = 'md',
  width = 'auto',
  variant = 'accent',
  disabled = false,
  loading = false,
  style,
}: ThemeButtonProps) {
  const theme = useTheme();
  const config = getSizeConfig(theme)[size];
  const isDisabled = disabled || loading;

  const iconColor = customIconColor ?? getTextColor(theme, variant, isDisabled);
  const iconEl = renderIcon(
    Icon,
    iconBgColor ? theme.iconSize.sm : config.iconSize,
    iconColor,
    iconBgColor
  );
  const border = getBorder(theme, variant);

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: iconEl ? config.gap : 0,
    paddingTop: config.paddingVertical,
    paddingBottom: config.paddingVertical,
    paddingLeft: config.paddingHorizontal,
    paddingRight: config.paddingHorizontal,
    borderRadius: config.borderRadius,
    minHeight: config.minHeight,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    color: getTextColor(theme, variant, isDisabled),
    background: getBackground(theme, variant, isDisabled),
    borderWidth: border.borderWidth,
    borderStyle: border.borderStyle as any,
    borderColor: border.borderColor,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    letterSpacing: '0.05em',
    textAlign: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...getWidthStyle(width),
    ...(style as React.CSSProperties | undefined),
  };

  return (
    <button onClick={isDisabled ? undefined : onPress} disabled={isDisabled} style={buttonStyle}>
      {iconPosition === 'left' ? iconEl : null}
      <span style={{ flexShrink: 1, minWidth: 0, textAlign: 'center' }}>
        {loading ? '…' : label}
      </span>
      {iconPosition === 'right' ? iconEl : null}
    </button>
  );
}
