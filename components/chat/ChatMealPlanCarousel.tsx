import { ArrowRight, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type ChatMealPlanCarouselProps = {
  meals: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }[];
  onSeeAll?: () => void;
  onViewMeal?: (mealId: string) => void;
};

export function ChatMealPlanCarousel({ meals, onSeeAll, onViewMeal }: ChatMealPlanCarouselProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (!meals || meals.length === 0) {
    return null;
  }

  return (
    <View className="mt-2 w-full -mr-10">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingRight: theme.spacing.padding.base,
          gap: theme.spacing.gap.md,
        }}
      >
        {meals.map((meal) => (
          <Pressable
            key={meal.id}
            onPress={() => onViewMeal?.(meal.id)}
            className="rounded-2xl border p-4 active:opacity-70"
            style={{
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.light,
              width: 200,
            }}
          >
            <Text
              className="mb-3 text-sm font-bold leading-tight text-text-primary"
              numberOfLines={2}
            >
              {meal.name}
            </Text>

            <View className="mb-3 flex-row items-baseline gap-1">
              <Text className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
                {meal.calories}
              </Text>
              <Text className="text-xs font-medium" style={{ color: theme.colors.text.tertiary }}>
                {t('common.kcal')}
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="items-center">
                <Text
                  className="text-[10px] font-bold uppercase"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  P
                </Text>
                <Text className="text-xs font-bold" style={{ color: theme.colors.accent.primary }}>
                  {meal.protein}g
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-[10px] font-bold uppercase"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  C
                </Text>
                <Text className="text-xs font-bold" style={{ color: theme.colors.status.indigo }}>
                  {meal.carbs}g
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-[10px] font-bold uppercase"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  F
                </Text>
                <Text className="text-xs font-bold" style={{ color: theme.colors.status.warning }}>
                  {meal.fats}g
                </Text>
              </View>
            </View>
          </Pressable>
        ))}

        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            className="items-center justify-center rounded-2xl border active:opacity-70"
            style={{
              backgroundColor: theme.colors.background.card,
              borderColor: theme.colors.border.light,
              width: 140,
            }}
          >
            <View
              className="mb-2 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.background.primary }}
            >
              <ArrowRight size={20} color={theme.colors.accent.primary} />
            </View>
            <Text className="text-xs font-bold text-text-primary">{t('common.seeAll')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
