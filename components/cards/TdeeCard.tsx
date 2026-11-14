import MaterialIcons from '@react-native-vector-icons/material-icons/static';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type TdeeCardProps = {
  tdeeValue?: number;
  subtitle?: string;
  tagText?: string;
};

export function TdeeCard({ tdeeValue = 2000, subtitle, tagText }: TdeeCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatEnergy, unitLabel } = useEnergyUnit();

  return (
    <GenericCard variant="flat">
      <View className="flex flex-col gap-1 p-6">
        {/* Header with icon and title */}
        <View className="flex-row items-center gap-2">
          <MaterialIcons
            name="bolt"
            size={theme.iconSize.lg}
            color={theme.colors.status.brandBright}
          />
          <Text className="text-sm font-medium" style={{ color: theme.colors.status.brandBright }}>
            {t('progress.metabolicSummary')}
          </Text>
        </View>

        {/* Main TDEE value */}
        <Text className="text-3xl font-bold tabular-nums text-text-primary">
          {formatEnergy(tdeeValue)}{' '}
          <Text className="text-lg font-normal text-text-secondary">
            {t('progress.kcalPerDay', { unit: unitLabel })}
          </Text>
        </Text>

        {/* Subtitle */}
        <Text className="mt-1 text-sm text-text-secondary">
          {subtitle || t('progress.currentTdee')}
        </Text>

        <Text className="mt-4 text-xs text-text-tertiary">
          {tagText || t('progress.basedOnRecentActivity')}
        </Text>
      </View>
    </GenericCard>
  );
}
