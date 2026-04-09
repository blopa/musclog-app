import classNames from 'classnames';
import { LucideIcon, MoreVertical } from 'lucide-react-native';
import { Pressable, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { Theme } from '@/theme';

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
      touchableSize: undefined,
      padding: 'p-1',
    },
    md: {
      iconSize: theme.iconSize.md,
      touchableSize: undefined,
      padding: 'p-1.5',
    },
    lg: {
      iconSize: theme.iconSize.lg,
      touchableSize: 'h-12 w-12',
      padding: 'p-2',
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

  return (
    <Pressable
      className={classNames(
        'items-center justify-center',
        config.touchableSize,
        config.padding,
        className
      )}
      onPress={onPress}
      style={style}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon size={config.iconSize} color={iconColor} />
    </Pressable>
  );
}
