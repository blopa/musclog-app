import { View, Text } from 'react-native';
import { theme } from '../theme';
import { GenericCard } from './cards/GenericCard';

type MacroCardProps = {
  name: string;
  percentage: number;
  amount: string;
  color: string;
  progressColor: string;
};

export function MacroCard({ name, percentage, amount, color, progressColor }: MacroCardProps) {
  return (
    <GenericCard variant="default" size="sm">
      <View className="p-4">
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text className="text-sm text-text-secondary">{name}</Text>
          <Text className="text-sm font-semibold" style={{ color }}>
            {percentage}%
          </Text>
        </View>
        <Text className="mb-3 text-3xl font-bold text-text-primary">{amount}</Text>
        <View
          className="h-1.5 overflow-hidden rounded-full"
          style={{ backgroundColor: theme.colors.background.gray800Opacity50 }}>
          <View
            className="h-full rounded-full"
            style={{ width: `${percentage}%`, backgroundColor: progressColor }}
          />
        </View>
      </View>
    </GenericCard>
  );
}
