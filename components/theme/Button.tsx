import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { isValidElement, ReactNode, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';

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
  isDisabled: boolean,
  isGradientCtaVariant: boolean,
  isRedVariant: boolean,
  isSecondaryGradientVariant: boolean,
  isSecondaryVariant: boolean
): readonly [string, string, ...string[]] => {
  if (isDisabled) {
    return [theme.colors.background.white10, theme.colors.background.white10] as const;
  }

  if (isGradientCtaVariant) {
    return theme.colors.gradients.cta;
  }

  if (isRedVariant) {
    return [theme.colors.rose.brand, theme.colors.rose.brand] as const;
  }

  if (isSecondaryGradientVariant) {
    return theme.colors.gradients.button;
  }

  if (isSecondaryVariant) {
    return [theme.colors.background.overlay, theme.colors.background.overlay] as const;
  }

  return theme.colors.gradients.accent;
};

const getTextColor = (
  theme: Theme,
  isDisabled: boolean,
  isOutlineVariant: boolean,
  isDashedVariant: boolean,
  isSecondaryVariant: boolean
): string => {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  if (isOutlineVariant) {
    return theme.colors.text.gray300;
  }

  if (isDashedVariant) {
    return theme.colors.text.secondary;
  }

  if (isSecondaryVariant) {
    return theme.colors.text.primary;
  }

  return theme.colors.text.onColorful;
};

const getIconColor = (
  theme: Theme,
  isDisabled: boolean,
  isOutlineVariant: boolean,
  isDashedVariant: boolean,
  isSecondaryVariant: boolean
): string => {
  if (isDisabled) {
    return theme.colors.text.primary30;
  }

  if (isOutlineVariant) {
    return theme.colors.text.gray300;
  }

  if (isDashedVariant) {
    return theme.colors.text.secondary;
  }

  if (isSecondaryVariant) {
    return theme.colors.accent.secondary;
  }

  return theme.colors.text.onColorful;
};

const getShadowStyle = (
  theme: Theme,
  configShadow: object,
  isDisabled: boolean,
  isOutlineVariant: boolean,
  isSecondaryVariant: boolean,
  isSecondaryGradientVariant: boolean,
  isDashedVariant: boolean,
  isGradientCtaVariant: boolean,
  isRedVariant: boolean
) => {
  if (
    isDisabled ||
    isOutlineVariant ||
    isSecondaryVariant ||
    isSecondaryGradientVariant ||
    isDashedVariant
  ) {
    return theme.shadows.none;
  }

  if (isGradientCtaVariant) {
    return theme.shadows.none;
  }

  if (isRedVariant) {
    return theme.shadows.roseGlow;
  }

  return configShadow;
};

const getButtonTextClassName = (
  isDisabled: boolean,
  isOutlineVariant: boolean,
  isDashedVariant: boolean,
  isSecondaryVariant: boolean
): string => {
  if (isDisabled) {
    return 'text-white/30';
  }

  if (isOutlineVariant) {
    return 'text-gray-300';
  }

  if (isDashedVariant) {
    return 'text-text-secondary';
  }

  if (isSecondaryVariant) {
    return 'text-text-primary';
  }

  return 'text-text-on-colorful';
};

const getOutlineBackgroundColor = (
  theme: Theme,
  isOutlineVariant: boolean,
  isDisabled: boolean,
  isPressed: boolean
): string | undefined => {
  if (isOutlineVariant && !isDisabled && isPressed) {
    return theme.colors.background.white5;
  }
  if (isOutlineVariant && !isDisabled) {
    return 'transparent';
  }
  return undefined;
};

const getBorderWidth = (
  theme: Theme,
  isOutlineVariant: boolean,
  isSecondaryVariant: boolean,
  isSecondaryGradientVariant: boolean,
  isDashedVariant: boolean
): number => {
  if (isOutlineVariant || isSecondaryVariant || isSecondaryGradientVariant || isDashedVariant) {
    return isOutlineVariant || isDashedVariant ? theme.borderWidth.medium : theme.borderWidth.thin;
  }

  return theme.borderWidth.none;
};

const getBorderColor = (
  theme: Theme,
  isOutlineVariant: boolean,
  isDashedVariant: boolean,
  isSecondaryGradientVariant: boolean,
  isSecondaryVariant: boolean
): string => {
  if (isOutlineVariant) {
    return theme.colors.background.white10;
  }

  if (isDashedVariant) {
    return theme.colors.border.dashed;
  }

  if (isSecondaryGradientVariant) {
    return theme.colors.border.emerald;
  }

  if (isSecondaryVariant) {
    return theme.colors.border.default;
  }

  return 'transparent';
};

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
  const sizeConfig = getSizeConfig(theme);
  const config = sizeConfig[size];
  const widthClass = widthClasses[width];
  const [isPressed, setIsPressed] = useState(false);

  // Determine colors and styles based on variant and disabled state
  const isRedVariant = variant === 'discard';
  const isOutlineVariant = variant === 'outline';
  const isSecondaryVariant = variant === 'secondary';
  const isSecondaryGradientVariant = variant === 'secondaryGradient';
  const isDashedVariant = variant === 'dashed';
  const isGradientCtaVariant = variant === 'gradientCta';
  const isDisabled = disabled || loading;

  const gradientColors = getGradientColors(
    theme,
    isDisabled,
    isGradientCtaVariant,
    isRedVariant,
    isSecondaryGradientVariant,
    isSecondaryVariant
  );

  const textColor = getTextColor(
    theme,
    isDisabled,
    isOutlineVariant,
    isDashedVariant,
    isSecondaryVariant
  );

  const iconColor = getIconColor(
    theme,
    isDisabled,
    isOutlineVariant,
    isDashedVariant,
    isSecondaryVariant
  );

  const shadow = getShadowStyle(
    theme,
    config.shadow,
    isDisabled,
    isOutlineVariant,
    isSecondaryVariant,
    isSecondaryGradientVariant,
    isDashedVariant,
    isGradientCtaVariant,
    isRedVariant
  );

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
      // Try rendering as a component first
      const Comp = Icon as any;
      try {
        const compEl = iconBgColor ? (
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBgColor }}
          >
            <Comp size={iconSize} color={finalIconColor} />
          </View>
        ) : (
          <Comp size={config.iconSize} color={iconColor} />
        );
        iconElement = compEl;
      } catch (e) {
        // Fallback: treat as render prop
        try {
          const rendered = (Icon as any)({ size: iconSize, color: finalIconColor });
          iconElement = rendered;
        } catch (e2) {
          iconElement = null;
        }
      }
    } else if (typeof Icon === 'object' && (Icon as any).render) {
      // Handle forwardRef exotic components (they are objects with a `render` property)
      const Comp = Icon as any;
      try {
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
      } catch (e) {
        iconElement = null;
      }
    } else {
      // Unknown type, attempt to render directly
      iconElement = Icon as ReactNode;
    }
  }

  const textElement = (
    <Text
      className={`tracking-wide ${getButtonTextClassName(isDisabled, isOutlineVariant, isDashedVariant, isSecondaryVariant)}`}
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

  const buttonContent = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Icon ? config.gap : theme.spacing.gap.zero,
        ...(width === 'auto' ? {} : { width: '100%' }),
      }}
    >
      {iconPosition === 'left' ? iconRowChild : null}
      <View
        style={{
          ...(Icon ? { flex: 1 } : {}),
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {textElement}
      </View>
      {iconPosition === 'right' ? iconRowChild : null}
    </View>
  );

  const outlineBackgroundColor = getOutlineBackgroundColor(
    theme,
    isOutlineVariant,
    isDisabled,
    isPressed
  );

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
    borderWidth: getBorderWidth(
      theme,
      isOutlineVariant,
      isSecondaryVariant,
      isSecondaryGradientVariant,
      isDashedVariant
    ),
    borderStyle: borderStyle as 'solid' | 'dashed',
    borderColor: getBorderColor(
      theme,
      isOutlineVariant,
      isDashedVariant,
      isSecondaryGradientVariant,
      isSecondaryVariant
    ),
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
                x: isSecondaryGradientVariant || isGradientCtaVariant ? 0 : 0,
                y: isSecondaryGradientVariant ? 0 : 0,
              }}
              end={{
                x: isSecondaryGradientVariant || isGradientCtaVariant ? 1 : 1,
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
              x: isSecondaryGradientVariant || isGradientCtaVariant ? 0 : 0,
              y: isSecondaryGradientVariant ? 0 : 0,
            }}
            end={{
              x: isSecondaryGradientVariant || isGradientCtaVariant ? 1 : 1,
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
                backgroundColor: theme.colors.background.black10,
                borderRadius: config.borderRadius,
              }}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
