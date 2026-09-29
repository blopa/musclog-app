import { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * There are two styles here, not four. `workout`/`food` and `accent`/`neutral` were
 * byte-identical pairs — a union that doubled without gaining any expressive power, and
 * four blocks to keep in step on every palette change instead of two.
 */
export type ActionButtonTone = 'accent' | 'muted';

type ToneStyle = {
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
  textColor: string;
  backgroundIconColor: string;
};

type ActionButtonProps = {
  tone: ActionButtonTone;
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
};

export function ActionButton({ tone, label, icon: Icon, onPress }: ActionButtonProps) {
  const theme = useTheme();

  const toneConfig: Record<ActionButtonTone, ToneStyle> = {
    accent: {
      bgColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.background.workoutIcon,
      iconColor: theme.colors.background.primary,
      textColor: 'text-bg-primary',
      backgroundIconColor: theme.colors.background.primary,
    },
    muted: {
      bgColor: theme.colors.background.overlay,
      iconBgColor: theme.colors.background.iconDarker,
      iconColor: theme.colors.text.primary,
      textColor: 'text-text-primary',
      backgroundIconColor: theme.colors.text.muted,
    },
  };

  const config = toneConfig[tone];

  return (
    <Pressable
      className="relative w-full justify-between overflow-hidden rounded-3xl p-6"
      style={{
        minHeight: theme.size['180'],
        backgroundColor: config.bgColor,
      }}
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
