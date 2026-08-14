import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { formatLocalCalendarDayNumericIntl, parseLocalCalendarDate } from '@/utils/calendarDate';
import type { NutritionDayShareSummary } from '@/utils/share/shareEnvelope';

interface OpticalNutritionDaySharePreviewProps {
  summary: NutritionDayShareSummary;
}

/**
 * What a received day contains, before anything is written.
 *
 * The date is the headline because it is the one thing the user has to agree with: these entries
 * will be filed on that calendar day, and the add-or-replace choice underneath is about what is
 * already there.
 */
export function OpticalNutritionDaySharePreview({ summary }: OpticalNutritionDaySharePreviewProps) {
  const { i18n, t } = useTranslation();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-xl font-bold text-text-primary">
          {formatLocalCalendarDayNumericIntl(parseLocalCalendarDate(summary.dayKey), locale)}
        </Text>
        <Text className="text-sm text-text-secondary">
          {t('opticalTransfer.share.dayEntryCount', { count: summary.entries.length })}
        </Text>
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
        {summary.entries.map((entry, index) => {
          const amount = formatRoundedDecimal(entry.amount, 2);
          const line =
            entry.unit === 'g'
              ? t('opticalTransfer.share.ingredientGrams', { amount, name: entry.name })
              : entry.unit === 'serving'
                ? t('opticalTransfer.share.ingredientServings', { amount, name: entry.name })
                : t('opticalTransfer.share.ingredientPortions', {
                    amount,
                    name: entry.name,
                    portion: entry.portionName,
                  });
          return (
            <Text className="text-sm text-text-secondary" key={`${entry.name}-${index}`}>
              {line}
            </Text>
          );
        })}
      </View>

      {/* A Game Boy records only day + food + grams, so everything lands at midday under "Other".
          Saying so up front stops that reading as data the transfer lost. */}
      {summary.timesUnknown ? (
        <Text className="text-xs text-text-tertiary">
          {t('opticalTransfer.share.dayTimesUnknown')}
        </Text>
      ) : null}
    </View>
  );
}
