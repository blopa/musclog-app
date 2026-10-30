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

import {
  type ButtonSize,
  type ButtonVariant,
  getButtonBorder,
  getButtonFill,
  getButtonIconInk,
  getButtonInk,
  getButtonMetrics,
} from '@/components/theme/buttonMetrics';
import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';
import { useTheme } from '@/hooks/useTheme';

type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ThemeButtonProps = {
  label: string;
  labelAccessory?: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
  icon?: LucideIcon | ReactNode | ((props: { size?: number; color?: string }) => ReactNode);
  iconPosition?: 'left' | 'right';
  size?: ButtonSize;
  width?: ThemeButtonWidth;
  /**
   * `rose` / `roseOutline` are the cycle area's period actions ("My period started" / "ended"):
   * the brand's rose without `discard`'s destructive meaning. `gradientCta` marks the one primary
   * action of a screen; it is drawn exactly like `accent` now that buttons are flat.
   */
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: ViewStyle;
  testID?: string;
};

const widthClasses = {
  full: 'w-full',
  'flex-1': 'flex-1',
  'flex-2': 'flex-[2]',
  auto: '',
};

function renderIcon(
  Icon: ThemeButtonProps['icon'],
  size: number,
  color: string,
  iconBgColor: string | undefined,
  loading: boolean
): ReactNode {
  let glyph: ReactNode = null;
  if (loading) {
    glyph = <ActivityIndicator size="small" color={color} />;
  } else if (isValidElement(Icon)) {
    return Icon;
  } else if (typeof Icon === 'function' || (typeof Icon === 'object' && (Icon as any)?.render)) {
    const Comp = Icon as any;
    glyph = <Comp size={size} color={color} />;
  } else if (Icon) {
    return Icon as ReactNode;
  }

  if (glyph && iconBgColor) {
    return (
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBgColor }}
      >
        {glyph}
      </View>
    );
  }

  return glyph;
}

export function Button({
  label,
  labelAccessory,
  onPress,
  icon,
  iconBgColor,
  iconColor: customIconColor,
  iconPosition = 'left',
  size = 'md',
  width = 'auto',
  variant = 'accent',
  disabled = false,
  loading = false,
  style,
  testID,
}: ThemeButtonProps) {
  const theme = useTheme();
  const metrics = getButtonMetrics(theme)[size];
  const [isPressed, setIsPressed] = useState(false);
  const isDisabled = disabled || loading;
  const isOutlined = variant === 'outline' || variant === 'roseOutline' || variant === 'dashed';

  const ink = getButtonInk(theme, variant, isDisabled);
  const iconSize = iconBgColor ? theme.iconSize.sm : metrics.iconSize;
  const iconElement = renderIcon(
    icon,
    iconSize,
    customIconColor ?? getButtonIconInk(theme, variant, isDisabled),
    iconBgColor,
    loading
  );
  const iconRowChild =
    iconElement != null ? (
      // Keeps the icon from shrinking when a long translation wraps the label.
      <View className="shrink-0 items-center justify-center">{iconElement}</View>
    ) : null;
  const showBalanceSpacer = iconRowChild != null && width !== 'auto';

  let pressedFill: string | undefined;
  if (isPressed) {
    pressedFill = isOutlined ? theme.colors.background.ink5 : theme.colors.background.scrim10;
  }

  const accessoryTextStyle: TextStyle = {
    color: variant === 'outline' ? theme.colors.text.tertiary : ink,
    fontSize: Math.max(theme.typography.fontSize.sm, metrics.fontSize - 2),
    fontWeight: theme.typography.fontWeight.medium,
    opacity: variant === 'outline' ? theme.colors.opacity.full : theme.colors.opacity.strong,
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: iconRowChild ? metrics.gap : 0,
        minHeight: metrics.minHeight,
        paddingVertical: metrics.paddingVertical,
        paddingHorizontal: metrics.paddingHorizontal,
        backgroundColor: pressedFill,
        ...(width === 'auto' ? {} : { width: '100%' }),
      }}
    >
      {iconPosition === 'left' ? iconRowChild : null}
      {showBalanceSpacer && iconPosition === 'right' ? (
        <View style={{ width: iconSize, flexShrink: 0 }} />
      ) : null}
      <View
        style={{
          ...(showBalanceSpacer ? { flex: 1 } : {}),
          flexShrink: 1,
          minWidth: 0,
          maxWidth: '100%',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: metrics.fontSize,
            fontWeight: metrics.fontWeight,
            color: ink,
            textAlign: 'center',
            flexShrink: 1,
          }}
          maxFontSizeMultiplier={MAX_CHROME_FONT_SCALE}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {label}
          {labelAccessory ? <Text style={accessoryTextStyle}>{`  ${labelAccessory}`}</Text> : null}
        </Text>
      </View>
      {showBalanceSpacer && iconPosition === 'left' ? (
        <View style={{ width: iconSize, flexShrink: 0 }} />
      ) : null}
      {iconPosition === 'right' ? iconRowChild : null}
    </View>
  );

  const buttonStyle: ViewStyle = {
    ...getButtonBorder(theme, variant),
    borderRadius: metrics.borderRadius,
    backgroundColor: getButtonFill(theme, variant, isDisabled),
    overflow: 'hidden',
    // Prevent stretching in flex containers
    alignSelf: 'flex-start',
    minHeight: metrics.minHeight,
    ...(width === 'auto' ? { flexShrink: 0 } : {}),
    ...style,
  };

  if (isDisabled) {
    return (
      <View
        className={widthClasses[width]}
        style={buttonStyle}
        accessibilityRole="button"
        accessibilityState={{ disabled: true, busy: loading }}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      className={widthClasses[width]}
      style={buttonStyle}
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      {...(Platform.OS === 'android' && {
        unstable_pressDelay: 130,
        // Bounded to the button's own radius by the `overflow: hidden` on `buttonStyle`.
        android_ripple: { color: theme.colors.background.ink10, borderless: false },
      })}
    >
      {content}
    </Pressable>
  );
}
