import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ImageSourcePropType, ScrollView, Text, View } from 'react-native';

import { FoodSearchItemCard } from '@/components/cards/FoodSearchItemCard';
import { MealType } from '@/database/models';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { type UseMealsResultBasic } from '@/hooks/useMeals';
import { useNutritionLogs } from '@/hooks/useNutritionLogs';
import { useTheme } from '@/hooks/useTheme';
import { type UnifiedFoodResult } from '@/hooks/useUnifiedFoodSearch';
import { resolveRoundedPer100gCaloriesForDisplay } from '@/utils/inferCaloriesFromMacros';

import { FullScreenModal } from './FullScreenModal';

type FoodItem = UnifiedFoodResult & {
  icon?: string; // Emoji
  iconName?: string; // Lucide icon name, e.g. 'utensils-crossed'
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
  lastGramWeight?: number;
};

type RecentNutritionHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  onFoodClick: (food: FoodItem) => void;
  portion100gName?: string;
  mealType?: MealType;
};

export function RecentNutritionHistoryModal({
  visible,
  onClose,
  onFoodClick,
  portion100gName = '100g',
  mealType,
}: RecentNutritionHistoryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { recentFoods: recentFoodsRaw, isLoading } = useNutritionLogs({
    mode: 'recent',
    mealType,
    visible,
    enableReactivity: true,
    initialLimit: 50,
  }) as UseMealsResultBasic & { recentFoods: any[] };

  const foods = useMemo(() => {
    return (recentFoodsRaw || []).map((item) => {
      const food = item.food;

      return {
        id: food.id,
        name: food.name ?? '',
        description: t('foodSearch.foodDescriptionPer100g', {
          brand: food.brand || t('foodSearch.customFoodLabel'),
          calories: formatInteger(
            resolveRoundedPer100gCaloriesForDisplay({
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
            })
          ),
        }),
        brand: food.brand,
        serving_size: portion100gName,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        imageUrl: food.imageUrl,
        source: 'local',
        iconName: 'utensils-crossed',
        iconColor: theme.colors.accent.primary,
        iconBgColor: theme.colors.accent.primary10,
        lastGramWeight: item.lastGramWeight,
        _raw: food,
      } as FoodItem;
    });
  }, [
    recentFoodsRaw,
    t,
    formatInteger,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    portion100gName,
  ]);

  return (
    <FullScreenModal
      debugKey="RecentNutritionHistoryModal"
      visible={visible}
      onClose={onClose}
      title={t('foodSearch.recentHistory')}
      scrollable={false}
    >
      <View className="flex-1 bg-bg-primary">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: theme.spacing.padding.base,
            paddingBottom: theme.size['20'],
            backgroundColor: theme.colors.background.primary,
          }}
        >
          <View className="gap-1.5">
            {isLoading ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="small" color={theme.colors.accent.primary} />
              </View>
            ) : foods.length > 0 ? (
              <>
                {foods.map((food) => (
                  <FoodSearchItemCard
                    key={food.id}
                    food={food}
                    onAddPress={() => onFoodClick(food)}
                  />
                ))}
              </>
            ) : (
              <View className="py-8 text-center">
                <Text className="text-center text-text-tertiary">
                  {t('foodSearch.noRecentFoods')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </FullScreenModal>
  );
}
