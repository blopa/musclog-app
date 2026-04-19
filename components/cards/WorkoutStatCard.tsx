import { Wand2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <GenericCard variant="default" size="sm" isPressable={true} onPress={onPress}>
      <View className="items-center p-3">
        <Text className="mb-1 text-xs font-medium text-text-secondary">{title}</Text>
        {typeof value === 'string' && value === '-' ? (
          <Text className="text-3xl font-bold text-text-tertiary">-</Text>
        ) : typeof value === 'string' || typeof value === 'number' ? (
          <Text className="text-3xl font-bold text-text-primary">{value}</Text>
        ) : (
          // React element (ActivityIndicator)
          <View className="h-10 items-center justify-center">{value}</View>
        )}
        <View className="flex-row items-center">
          {unit ? <Text className="mt-0.5 text-sm text-text-secondary">{unit}</Text> : null}
          {isAdjusted ? (
            <View className="ml-1 mt-0.5">
              <Wand2 size={theme.iconSize.xs} color={theme.colors.accent.primary} />
            </View>
          ) : null}
        </View>
      </View>
    </GenericCard>
  );
}
