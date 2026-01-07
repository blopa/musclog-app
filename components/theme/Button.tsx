import { Text, Pressable, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { theme } from '../../theme';

type ThemeButtonSize = 'sm' | 'md' | 'lg';

type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ThemeButtonVariant = 'accent' | 'discard' | 'outline' | 'secondary' | 'secondaryGradient' | 'dashed';

type ThemeButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  size?: ThemeButtonSize;
  width?: ThemeButtonWidth;
  variant?: ThemeButtonVariant;
  disabled?: boolean;
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
  size = 'md',
  width = 'auto',
  variant = 'accent',
  disabled = false,
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
  const isDisabled = disabled;
  
  const gradientColors: readonly [string, string, ...string[]] = isDisabled
    ? ([theme.colors.background.white10, theme.colors.background.white10] as const)
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
    : isSecondaryVariant || isSecondaryGradientVariant
    ? theme.colors.accent.secondary
    : isRedVariant
    ? theme.colors.text.white
    : theme.colors.text.black;
  
  const shadow = isDisabled || isOutlineVariant || isSecondaryVariant || isSecondaryGradientVariant || isDashedVariant ? theme.shadows.none : isRedVariant ? theme.shadows.roseGlow : config.shadow;

  const buttonContent = (
    <>
      {Icon && <Icon size={config.iconSize} color={iconColor} />}
      <Text
        className={`uppercase tracking-wide ${
          isDisabled
            ? 'text-white/30'
            : isOutlineVariant
            ? 'text-gray-300'
            : isDashedVariant
            ? 'text-text-secondary'
            : isSecondaryVariant || isSecondaryGradientVariant
            ? 'text-text-primary'
            : isRedVariant
            ? 'text-white'
            : 'text-text-black'
        }`}
        style={{
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          marginLeft: Icon ? theme.spacing.gap.md : 0,
          color: textColor,
        }}>
        {label}
      </Text>
    </>
  );

  const outlineBackgroundColor = isOutlineVariant && !isDisabled && isPressed
    ? theme.colors.background.white5
    : isOutlineVariant && !isDisabled
    ? 'transparent'
    : undefined;

  // Determine border style for dashed variant
  const borderStyle = isDashedVariant ? 'dashed' : 'solid';

  return (
    <Pressable
      className={`${widthClass} ${isDisabled ? '' : 'active:scale-[0.98]'}`}
      style={[
        {
          borderRadius: config.borderRadius,
          ...shadow,
          opacity: isDisabled ? 1 : undefined,
          backgroundColor: outlineBackgroundColor,
          borderWidth: isOutlineVariant || isSecondaryVariant || isSecondaryGradientVariant || isDashedVariant 
            ? (isOutlineVariant || isDashedVariant ? 2 : 1) 
            : 0,
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
        },
        style,
      ]}
      onPress={isDisabled ? undefined : onPress}
      onPressIn={() => !isDisabled && setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={isDisabled}>
      {isOutlineVariant || isSecondaryVariant || isDashedVariant ? (
        <View
          style={{
            borderRadius: config.borderRadius,
            paddingVertical: config.paddingVertical,
            paddingHorizontal: theme.spacing.padding.base,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isSecondaryVariant && !isDisabled ? theme.colors.background.overlay : undefined,
          }}>
          {buttonContent}
        </View>
      ) : (
      <LinearGradient
          colors={gradientColors}
          start={{ x: isSecondaryGradientVariant ? 0 : 0, y: isSecondaryGradientVariant ? 0 : 0 }}
          end={{ x: isSecondaryGradientVariant ? 1 : 1, y: isSecondaryGradientVariant ? 1 : 0 }}
        style={{
          borderRadius: config.borderRadius,
          paddingVertical: config.paddingVertical,
          paddingHorizontal: theme.spacing.padding.base,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {buttonContent}
      </LinearGradient>
      )}
    </Pressable>
  );
}
