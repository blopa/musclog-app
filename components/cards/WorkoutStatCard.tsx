import { Calculator } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type WorkoutStatCardProps = {
  title: string;
  value: string | number | React.ReactNode;
  unit?: string;
  onPress?: () => void;
  isAdjusted?: boolean;
};

export function WorkoutStatCard({ title, value, unit, onPress, isAdjusted }: WorkoutStatCardProps) {
  const theme = useTheme();
  const renderValue = () => {
    if (typeof value === 'string' && value === '-') {
      return <Text className="text-3xl font-bold text-text-tertiary">-</Text>;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return <Text className="text-3xl font-bold text-text-primary">{value}</Text>;
    }

    return <View className="h-10 items-center justify-center">{value}</View>;
  };

  return (
    <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
      <View className="items-center p-3">
        <Text className="mb-1 text-xs font-medium text-text-secondary">{title}</Text>
        {renderValue()}
        <View className="flex-row items-center">
          {unit ? <Text className="mt-0.5 text-sm text-text-secondary">{unit}</Text> : null}
          {isAdjusted ? (
            <View className="ml-1 mt-0.5">
              <Calculator size={theme.iconSize.xs} color={theme.colors.accent.primary} />
            </View>
          ) : null}
        </View>
      </View>
    </GenericCard>
  );
}
