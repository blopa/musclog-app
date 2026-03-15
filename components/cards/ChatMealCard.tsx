import { Check } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

type MealRow = {
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  wasTracked: boolean;
};

type ChatMealCardProps = {
  meals: MealRow[];
  onViewDetails: (mealType: MealType) => void;
};

export function ChatMealCard({ meals, onViewDetails }: ChatMealCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);

  const getMealLabel = useCallback((mealType: MealType): string => {
    return t(`meals.tags.${mealType}`);
  }, []);

  const getViewMealLabel = useCallback((mealType: MealType): string => {
    return t(`meals.chatMealCard.view${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`);
  }, []);

  return (
    <View
      className="overflow-hidden rounded-2xl rounded-bl-sm"
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        minWidth: theme.size['240'],
      }}
    >
      {/* Summary header */}
      <View className="flex-row items-baseline justify-between px-4 pb-2 pt-4">
        <Text
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: theme.colors.text.tertiary }}
        >
          {t('meals.chatMealCard.mealCount', { count: meals.length })}
        </Text>
        <View className="flex-row items-baseline gap-1">
          <Text className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
            {totalCalories}
          </Text>
          <Text className="text-sm font-medium" style={{ color: theme.colors.text.tertiary }}>
            {t('common.kcal')}
          </Text>
        </View>
      </View>

      {/* Per-meal rows */}
      {meals.map((meal, index) => (
        <View key={meal.mealType}>
          {/* Divider */}
          <View
            style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border.light }}
          />

          <View className="px-4 py-3">
            {/* Meal type label + calories */}
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: theme.colors.text.tertiary }}
              >
                {getMealLabel(meal.mealType)}
              </Text>
              <Text className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
                {meal.calories} {t('common.kcal')}
              </Text>
            </View>

            {/* Macros row */}
            <View
              className="mb-3 flex-row items-center justify-between rounded-lg p-2"
              style={{ backgroundColor: theme.colors.background.primary }}
            >
              <View className="flex-1 items-center">
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

              <View className="h-5 w-px" style={{ backgroundColor: theme.colors.border.light }} />

              <View className="flex-1 items-center">
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

              <View className="h-5 w-px" style={{ backgroundColor: theme.colors.border.light }} />

              <View className="flex-1 items-center">
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

            {/* CTA button */}
            {meal.wasTracked ? (
              <View
                className="flex-row items-center justify-center gap-1.5 rounded-lg py-1.5"
                style={{
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.border.light,
                  opacity: 0.6,
                }}
              >
                <Check size={12} color={theme.colors.accent.primary} />
                <Text className="text-xs font-bold" style={{ color: theme.colors.accent.primary }}>
                  {t('meals.chatMealCard.tracked')}
                </Text>
              </View>
            ) : (
              <Button
                label={getViewMealLabel(meal.mealType)}
                onPress={() => onViewDetails(meal.mealType)}
                size="sm"
                variant="secondary"
                width="full"
                style={{
                  borderColor: `${theme.colors.accent.primary}33`,
                }}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
