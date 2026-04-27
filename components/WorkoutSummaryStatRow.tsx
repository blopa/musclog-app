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
      className={`flex-row items-center justify-between ${showDivider ? 'border-b border-white/5 pb-4' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <View className="rounded-lg p-2" style={{ backgroundColor: iconBgColor }}>
          <Icon size={theme.iconSize.lg} color={iconColor} />
        </View>
        <Text className="text-text-secondary font-medium">{label}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        {showStarIcon ? (
          <Star
            size={theme.iconSize.sm}
            color={theme.colors.status.amber}
            fill={theme.colors.status.amber}
          />
        ) : null}
        <Text className="text-text-primary text-2xl font-bold tracking-tight">{value}</Text>
        {valueSuffix ? (
          <Text className="text-text-tertiary text-sm font-normal">{valueSuffix}</Text>
        ) : null}
      </View>
    </View>
  );
}
