import { useTranslation } from 'react-i18next';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { CenteredModal } from '@/components/modals/CenteredModal';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

export type MealIngredient = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  ingredients: MealIngredient[];
  intuitiveMode?: boolean;
};

export function IngredientListModal({
  visible,
  onClose,
  ingredients,
  intuitiveMode = false,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.min(360, Math.round(windowHeight * 0.5));

  return (
    <CenteredModal
      visible={visible}
      onClose={onClose}
      title={t('food.quickTrackMeal.ingredients')}
      subtitle={t('food.quickTrackMeal.ingredientsCount', { count: ingredients.length })}
    >
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={{ maxHeight, flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, flexGrow: 0 }}
      >
        {ingredients.map((ingredient, index) => (
          <View
            key={`${ingredient.name}-${index}`}
            className="flex-row items-center justify-between rounded-lg px-3 py-2.5"
            style={{ backgroundColor: theme.colors.background.white5 }}
          >
            <View className="flex-1 pr-3">
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.colors.text.primary }}
                numberOfLines={1}
              >
                {ingredient.name}
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                {formatRoundedDecimal(ingredient.grams, 2)}g
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="items-end">
                <Text
                  className="text-xs font-bold"
                  style={[
                    { color: theme.colors.accent.primary },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  P {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.protein, 2)}g
                </Text>
                <Text
                  className="text-xs font-bold"
                  style={[
                    { color: theme.colors.status.info },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  C {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.carbs, 2)}g
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-xs font-bold"
                  style={[
                    { color: theme.colors.status.amber },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  F {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.fat, 2)}g
                </Text>
                <Text
                  className="text-xs font-medium"
                  style={[
                    { color: theme.colors.text.secondary },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  {/*TODO: use translations  (common.amount_kcal) */}
                  {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.kcal, 2)} kcal
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </CenteredModal>
  );
}
