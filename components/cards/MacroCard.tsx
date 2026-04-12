import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './GenericCard';

type MacroCardProps = {
  name: string;
  percentage: number;
  amount: string;
  goal: number;
  color: string;
  progressColor: string;
  forceVertical?: boolean;
};

export function MacroCard({
  name,
  percentage,
  amount,
  goal,
  color,
  progressColor,
  forceVertical = false,
}: MacroCardProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const isNarrow = windowWidth < 380;

  // Map common macro names to their short versions if available
  const getResponsiveName = () => {
    if (!isNarrow) {
      return name;
    }

    const lowerName = name.toLowerCase();
    // Use the localized protein/carbs/fat name to match if possible,
    // but typically the name passed in is already translated (e.g., "Proteína").
    // We'll check if it matches the current translation of the macro names.
    if (lowerName === t('food.macros.protein').toLowerCase()) {
      return t('food.macros.proteinShort');
    }
    if (lowerName === t('food.macros.carbs').toLowerCase()) {
      return t('food.macros.carbsShort');
    }
    if (lowerName === t('food.macros.fat').toLowerCase()) {
      return t('food.macros.fatShort');
    }

    return name;
  };

  const displayName = getResponsiveName();

  return (
    <GenericCard variant="default" size="sm">
      <View className="p-4">
        <View className="mb-1 flex-row items-baseline gap-1">
          <Text className="text-sm text-text-secondary">{displayName}</Text>
          <Text className="text-sm font-semibold" style={{ color }}>
            {percentage % 1 === 0
              ? formatInteger(percentage, { useGrouping: false })
              : formatRoundedDecimal(percentage, 1)}
            %
          </Text>
        </View>

        {forceVertical ? (
          <View className="mb-3">
            <Text className="text-2xl font-bold text-text-primary">{amount}</Text>
            {/*TODO: use i18n*/}
            <Text className="text-sm text-text-secondary">
              / {formatInteger(goal, { useGrouping: false })}g
            </Text>
          </View>
        ) : (
          <View className="mb-3 flex-row items-baseline gap-1">
            <Text className="text-2xl font-bold text-text-primary">{amount}</Text>
            {/*TODO: use i18n*/}
            <Text className="text-sm text-text-secondary">
              / {formatInteger(goal, { useGrouping: false })}g
            </Text>
          </View>
        )}

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
