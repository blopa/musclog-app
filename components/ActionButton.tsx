import { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { layoutActionLabel } from '@/utils/fitText';

/**
 * There are two styles here, not four. `workout`/`food` and `accent`/`neutral` were
 * byte-identical pairs — a union that doubled without gaining any expressive power, and
 * four blocks to keep in step on every palette change instead of two.
 */
export type ActionButtonTone = 'accent' | 'muted';

/** `px-4` and `gap-3` on the tile, in points: the label's room is worked out from them. */
const TILE_PADDING_X = 16;
const TILE_GAP = 12;
const LABEL_MAX_SIZE = 16;
/** Beside the icon the label stays at least this large; below it the icon gives way. */
const LABEL_COMFORTABLE_SIZE = 13;
const LABEL_MIN_SIZE = 10;

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
  const { fontScale } = useWindowDimensions();
  const [tileWidth, setTileWidth] = useState<number | null>(null);
  // "Entrenamiento" does not fit beside an icon in half a narrow screen, least of all at large
  // text, and a label that overflows its tile lands on the next one. The tile measures itself and
  // shrinks the label to its room, then gives up the icon (decorative: the label names the action)
  // before the label gets smaller than it can be read.
  const { showIcon, fontSize } = layoutActionLabel(
    label,
    tileWidth === null ? null : tileWidth - 2 * TILE_PADDING_X,
    {
      iconWidth: theme.iconSize.lg,
      gap: TILE_GAP,
      comfortableSize: LABEL_COMFORTABLE_SIZE,
      maxSize: LABEL_MAX_SIZE,
      minSize: LABEL_MIN_SIZE,
      fontScale,
    }
  );

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
      className="w-full flex-row items-center gap-3 rounded-control px-4 py-3 active:opacity-80"
      style={{ minHeight: theme.size['16'], backgroundColor: config.bgColor }}
      onPress={onPress}
      onLayout={(event) => setTileWidth(event.nativeEvent.layout.width)}
    >
      {showIcon ? (
        <Icon
          size={theme.iconSize.lg}
          color={config.iconColor}
          strokeWidth={theme.strokeWidth.medium}
        />
      ) : null}
      <Text
        className={`min-w-0 flex-1 font-semibold leading-tight ${config.textColor} ${showIcon ? '' : 'text-center'}`}
        style={{ fontSize }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
