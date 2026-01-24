import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GenericCard } from './GenericCard';

type WorkoutStatCardProps = {
  title: string;
  value: string | number;
  unit?: string;
  onPress?: () => void;
};

export function WorkoutStatCard({ title, value, unit, onPress }: WorkoutStatCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
      <View className="items-center p-6">
        <Text className="mb-2 text-sm font-medium text-text-secondary">{title}</Text>
        <Text
          className={`text-5xl font-bold ${typeof value === 'string' && value === '-' ? 'text-text-tertiary' : 'text-text-primary'}`}
        >
          {value}
        </Text>
        {unit ? <Text className="mt-1 text-lg text-text-secondary">{unit}</Text> : null}
      </View>
    </GenericCard>
  );
}
