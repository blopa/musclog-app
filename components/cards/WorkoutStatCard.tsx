import { Calculator } from 'lucide-react-native';
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
        <Text className="text-text-secondary mb-1 text-xs font-medium">{title}</Text>
        {typeof value === 'string' && value === '-' ? (
          <Text className="text-text-tertiary text-3xl font-bold">-</Text>
        ) : typeof value === 'string' || typeof value === 'number' ? (
          <Text className="text-text-primary text-3xl font-bold">{value}</Text>
        ) : (
          // React element (ActivityIndicator)
          <View className="h-10 items-center justify-center">{value}</View>
        )}
        <View className="flex-row items-center">
          {unit ? <Text className="text-text-secondary mt-0.5 text-sm">{unit}</Text> : null}
          {isAdjusted ? (
            <View className="mt-0.5 ml-1">
              <Calculator size={theme.iconSize.xs} color={theme.colors.accent.primary} />
            </View>
          ) : null}
        </View>
      </View>
    </GenericCard>
  );
}
