import { TFunction } from 'i18next';
import { Clock, LucideScale, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { GenericCard } from '@/components/cards/GenericCard';
import type { MealType } from '@/database/models';
import Food from '@/database/models/Food';
import NutritionLog from '@/database/models/NutritionLog';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/lang/lang';
import {
  formatTimeInTimezone,
  formatUtcNormalizedDayIntl,
  MS_PER_SOLAR_DAY,
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
} from '@/utils/calendarDate';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { getMassUnitLabel } from '@/utils/unitConversion';

import { FullScreenModal } from './FullScreenModal';

type LogEntry = {
  log: NutritionLog;
  food: Food | null;
  nutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    alcohol: number;
  };
  gramWeight: number;
  displayName: string;
  mealType: MealType;
};

type FoodMealDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  entry: LogEntry | null;
};

function getMealTypeLabel(mealType: MealType, t: TFunction): string {
  switch (mealType) {
    case 'breakfast':
      return t('food.meals.breakfast');
    case 'lunch':
      return t('food.meals.lunch');
    case 'dinner':
      return t('food.meals.dinner');
    case 'snack':
      return t('food.meals.snack');
    default:
      return t('food.meals.other');
  }
}

function formatLogDateTime(
  logDate: number,
  timezone: string | null | undefined,
  localeTag: string,
  t: TFunction
): string {
  // Format the time as it appeared on the recording-timezone wall clock.
  const timeStr = formatTimeInTimezone(logDate, timezone, localeTag);

  // Compare day keys so "today/yesterday" reflects the recording calendar day.
  const logDayKey = utcNormalizedDayKey(logDate, timezone);
  const todayKey = utcDayKeyFromLocalDate(new Date());
  const yesterdayKey = todayKey - MS_PER_SOLAR_DAY;

  if (logDayKey === todayKey) {
    return `${t('food.header.today')}, ${timeStr}`;
  }

  if (logDayKey === yesterdayKey) {
    return `${t('common.yesterday')}, ${timeStr}`;
  }

  return `${formatUtcNormalizedDayIntl(logDayKey, localeTag)}, ${timeStr}`;
}

export function FoodMealDetailsModal({ visible, onClose, entry }: FoodMealDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units, intuitiveEatingMode } = useSettings();

  if (!entry) {
    return null;
  }

  const { log, food, nutrients, gramWeight, displayName, mealType } = entry;

  // TODO: use a helper function to avoid using nested ternaries
  const nutrientScale =
    log.snapshotBasis === 'per_serving'
      ? log.amount
      : gramWeight > 0
        ? gramWeight / 100
        : 1;
  const micros = food?.micros ?? {};

  const foodData = {
    name: displayName,
    category: food?.brand ?? getMealTypeLabel(mealType, t),
    calories: nutrients.calories,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fat: nutrients.fat,
    source: food?.source as 'openfood' | 'usda' | 'local' | 'ai' | 'musclog' | undefined,
  };

  const nutritionalData = {
    fiber: nutrients.fiber,
    sugar: (micros.sugar ?? 0) * nutrientScale,
    saturatedFat: (micros.saturatedFat ?? 0) * nutrientScale,
    sodium: (micros.sodium ?? 0) * nutrientScale,
    alcohol: nutrients.alcohol,
    potassium: (micros.potassium ?? 0) * nutrientScale,
    magnesium: (micros.magnesium ?? 0) * nutrientScale,
    zinc: (micros.zinc ?? 0) * nutrientScale,
  };

  const massUnit = getMassUnitLabel(units);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formattedGrams = formatDisplayGrams(locale, units, gramWeight);
  const dateTimeLabel = formatLogDateTime(log.date, log.timezone, locale, t);

  const nutriScore = log.loggedNutriscore || food?.nutriscore;
  const ecoScore = log.loggedEcoscore || food?.ecoscore;
  const novaGroup = log.loggedNovaGroup ?? food?.novaGroup;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.logDetails.title')}
      scrollable={false}
    >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing.padding.base, paddingBottom: 40 }}
      >
        <GenericCard variant="highlighted" backgroundVariant="gradient">
          <View className="p-5">
            <Text className="mb-5 text-2xl font-bold text-text-primary">{displayName}</Text>

            <View className="mb-4 flex-row gap-4">
              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {t('food.logDetails.mealType')}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Utensils size={theme.iconSize.md} color={theme.colors.text.primary} />
                  <Text className="text-xl font-bold text-text-primary">
                    {getMealTypeLabel(mealType, t)}
                  </Text>
                </View>
              </View>

              <View
                className="w-px self-stretch"
                style={{ backgroundColor: theme.colors.border.light }}
              />

              <View className="flex-1">
                <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                  {t('food.foodDetails.portionSize')}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <LucideScale size={theme.iconSize.md} color={theme.colors.text.primary} />
                  <Text className="text-xl font-bold text-text-primary">{formattedGrams}</Text>
                  <Text className="text-sm text-text-secondary">{massUnit}</Text>
                </View>
              </View>
            </View>

            <View>
              <Text className="mb-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
                {t('food.logDetails.dateAndTime')}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-semibold text-text-primary">{dateTimeLabel}</Text>
                <Clock size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </View>
            </View>
          </View>
        </GenericCard>

        <FoodNutritionSectionCard
          food={foodData}
          canEdit={false}
          mode="foodLog"
          nutritionalData={nutritionalData}
          servingSize={1}
          servingBasis="per_serving"
          isLoadingDetails={false}
          intuitiveMode={intuitiveEatingMode}
          showName={false}
          nutritionQuality={{
            nutriScore,
            ecoScore,
            novaGroup,
            labels: food?.labels,
          }}
          protein={nutrients.protein}
        />
      </ScrollView>
    </FullScreenModal>
  );
}
