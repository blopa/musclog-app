import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { MealType } from '@/database/models';
import Food from '@/database/models/Food';
import { formatDisplayGrams } from '@/utils/formatDisplayWeight';
import { getMassUnitLabel } from '@/utils/unitConversion';
import i18n from '@/lang/lang';

import { FullScreenModal } from './FullScreenModal';

type LogEntry = {
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

function getMealTypeLabel(mealType: MealType): string {
  switch (mealType) {
    case 'breakfast':
      return i18n.t('food.meals.breakfast');
    case 'lunch':
      return i18n.t('food.meals.lunch');
    case 'dinner':
      return i18n.t('food.meals.dinner');
    case 'snack':
      return i18n.t('food.meals.snack');
    default:
      return i18n.t('food.meals.other');
  }
}

export function FoodMealDetailsModal({ visible, onClose, entry }: FoodMealDetailsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units, intuitiveEatingMode } = useSettings();

  if (!entry) {
    return null;
  }

  const { food, nutrients, gramWeight, displayName, mealType } = entry;

  // Use per-100g values from food model when available; fall back to computing from logged nutrients
  const scale = gramWeight > 0 ? 100 / gramWeight : 1;
  const per100gCalories = food ? food.calories : nutrients.calories * scale;
  const per100gProtein = food ? food.protein : nutrients.protein * scale;
  const per100gCarbs = food ? food.carbs : nutrients.carbs * scale;
  const per100gFat = food ? food.fat : nutrients.fat * scale;
  const per100gFiber = food ? food.fiber : nutrients.fiber * scale;

  const micros = food?.micros ?? {};

  const foodData = {
    name: displayName,
    category: food?.brand ?? getMealTypeLabel(mealType),
    calories: per100gCalories,
    protein: per100gProtein,
    carbs: per100gCarbs,
    fat: per100gFat,
    source: (food?.source as any) ?? undefined,
  };

  const nutritionalData = {
    fiber: per100gFiber,
    sugar: micros.sugar,
    saturatedFat: micros.saturatedFat ?? 0,
    sodium: micros.sodium ?? 0,
    alcohol: micros.alcohol,
    potassium: micros.potassium,
    magnesium: micros.magnesium,
    zinc: micros.zinc,
  };

  const massUnit = getMassUnitLabel(units);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formattedGrams = formatDisplayGrams(locale, units, gramWeight);

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={displayName} scrollable={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing.padding.base, paddingBottom: 40 }}
      >
        {/* Tracked info row */}
        <View className="mb-2 flex-row items-center gap-3">
          <View
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Text className="text-xs font-semibold" style={{ color: theme.colors.accent.primary }}>
              {getMealTypeLabel(mealType)}
            </Text>
          </View>
          <Text className="text-sm text-text-secondary">
            {t('food.logDetails.trackedAmount', {
              amount: formattedGrams,
              unit: massUnit,
            })}
          </Text>
        </View>

        <FoodNutritionSectionCard
          food={foodData}
          canEdit={false}
          mode="foodLog"
          nutritionalData={nutritionalData}
          servingSize={gramWeight}
          servingBasis="per_100g"
          isLoadingDetails={false}
          intuitiveMode={intuitiveEatingMode}
          showName={false}
        />
      </ScrollView>
    </FullScreenModal>
  );
}
