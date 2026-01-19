import { Text, Pressable, ViewStyle, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { theme } from '../../theme';

type ThemeButtonSize = 'sm' | 'md' | 'lg';

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
  icon?:
    | LucideIcon
    | React.ReactNode
    | ((props: { size?: number; color?: string }) => React.ReactNode);
  iconPosition?: 'left' | 'right';
  size?: ThemeButtonSize;
  width?: ThemeButtonWidth;
  variant?: ThemeButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: ViewStyle;
};

const sizeConfig = {
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
    paddingVertical: theme.spacing.padding.lg,
    borderRadius: theme.borderRadius.xl,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.md,
    gap: theme.spacing.gap.md,
    shadow: theme.shadows.accentGlow,
  },
  lg: {
    paddingVertical: theme.spacing.padding.xl,
    borderRadius: theme.borderRadius['2xl'],
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.lg,
    gap: theme.spacing.gap.md,
    shadow: theme.shadows.accentGlowLarge,
  },
};

const widthClasses = {
  full: 'w-full',
  'flex-1': 'flex-1',
  'flex-2': 'flex-[2]',
  auto: '',
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

  const gradientColors: readonly [string, string, ...string[]] = isDisabled
    ? ([theme.colors.background.white10, theme.colors.background.white10] as const)
    : isGradientCtaVariant
      ? theme.colors.gradients.cta
      : isRedVariant
        ? ([theme.colors.rose.brand, theme.colors.rose.brand] as const)
        : isSecondaryGradientVariant
          ? theme.colors.gradients.button
          : isSecondaryVariant
            ? ([theme.colors.background.overlay, theme.colors.background.overlay] as const)
            : theme.colors.gradients.accent;

  const textColor = isDisabled
    ? theme.colors.text.primary30
    : isOutlineVariant
      ? theme.colors.text.gray300
      : isDashedVariant
        ? theme.colors.text.secondary
        : isGradientCtaVariant
          ? theme.colors.text.white
          : isSecondaryVariant || isSecondaryGradientVariant
            ? theme.colors.text.primary
            : isRedVariant
              ? theme.colors.text.white
              : theme.colors.text.black;

  const iconColor = isDisabled
    ? theme.colors.text.primary30
    : isOutlineVariant
      ? theme.colors.text.gray300
      : isDashedVariant
        ? theme.colors.text.secondary
        : isGradientCtaVariant
          ? theme.colors.text.white
          : isSecondaryVariant || isSecondaryGradientVariant
            ? theme.colors.accent.secondary
            : isRedVariant
              ? theme.colors.text.white
              : theme.colors.text.black;

  const shadow =
    isDisabled ||
    isOutlineVariant ||
    isSecondaryVariant ||
    isSecondaryGradientVariant ||
    isDashedVariant
      ? theme.shadows.none
      : isGradientCtaVariant
        ? theme.shadows.none
        : isRedVariant
          ? theme.shadows.roseGlow
          : config.shadow;

  const finalIconColor = customIconColor || iconColor;
  const iconSize = iconBgColor ? theme.iconSize.sm : config.iconSize;

  let iconElement: React.ReactNode = null;
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
    if (React.isValidElement(Icon)) {
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
      iconElement = Icon as React.ReactNode;
    }
  }

  const textElement = (
    <Text
      className={`tracking-wide ${
        isDisabled
          ? 'text-white/30'
          : isOutlineVariant
            ? 'text-gray-300'
            : isDashedVariant
              ? 'text-text-secondary'
              : isGradientCtaVariant
                ? 'text-white'
                : isSecondaryVariant || isSecondaryGradientVariant
                  ? 'text-text-primary'
                  : isRedVariant
                    ? 'text-white'
                    : 'text-text-black'
      }`}
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
      {iconPosition === 'left' && iconElement}
      <View
        style={{
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {textElement}
      </View>
      {iconPosition === 'right' && iconElement}
    </View>
  );

  const outlineBackgroundColor =
    isOutlineVariant && !isDisabled && isPressed
      ? theme.colors.background.white5
      : isOutlineVariant && !isDisabled
        ? 'transparent'
        : undefined;

  // Determine border style for dashed variant
  const borderStyle = isDashedVariant ? 'dashed' : 'solid';

  // Calculate minimum height based on size and padding
  // This ensures buttons of the same size have consistent heights
  const minHeight = config.paddingVertical * 2 + config.fontSize * 1.5;

  return (
    <Pressable
      className={`${widthClass} ${isDisabled ? '' : 'active:scale-[0.98]'}`}
      style={[
        {
          borderRadius: config.borderRadius,
          ...shadow,
          opacity: isDisabled ? theme.colors.opacity.full : undefined,
          backgroundColor: outlineBackgroundColor,
          borderWidth:
            isOutlineVariant || isSecondaryVariant || isSecondaryGradientVariant || isDashedVariant
              ? isOutlineVariant || isDashedVariant
                ? theme.borderWidth.medium
                : theme.borderWidth.thin
              : theme.borderWidth.none,
          borderStyle: borderStyle,
          borderColor: isOutlineVariant
            ? theme.colors.background.white10
            : isDashedVariant
              ? theme.colors.border.dashed
              : isSecondaryGradientVariant
                ? theme.colors.border.emerald
                : isSecondaryVariant
                  ? theme.colors.border.default
                  : 'transparent',
          overflow: 'hidden',
          // Prevent stretching in flex containers
          alignSelf: 'flex-start',
          minHeight: minHeight,
          // Prevent horizontal stretching when width is 'auto'
          ...(width === 'auto' ? { flexShrink: 0 } : {}),
        },
        style,
      ]}
      onPress={isDisabled || loading ? undefined : onPress}
      onPressIn={() => !isDisabled && setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={isDisabled}
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
            backgroundColor:
              isSecondaryVariant && !isDisabled ? theme.colors.background.overlay : undefined,
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
          {isGradientCtaVariant && isPressed && !isDisabled && (
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
          )}
        </View>
      )}
    </Pressable>
  );
}
