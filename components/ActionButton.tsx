import { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * There are two styles here, not four. `workout`/`food` and `accent`/`neutral` were
 * byte-identical pairs — a union that doubled without gaining any expressive power, and
 * four blocks to keep in step on every palette change instead of two.
 */
export type ActionButtonTone = 'accent' | 'muted';

type ToneStyle = {
  bgColor: string;
  iconColor: string;
  textColor: string;
};

type ActionButtonProps = {
  tone: ActionButtonTone;
  label: string;
  icon: LucideIcon;
  onPress?: () => void;
};

/**
 * A compact home tile: the icon beside a short label, vertically centred, nothing else. It used to be a 180px card
 * with a tinted icon circle and a faded watermark copy of the same icon, which took a quarter of
 * the first screen to repeat destinations the tab bar already offers.
 */
export function ActionButton({ tone, label, icon: Icon, onPress }: ActionButtonProps) {
  const theme = useTheme();

  const toneConfig: Record<ActionButtonTone, ToneStyle> = {
    accent: {
      bgColor: theme.colors.accent.primary,
      iconColor: theme.colors.text.onAccent,
      textColor: 'text-text-on-accent',
    },
    muted: {
      bgColor: theme.colors.background.overlay,
      iconColor: theme.colors.text.primary,
      textColor: 'text-text-primary',
    },
  };

  const config = toneConfig[tone];

  return (
    <Pressable
      accessibilityRole="button"
      // The label carries a deliberate line break for the tile; a screen reader reads one phrase.
      accessibilityLabel={label.replace(/\n/g, ' ')}
      className="w-full flex-row items-center gap-4 rounded-2xl px-5 py-4 active:opacity-80"
      style={{ minHeight: theme.size['96'], backgroundColor: config.bgColor }}
      onPress={onPress}
    >
      <Icon
        size={theme.iconSize.xl}
        color={config.iconColor}
        strokeWidth={theme.strokeWidth.medium}
      />
      <Text className={`flex-1 text-lg font-bold leading-tight ${config.textColor}`}>{label}</Text>
    </Pressable>
  );
}
