import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ImageSourcePropType, ScrollView, Text, View } from 'react-native';

import { useFoods } from '../../hooks/useFoods';
import { useTheme } from '../../hooks/useTheme';
import { type UnifiedFoodResult } from '../../hooks/useUnifiedFoodSearch';
import { FoodSearchItemCard } from '../cards/FoodSearchItemCard';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type FoodItem = UnifiedFoodResult & {
  icon?: string; // Emoji
  iconName?: string; // Lucide icon name, e.g. 'utensils-crossed'
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
};

type RecentNutritionHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  onFoodClick: (food: FoodItem) => void;
  portion100gName: string;
};

export function RecentNutritionHistoryModal({
  visible,
  onClose,
  onFoodClick,
  portion100gName,
}: RecentNutritionHistoryModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { foods, isLoading, isLoadingMore, hasMore, loadMore } = useFoods({
    mode: 'list',
    visible,
    enableReactivity: true,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    initialLimit: 20,
    batchSize: 20,
  });

  return (
    <FullScreenModal
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
                {foods.map((food) => {
                  const formatVal = (v: number) => Math.round(v * 100) / 100;
                  const foodItem: FoodItem = {
                    ...food,
                    id: food.id,
                    name: food.name ?? '',
                    description: t('foodSearch.foodDescriptionPer100g', {
                      brand: food.brand || t('foodSearch.customFoodLabel'),
                      calories: formatVal(food.calories ?? 0),
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
                    _raw: food,
                  };
                  return (
                    <FoodSearchItemCard
                      key={food.id}
                      food={foodItem}
                      onAddPress={() => onFoodClick(foodItem)}
                    />
                  );
                })}
                {hasMore ? (
                  <View className="py-3">
                    <Button
                      label={
                        isLoadingMore ? t('foodSearch.loadingMore') : t('foodSearch.loadMoreLocal')
                      }
                      onPress={loadMore}
                      size="sm"
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                      width="full"
                      iconPosition="left"
                    />
                  </View>
                ) : null}
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
