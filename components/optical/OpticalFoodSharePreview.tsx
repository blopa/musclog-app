import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { getMassUnitLabel, gramsToDisplay } from '@/utils/unitConversion';
import type { FoodShareSummary } from '@/utils/share/shareEnvelope';

interface OpticalFoodSharePreviewProps {
  summary: FoodShareSummary;
}

/** What a received food is, before the user decides to keep it. Display only. */
export function OpticalFoodSharePreview({ summary }: OpticalFoodSharePreviewProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-xl font-bold text-text-primary">{summary.name}</Text>
        {summary.brand ? (
          <Text className="text-sm text-text-secondary">{summary.brand}</Text>
        ) : null}
      </View>

      <View className="gap-1">
        <Text className="text-xs uppercase text-text-tertiary">
          {t(
            summary.nutritionBasis === 'per_serving'
              ? 'opticalTransfer.share.foodPerServing'
              : 'opticalTransfer.share.foodPer100g'
          )}
        </Text>
        <Text className="text-sm font-bold text-text-primary">
          {t('food.meals.manageMealData.caloriesMacrosFormat', {
            calories: formatInteger(summary.nutrients.calories),
            carbs: formatRoundedDecimal(summary.nutrients.carbs, 1),
            fat: formatRoundedDecimal(summary.nutrients.fat, 1),
            protein: formatRoundedDecimal(summary.nutrients.protein, 1),
          })}
        </Text>
      </View>

      {summary.portions.length > 0 ? (
        <View className="gap-2">
          {summary.portions.map((portion, index) => (
            <Text className="text-sm text-text-secondary" key={`${portion.name}-${index}`}>
              {portion.gramWeight === undefined
                ? portion.name
                : t('opticalTransfer.share.portionWithWeight', {
                    amount: formatRoundedDecimal(gramsToDisplay(portion.gramWeight, units), 1),
                    name: portion.name,
                    unit: getMassUnitLabel(units),
                  })}
            </Text>
          ))}
        </View>
      ) : null}

      {summary.hasImage ? (
        <Text className="text-sm text-text-secondary">{t('opticalTransfer.share.hasPhoto')}</Text>
      ) : null}
    </View>
  );
}
