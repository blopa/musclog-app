import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import type { MealShareSummary } from '@/utils/share/shareEnvelope';

interface OpticalMealSharePreviewProps {
  summary: MealShareSummary;
}

export function OpticalMealSharePreview({ summary }: OpticalMealSharePreviewProps) {
  const { t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-xl font-bold text-text-primary">{summary.name}</Text>
        {summary.description ? (
          <Text className="text-sm text-text-secondary">{summary.description}</Text>
        ) : null}
      </View>

      <Text className="text-sm font-bold text-text-primary">
        {t('food.meals.manageMealData.caloriesMacrosFormat', {
          calories: formatInteger(summary.totals.calories),
          carbs: formatRoundedDecimal(summary.totals.carbs, 1),
          fat: formatRoundedDecimal(summary.totals.fat, 1),
          protein: formatRoundedDecimal(summary.totals.protein, 1),
        })}
      </Text>

      <View className="gap-2">
        {summary.ingredients.map((ingredient, index) => {
          const amount = formatRoundedDecimal(ingredient.amount, 2);
          const line =
            ingredient.unit === 'g'
              ? t('opticalTransfer.share.ingredientGrams', {
                  amount,
                  name: ingredient.name,
                })
              : ingredient.unit === 'serving'
                ? t('opticalTransfer.share.ingredientServings', {
                    amount,
                    name: ingredient.name,
                  })
                : t('opticalTransfer.share.ingredientPortions', {
                    amount,
                    name: ingredient.name,
                    portion: ingredient.portionName,
                  });
          return (
            <Text className="text-sm text-text-secondary" key={`${ingredient.name}-${index}`}>
              {line}
            </Text>
          );
        })}
      </View>

      {summary.hasImage ? (
        <Text className="text-sm text-text-secondary">{t('opticalTransfer.share.hasPhoto')}</Text>
      ) : null}
    </View>
  );
}
