import { Dumbbell, UtensilsCrossed } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

type ActionButtonVariant = 'workout' | 'food';

type ActionButtonProps = {
  variant: ActionButtonVariant;
  label: string;
  onPress?: () => void;
};

export function ActionButton({ variant, label, onPress }: ActionButtonProps) {
  const theme = useTheme();

  const variantConfig = {
    workout: {
      bgColor: 'bg-accent-primary',
      iconBgColor: theme.colors.background.workoutIcon,
      icon: Dumbbell,
      iconColor: theme.colors.background.primary,
      textColor: 'text-bg-primary',
      backgroundIconColor: theme.colors.background.primary,
    },
    food: {
      bgColor: 'bg-bg-overlay',
      iconBgColor: theme.colors.background.iconDarker,
      icon: UtensilsCrossed,
      iconColor: theme.colors.text.primary,
      textColor: 'text-text-primary',
      backgroundIconColor: theme.colors.text.muted,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Pressable
      className={`relative flex-1 justify-between overflow-hidden rounded-3xl ${config.bgColor} p-6`}
      style={{ minHeight: theme.size['180'] }}
      onPress={onPress}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: config.iconBgColor }}
      >
        <Icon
          size={theme.iconSize.xl}
          color={config.iconColor}
          strokeWidth={theme.strokeWidth.medium}
        />
      </View>
      <Text className={`text-2xl font-bold leading-tight ${config.textColor}`}>{label}</Text>
      <View
        className="absolute -bottom-6 -right-6"
        style={{ opacity: theme.colors.opacity.veryLight }}
      >
        <Icon
          size={theme.iconSize.background}
          color={config.backgroundIconColor}
          strokeWidth={theme.strokeWidth.thin}
        />
      </View>
    </Pressable>
  );
}
