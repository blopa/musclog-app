import { LucideIcon, MoreVertical } from 'lucide-react-native';
import { Pressable, ViewStyle } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';

type MenuButtonSize = 'sm' | 'md' | 'lg';

type MenuButtonProps = {
  onPress?: () => void;
  icon?: LucideIcon;
  size?: MenuButtonSize;
  color?: string;
  className?: string;
  style?: ViewStyle;
};

const getSizeConfig = (theme: Theme) => {
  return {
    sm: {
      iconSize: theme.iconSize.sm,
      touchableSize: undefined, // No fixed size for smallest
    },
    md: {
      iconSize: theme.iconSize.md,
      touchableSize: undefined,
    },
    lg: {
      iconSize: theme.iconSize.lg,
      touchableSize: 'h-12 w-12',
    },
  };
};

export function MenuButton({
  onPress,
  icon: Icon = MoreVertical,
  size = 'md',
  color,
  className = '',
  style,
}: MenuButtonProps) {
  const theme = useTheme();
  const sizeConfig = getSizeConfig(theme);
  const config = sizeConfig[size];
  const iconColor = color || theme.colors.text.secondary;

  // TODO: uses classnames
  const touchableClassName = config.touchableSize
    ? `${config.touchableSize} items-center justify-center ${className}`
    : `items-center justify-center ${className}`;

  return (
    // TODO: can we increase the touchable/trigger area of this button to be bigger than it's visual element?
    <Pressable className={touchableClassName} onPress={onPress} style={style}>
      <Icon size={config.iconSize} color={iconColor} />
    </Pressable>
  );
}
