import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from './GenericCard';

export type MealNutritionHighlightCardProps = {
  /** Optional block above the nutrition grid (e.g. meal title + image in LogMealModal). */
  header?: ReactNode;
  /** Optional muted label above the stat columns. */
  caption?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** When greater than zero, shown as a line below the macro grid. */
  fiber?: number;
};

/**
 * Gradient “meal details” card with the same layout as LogMealModal — calories + P/C/F columns.
 */
export function MealNutritionHighlightCard({
  header,
  caption,
  calories,
  protein,
  carbs,
  fat,
  fiber,
}: MealNutritionHighlightCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { width: windowWidth } = useWindowDimensions();

  const narrow = windowWidth < 380;

  const statsMarginTop = header && !caption ? 'mt-6' : caption ? 'mt-3' : '';

  return (
    <GenericCard variant="highlighted" backgroundVariant="gradient">
      <View className="relative">
        <View
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: theme.colors.accent.primary }}
        />

        <View className="relative z-10 px-4 py-4">
          {header}

          {caption ? (
            <Text
              className={`text-sm ${header ? 'mt-4' : ''} mb-2`}
              style={{ color: theme.colors.text.secondary }}
            >
              {caption}
            </Text>
          ) : null}

          <View className={`flex-row gap-2 ${statsMarginTop}`}>
            <View
              className="flex-1 flex-col items-center rounded-lg p-2"
              style={{
                backgroundColor: theme.colors.background.white5,
                alignItems: 'center',
              }}
            >
              <Text
                className="mb-1 text-xs font-medium"
                style={{ color: theme.colors.text.secondary }}
              >
                {t('food.calories')}
              </Text>
              <Text className="text-lg font-bold" style={{ color: theme.colors.text.primary }}>
                {formatRoundedDecimal(calories, 2)}
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                {t('food.common.kcal')}
              </Text>
            </View>

            <View
              className="flex-1 flex-col items-center rounded-lg p-2"
              style={{
                backgroundColor: theme.colors.background.white5,
                alignItems: 'center',
              }}
            >
              <Text
                className="mb-1 text-xs font-medium"
                style={{ color: theme.colors.text.secondary }}
              >
                {narrow ? t('food.macros.proteinShort') : t('food.macros.protein')}
              </Text>
              <Text className="text-lg font-bold" style={{ color: theme.colors.accent.primary }}>
                {formatRoundedDecimal(protein, 2)}
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                g
              </Text>
            </View>

            <View
              className="flex-1 flex-col items-center rounded-lg p-2"
              style={{
                backgroundColor: theme.colors.background.white5,
                alignItems: 'center',
              }}
            >
              <Text
                className="mb-1 text-xs font-medium"
                style={{ color: theme.colors.text.secondary }}
              >
                {narrow ? t('food.macros.carbsShort') : t('food.macros.carbs')}
              </Text>
              <Text className="text-lg font-bold" style={{ color: theme.colors.status.info }}>
                {formatRoundedDecimal(carbs, 2)}
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                g
              </Text>
            </View>

            <View
              className="flex-1 flex-col items-center rounded-lg p-2"
              style={{
                backgroundColor: theme.colors.background.white5,
                alignItems: 'center',
              }}
            >
              <Text
                className="mb-1 text-xs font-medium"
                style={{ color: theme.colors.text.secondary }}
              >
                {narrow ? t('food.macros.fatShort') : t('food.macros.fat')}
              </Text>
              <Text className="text-lg font-bold" style={{ color: theme.colors.status.amber }}>
                {formatRoundedDecimal(fat, 2)}
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                g
              </Text>
            </View>
          </View>

          {fiber != null && fiber > 0.05 ? (
            <Text
              className="mt-3 text-center text-xs"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('food.macroValueFormat', {
                value: formatRoundedDecimal(fiber, 1),
                unit: t('common.units.g'),
                label: t('food.macros.fiber'),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </GenericCard>
  );
}
