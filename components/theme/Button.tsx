import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { isValidElement, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { Theme } from '@/theme';

type ThemeButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ThemeButtonVariant =
  'accent' | 'discard' | 'outline' | 'secondary' | 'secondaryGradient' | 'dashed' | 'gradientCta';

type ThemeButtonProps = {
  label: string;
  labelAccessory?: string;
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
  style?: ViewStyle;
};

const getSizeConfig = (theme: Theme) => {
  return {
    xs: {
      paddingVertical: theme.spacing.padding.sm,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      iconSize: theme.iconSize.xs,
      gap: theme.spacing.gap.xs,
      shadow: theme.shadows.sm,
    },
    sm: {
      paddingVertical: theme.spacing.padding.md,
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      iconSize: theme.iconSize.sm,
      gap: theme.spacing.gap.sm,
      shadow: theme.shadows.md,
    },
    md: {
      paddingVertical: theme.spacing.padding.base,
      borderRadius: theme.borderRadius.xl,
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.bold,
      iconSize: theme.iconSize.md,
      gap: theme.spacing.gap.md,
      shadow: theme.shadows.accentGlow,
    },
    lg: {
      paddingVertical: theme.spacing.padding.lg,
      borderRadius: theme.borderRadius['2xl'],
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      iconSize: theme.iconSize.lg,
      gap: theme.spacing.gap.md,
      shadow: theme.shadows.accentGlowLarge,
    },
    xl: {
      paddingVertical: theme.spacing.padding.xl,
      borderRadius: theme.borderRadius['2xl'],
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      iconSize: theme.iconSize.lg,
      gap: theme.spacing.gap.md,
      shadow: theme.shadows.accentGlowLarge,
    },
  };
};

const widthClasses = {
  full: 'w-full',
  'flex-1': 'flex-1',
  'flex-2': 'flex-[2]',
  auto: '',
};

const getGradientColors = (
  theme: Theme,
  variant: ThemeButtonVariant,
  isDisabled: boolean
): readonly [string, string, ...string[]] => {
  if (isDisabled) {
    return [theme.colors.background.ink10, theme.colors.background.ink10] as const;
  }

  switch (variant) {
    case 'gradientCta':
      return theme.colors.gradients.cta;
    case 'discard':
      return [theme.colors.rose.brand, theme.colors.rose.brand] as const;
    case 'secondaryGradient':
      return theme.colors.gradients.button;
    case 'secondary':
      return [theme.colors.background.overlay, theme.colors.background.overlay] as const;
    default:
      return theme.colors.gradients.accent;
  }
};

const getTextColor = (theme: Theme, variant: ThemeButtonVariant, isDisabled: boolean): string => {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  switch (variant) {
    case 'outline':
    case 'dashed':
      return theme.colors.text.secondary;
    // `secondaryGradient` fills with `gradients.button`, which is a SURFACE gradient
    // rather than a colourful one, so its label is on-surface ink like `secondary`.
    case 'secondary':
    case 'secondaryGradient':
      return theme.colors.text.primary;
    default:
      break;
  }

  return theme.colors.text.alwaysWhite;
};

const getIconColor = (theme: Theme, variant: ThemeButtonVariant, isDisabled: boolean): string => {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  switch (variant) {
    case 'outline':
    case 'dashed':
      return theme.colors.text.secondary;
    case 'secondary':
      return theme.colors.accent.secondary;
    case 'secondaryGradient':
      return theme.colors.text.primary;
    default:
      break;
  }

  return theme.colors.text.alwaysWhite;
};

const getShadowStyle = (
  theme: Theme,
  variant: ThemeButtonVariant,
  configShadow: object,
  isDisabled: boolean
) => {
  if (isDisabled) {
    return theme.shadows.none;
  }

  switch (variant) {
    case 'outline':
    case 'secondary':
    case 'secondaryGradient':
    case 'dashed':
    case 'gradientCta':
      return theme.shadows.none;
    case 'discard':
      return theme.shadows.roseGlow;
    default:
      return configShadow;
  }
};

const getOutlineBackgroundColor = (
  theme: Theme,
  variant: ThemeButtonVariant,
  isDisabled: boolean,
  isPressed: boolean
): string | undefined => {
  if (variant !== 'outline' || isDisabled) {
    return undefined;
  }

  return isPressed ? theme.colors.background.ink5 : 'transparent';
};

const getBorderWidth = (theme: Theme, variant: ThemeButtonVariant): number => {
  switch (variant) {
    case 'outline':
    case 'dashed':
      return theme.borderWidth.medium;
    case 'secondary':
    case 'secondaryGradient':
      return theme.borderWidth.thin;
    default:
      return theme.borderWidth.none;
  }
};

const getBorderColor = (theme: Theme, variant: ThemeButtonVariant): string => {
  switch (variant) {
    case 'outline':
      return theme.colors.background.ink10;
    case 'dashed':
      return theme.colors.border.dashed;
    case 'secondaryGradient':
      return theme.colors.border.brand;
    case 'secondary':
      return theme.colors.border.default;
    default:
      return 'transparent';
  }
};

export function Button({
  label,
  labelAccessory,
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
  const sizeConfig = getSizeConfig(theme);
  const config = sizeConfig[size];
  const widthClass = widthClasses[width];
  const [isPressed, setIsPressed] = useState(false);

  // Read once for the JSX below; every colour/metric resolver dispatches on
  // `variant` itself rather than taking a parallel list of booleans.
  const isOutlineVariant = variant === 'outline';
  const isSecondaryVariant = variant === 'secondary';
  const isSecondaryGradientVariant = variant === 'secondaryGradient';
  const isDashedVariant = variant === 'dashed';
  const isGradientCtaVariant = variant === 'gradientCta';
  const isDisabled = disabled || loading;

  const gradientColors = getGradientColors(theme, variant, isDisabled);
  const textColor = getTextColor(theme, variant, isDisabled);
  const iconColor = getIconColor(theme, variant, isDisabled);
  const shadow = getShadowStyle(theme, variant, config.shadow, isDisabled);

  const finalIconColor = customIconColor || iconColor;
  const iconSize = iconBgColor ? theme.iconSize.sm : config.iconSize;

  let iconElement: ReactNode = null;
  if (loading) {
    // Show ActivityIndicator when loading (replaces icon)
    iconElement = (
      <ActivityIndicator
        size="small"
        color={finalIconColor}
        style={iconBgColor ? { width: iconSize, height: iconSize } : {}}
      />
    );
    if (iconBgColor) {
      iconElement = (
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBgColor }}
        >
          <ActivityIndicator size="small" color={finalIconColor} />
        </View>
      );
    }
  } else if (Icon) {
    if (isValidElement(Icon)) {
      iconElement = Icon;
    } else if (typeof Icon === 'function') {
      const Comp = Icon as any;
      iconElement = iconBgColor ? (
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBgColor }}
        >
          <Comp size={iconSize} color={finalIconColor} />
        </View>
      ) : (
        <Comp size={config.iconSize} color={iconColor} />
      );
    } else if (typeof Icon === 'object' && (Icon as any).render) {
      const Comp = Icon as any;
      iconElement = iconBgColor ? (
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBgColor }}
        >
          <Comp size={iconSize} color={finalIconColor} />
        </View>
      ) : (
        <Comp size={config.iconSize} color={iconColor} />
      );
    } else {
      // Unknown type, attempt to render directly
      iconElement = Icon as ReactNode;
    }
  }

  const accessoryTextStyle: TextStyle = {
    color: isOutlineVariant ? theme.colors.text.tertiary : textColor,
    fontSize: Math.max(theme.typography.fontSize.sm, config.fontSize - 6),
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: theme.typography.letterSpacing.normal,
    opacity: isOutlineVariant ? theme.colors.opacity.full : theme.colors.opacity.strong,
  };

  const textElement = (
    <Text
      className="tracking-wide"
      style={{
        fontSize: config.fontSize,
        fontWeight: config.fontWeight,
        color: textColor,
        textAlign: 'center',
        flexShrink: 1,
      }}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {label}
      {labelAccessory ? <Text style={accessoryTextStyle}>{`  ${labelAccessory}`}</Text> : null}
    </Text>
  );

  /** Keeps Lucide/SVG icons from shrinking when the label is long (e.g. long translations). */
  const iconRowChild =
    iconElement != null ? (
      <View
        style={{
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {iconElement}
      </View>
    ) : null;

  const hasVisibleIcon = iconRowChild != null;
  const showBalanceSpacer = hasVisibleIcon && width !== 'auto';

  const buttonContent = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: hasVisibleIcon ? config.gap : theme.spacing.gap.zero,
        ...(width === 'auto' ? {} : { width: '100%' }),
      }}
    >
      {iconPosition === 'left' ? iconRowChild : null}
      {showBalanceSpacer && iconPosition === 'right' ? (
        <View style={{ width: iconSize, flexShrink: 0 }} />
      ) : null}
      <View
        style={{
          ...(hasVisibleIcon && width && width !== 'auto' ? { flex: 1 } : {}),
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {textElement}
      </View>
      {showBalanceSpacer && iconPosition === 'left' ? (
        <View style={{ width: iconSize, flexShrink: 0 }} />
      ) : null}
      {iconPosition === 'right' ? iconRowChild : null}
    </View>
  );

  const outlineBackgroundColor = getOutlineBackgroundColor(theme, variant, isDisabled, isPressed);

  // Determine border style for dashed variant
  const borderStyle = isDashedVariant ? 'dashed' : 'solid';

  // Calculate minimum height based on size and padding
  // This ensures buttons of the same size have consistent heights
  const minHeight = config.paddingVertical * 2 + config.fontSize * 1.5;

  const buttonStyle = {
    borderRadius: config.borderRadius,
    ...shadow,
    opacity: isDisabled ? theme.colors.opacity.full : undefined,
    backgroundColor: outlineBackgroundColor,
    borderWidth: getBorderWidth(theme, variant),
    borderStyle: borderStyle as 'solid' | 'dashed',
    borderColor: getBorderColor(theme, variant),
    overflow: 'hidden' as const,
    // Prevent stretching in flex containers
    alignSelf: 'flex-start' as const,
    minHeight: minHeight,
    // Prevent horizontal stretching when width is 'auto'
    ...(width === 'auto' ? { flexShrink: 0 } : {}),
    ...style,
  };

  // If disabled, render as a View to avoid any interaction issues
  if (isDisabled) {
    return (
      <View className={`${widthClass}`} style={buttonStyle}>
        {isOutlineVariant || isSecondaryVariant || isDashedVariant ? (
          <View
            style={{
              borderRadius: config.borderRadius,
              paddingVertical: config.paddingVertical,
              paddingHorizontal: theme.spacing.padding.base,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isSecondaryVariant ? theme.colors.background.overlay : undefined,
              minHeight: minHeight,
              ...(width === 'auto' ? {} : { width: '100%' }),
            }}
          >
            {buttonContent}
          </View>
        ) : (
          <View
            style={{
              position: 'relative',
              borderRadius: config.borderRadius,
              overflow: 'hidden',
              minHeight: minHeight,
              ...(width === 'auto' ? {} : { width: '100%' }),
            }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: isSecondaryGradientVariant ? 1 : 0,
              }}
              style={{
                borderRadius: config.borderRadius,
                paddingVertical: config.paddingVertical,
                paddingHorizontal: theme.spacing.padding.base,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: minHeight,
                ...(width === 'auto' ? {} : { width: '100%' }),
              }}
            >
              {buttonContent}
            </LinearGradient>
          </View>
        )}
      </View>
    );
  }

  return (
    <Pressable
      className={`${widthClass} active:scale-[0.98]`}
      style={buttonStyle}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={false}
      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
    >
      {isOutlineVariant || isSecondaryVariant || isDashedVariant ? (
        <View
          style={{
            borderRadius: config.borderRadius,
            paddingVertical: config.paddingVertical,
            paddingHorizontal: theme.spacing.padding.base,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isSecondaryVariant ? theme.colors.background.overlay : undefined,
            minHeight: minHeight,
            ...(width === 'auto' ? {} : { width: '100%' }),
          }}
        >
          {buttonContent}
        </View>
      ) : (
        <View
          style={{
            position: 'relative',
            borderRadius: config.borderRadius,
            overflow: 'hidden',
            minHeight: minHeight,
            ...(width === 'auto' ? {} : { width: '100%' }),
          }}
        >
          <LinearGradient
            colors={gradientColors}
            start={{
              x: 0,
              y: 0,
            }}
            end={{
              x: 1,
              y: isSecondaryGradientVariant ? 1 : 0,
            }}
            style={{
              borderRadius: config.borderRadius,
              paddingVertical: config.paddingVertical,
              paddingHorizontal: theme.spacing.padding.base,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: minHeight,
              ...(width === 'auto' ? {} : { width: '100%' }),
            }}
          >
            {buttonContent}
          </LinearGradient>
          {isGradientCtaVariant && isPressed ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: theme.colors.background.scrim10,
                borderRadius: config.borderRadius,
              }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
