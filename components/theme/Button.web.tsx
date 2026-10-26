import { LucideIcon } from 'lucide-react-native';
import { isValidElement, ReactNode } from 'react';
import { Text } from 'react-native';

import {
  type ButtonSize,
  type ButtonVariant,
  getButtonBorder,
  getButtonFill,
  getButtonIconInk,
  getButtonInk,
  getButtonMetrics,
} from '@/components/theme/buttonMetrics';
import { useTheme } from '@/hooks/useTheme';

type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ThemeButtonProps = {
  label: string;
  onPress?: () => void;
  iconBgColor?: string;
  iconColor?: string;
  icon?: LucideIcon | ReactNode | ((props: { size?: number; color?: string }) => ReactNode);
  iconPosition?: 'left' | 'right';
  size?: ButtonSize;
  width?: ThemeButtonWidth;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  testID?: string;
};

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
          borderRadius: 9999,
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
  testID,
}: ThemeButtonProps) {
  const theme = useTheme();
  const config = getButtonMetrics(theme)[size];
  const isDisabled = disabled || loading;

  const iconColor = customIconColor ?? getButtonIconInk(theme, variant, isDisabled);
  const iconEl = renderIcon(
    Icon,
    iconBgColor ? theme.iconSize.sm : config.iconSize,
    iconColor,
    iconBgColor
  );
  const border = getButtonBorder(theme, variant);

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
    background: getButtonFill(theme, variant, isDisabled) ?? 'transparent',
    borderWidth: border.borderWidth,
    borderStyle: border.borderStyle,
    borderColor: border.borderColor,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    textAlign: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...getWidthStyle(width),
    ...(style as React.CSSProperties | undefined),
  };

  return (
    <button
      onClick={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={buttonStyle}
      data-testid={testID}
    >
      {iconPosition === 'left' ? iconEl : null}
      {/*
        The label is a react-native-web Text, not a bare span: a <button> does not inherit the page
        font, so its label used to render in the browser's control font, wider than every other
        piece of text in the app.
      */}
      <Text
        style={{
          flexShrink: 1,
          minWidth: 0,
          textAlign: 'center',
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          color: getButtonInk(theme, variant, isDisabled),
        }}
      >
        {loading ? '…' : label}
      </Text>
      {iconPosition === 'right' ? iconEl : null}
    </button>
  );
}
