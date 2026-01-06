import { Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

type WorkoutStatCardProps = {
  title: string;
  value: string | number;
  unit?: string;
  onPress?: () => void;
};

export function WorkoutStatCard({ title, value, unit, onPress }: WorkoutStatCardProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className="flex-1 items-center rounded-3xl border border-border-accent bg-bg-overlay/80 p-6"
      onPress={onPress}>
      <Text className="mb-2 text-sm font-medium text-text-secondary">{title}</Text>
      <Text
        className={`text-5xl font-bold ${typeof value === 'string' && value === '-' ? 'text-text-tertiary' : 'text-text-primary'}`}>
        {value}
      </Text>
      {unit && <Text className="mt-1 text-lg text-text-secondary">{unit}</Text>}
    </Pressable>
  );
}
