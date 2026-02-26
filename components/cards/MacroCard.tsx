import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

type MacroCardProps = {
  name: string;
  percentage: number;
  amount: string;
  goal: number;
  color: string;
  progressColor: string;
  /** When true, uses smaller text so "amount / goal" fits in one line (used when any macro has large goal) */
  compact?: boolean;
};

export function MacroCard({
  name,
  percentage,
  amount,
  goal,
  color,
  progressColor,
  compact = false,
}: MacroCardProps) {
  const theme = useTheme();
  return (
    <GenericCard variant="default" size="sm">
      <View className="p-4">
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text className="text-sm text-text-secondary">{name}</Text>
          <Text className="text-sm font-semibold" style={{ color }}>
            {percentage}%
          </Text>
        </View>
        <View className="mb-3 flex-row flex-nowrap items-baseline gap-1">
          <Text
            className={
              compact
                ? 'text-xl font-bold text-text-primary'
                : 'text-2xl font-bold text-text-primary'
            }
            numberOfLines={1}
          >
            {amount}
          </Text>
          <Text
            className={compact ? 'text-xs text-text-secondary' : 'text-sm text-text-secondary'}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            / {goal}g
          </Text>
        </View>
        <View
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}
        >
          <View
            className="h-full rounded-full"
            style={{ width: `${percentage}%`, backgroundColor: progressColor }}
          />
        </View>
      </View>
    </GenericCard>
  );
}
