import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from './GenericCard';

type WorkoutStatCardProps = {
  title: string;
  value: string | number | React.ReactNode;
  unit?: string;
  onPress?: () => void;
};

export function WorkoutStatCard({ title, value, unit, onPress }: WorkoutStatCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
      <View className="items-center p-6">
        <Text className="mb-2 text-sm font-medium text-text-secondary">{title}</Text>
        {typeof value === 'string' && value === '-' ? (
          <Text className="text-5xl font-bold text-text-tertiary">-</Text>
        ) : typeof value === 'string' || typeof value === 'number' ? (
          <Text className="text-5xl font-bold text-text-primary">{value}</Text>
        ) : (
          // React element (ActivityIndicator)
          <View className="h-16 items-center justify-center">{value}</View>
        )}
        {unit ? <Text className="mt-1 text-lg text-text-secondary">{unit}</Text> : null}
      </View>
    </GenericCard>
  );
}
