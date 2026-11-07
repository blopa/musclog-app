import { Star } from 'lucide-react-native';
import { ComponentType } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type StatRowProps = {
  icon: ComponentType<{ size: number; color: string }>;
  label: string;
  value: string | number;
  valueSuffix?: string;
  iconBgColor: string;
  iconColor: string;
  showDivider?: boolean;
  showStarIcon?: boolean;
};

export function WorkoutSummaryStatRow({
  icon: Icon,
  label,
  value,
  valueSuffix,
  iconBgColor,
  iconColor,
  showDivider = true,
  showStarIcon = false,
}: StatRowProps) {
  const theme = useTheme();
  return (
    <View
      className={`flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 ${showDivider ? 'border-b border-ink/5 pb-4' : ''}`}
    >
      {/* The label group takes what the figure leaves (`grow` with a basis, because `flex-1` has
          none and never wraps) and wraps its words. When the figure and its unit cannot sit beside
          it, they drop to their own right-aligned line instead of running past the card's edge. */}
      <View className="min-w-0 grow basis-[140px] flex-row items-center gap-3">
        <View className="shrink-0 rounded-control p-2" style={{ backgroundColor: iconBgColor }}>
          <Icon size={theme.iconSize.lg} color={iconColor} />
        </View>
        <Text className="min-w-0 flex-1 font-medium text-text-secondary">{label}</Text>
      </View>
      <View className="ml-auto shrink-0 flex-row items-center gap-1">
        {showStarIcon ? (
          <Star
            size={theme.iconSize.sm}
            color={theme.colors.status.amber}
            fill={theme.colors.status.amber}
          />
        ) : null}
        <Text className="text-2xl font-bold tabular-nums text-text-primary">{value}</Text>
        {valueSuffix ? (
          <Text className="text-sm font-normal text-text-tertiary">{valueSuffix}</Text>
        ) : null}
      </View>
    </View>
  );
}
