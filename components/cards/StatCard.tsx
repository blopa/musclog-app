import { TrendingUp } from 'lucide-react-native';
import { ComponentType, ReactNode, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { fitLabelFontSize } from '@/utils/fitText';

import { GenericCard } from './GenericCard';

/** `text-2xl`: the size a figure is drawn at when it fits. */
const VALUE_MAX_SIZE = 24;
const VALUE_MIN_SIZE = 14;
/** `p-4` on both sides of the card body, in points. */
const CARD_PADDING_X = 16;
/** What the unit beside the figure takes: about 8 points a character at `text-sm`, plus the gap. */
const UNIT_CHAR_WIDTH = 8;
const UNIT_GAP = 4;

type StatCardProps = {
  title: string | ReactNode;
  value: string;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'warning' | 'negative';
  icon: ComponentType<{ size: number; color: string }>;
  iconColor: string;
};

export function StatCard({
  title,
  value,
  unit,
  change,
  changeType,
  icon: Icon,
  iconColor,
}: StatCardProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  // A word-valued stat ("Masculino") is wider than a half-width card at the figure's size and was
  // cut off by the card's edge. It shrinks to the room left beside its unit instead.
  const unitRoom = unit ? (unit.length * UNIT_CHAR_WIDTH + UNIT_GAP) * Math.max(1, fontScale) : 0;
  const valueSize = fitLabelFontSize(
    value,
    cardWidth === null ? null : cardWidth - 2 * CARD_PADDING_X - unitRoom,
    { maxSize: VALUE_MAX_SIZE, minSize: VALUE_MIN_SIZE, fontScale }
  );
  const getChangeColor = () => {
    if (changeType === 'positive') {
      return theme.colors.accent.primary;
    }

    if (changeType === 'negative') {
      return theme.colors.status.error;
    }

    return theme.colors.status.warning;
  };

  const changeColor = getChangeColor();

  return (
    <GenericCard variant="flat" fill>
      <View className="p-4" onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
        <View className="mb-2 flex-row items-start justify-between">
          <Text className="text-sm text-text-secondary">{title}</Text>
          <Icon size={theme.iconSize.sm} color={iconColor} />
        </View>
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text
            className="font-bold tabular-nums text-text-primary"
            style={{ fontSize: valueSize }}
            numberOfLines={1}
          >
            {value}
          </Text>
          {unit ? <Text className="text-sm text-text-secondary">{unit}</Text> : null}
        </View>
        {change ? (
          <View className="flex-row items-center gap-1">
            <TrendingUp size={theme.iconSize.xs} color={changeColor} />
            <Text className="text-xs font-medium" style={{ color: changeColor }}>
              {change}
            </Text>
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
