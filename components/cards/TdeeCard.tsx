import { MaterialIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

type TdeeCardProps = {
  tdeeValue?: number;
  subtitle?: string;
  tagText?: string;
};

export function TdeeCard({
  tdeeValue = 2000,
  // TODO: use i18n
  subtitle = 'Current TDEE',
  tagText = 'BASED ON RECENT ACTIVITY & NUTRITION',
}: TdeeCardProps) {
  const theme = useTheme();

  return (
    <GenericCard variant="card" backgroundVariant="tdee" size="default">
      <View className="relative z-10 flex flex-col gap-1 p-6">
        {/* Header with icon and title */}
        <View className="flex-row items-center gap-2">
          <MaterialIcons
            name="bolt"
            size={theme.iconSize.lg}
            color={theme.colors.status.emeraldLight}
          />
          <Text className="text-sm font-medium" style={{ color: theme.colors.status.emeraldLight }}>
            Metabolic Summary
          </Text>
        </View>

        {/* Main TDEE value */}
        <Text className="text-3xl font-bold tracking-tight text-white">
          {tdeeValue.toLocaleString()}{' '}
          <Text className="text-lg font-normal text-text-secondary">kcal/day</Text>
        </Text>

        {/* Subtitle */}
        <Text className="mt-1 text-sm text-text-secondary">{subtitle}</Text>

        {/* Tag at bottom */}
        <View
          className="mt-4 flex-row items-center self-start rounded-full px-3 py-1.5"
          style={{ backgroundColor: theme.colors.status.emerald400_10 }}
        >
          <Text
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: theme.colors.status.emeraldLight }}
          >
            {tagText}
          </Text>
        </View>
      </View>
    </GenericCard>
  );
}
