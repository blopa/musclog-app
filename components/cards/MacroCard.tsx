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
};

export function MacroCard({ name, percentage, amount, goal, color, progressColor }: MacroCardProps) {
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
        <View className="mb-3 flex-row items-baseline gap-1">
          <Text className="text-2xl font-bold text-text-primary">{amount}</Text>
          <Text className="text-sm text-text-secondary">/ {goal}g</Text>
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
