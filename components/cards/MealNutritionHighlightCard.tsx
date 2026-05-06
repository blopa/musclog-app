import { Info } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { CenteredModal } from '@/components/modals/CenteredModal';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import { GenericCard } from './GenericCard';

export type MealIngredient = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
};

export type MealNutritionHighlightCardProps = {
  /** Optional block above the nutrition grid (e.g. meal title + image in LogMealModal). */
  header?: ReactNode;
  /** Optional muted label above the stat columns. */
  caption?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** When greater than zero, shown as a line below the macro grid. */
  fiber?: number;
  intuitiveMode?: boolean;
  /** When true and ingredients are provided, shows an info button that opens an ingredients modal. */
  showIngredientsInfo?: boolean;
  ingredients?: MealIngredient[];
};

/**
 * Gradient "meal details" card with the same layout as LogMealModal — calories + P/C/F columns.
 */
export function MealNutritionHighlightCard({
  header,
  caption,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  intuitiveMode = false,
  showIngredientsInfo = false,
  ingredients,
}: MealNutritionHighlightCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [ingredientsModalVisible, setIngredientsModalVisible] = useState(false);

  const narrow = windowWidth < 380;
  const ingredientsScrollMaxHeight = Math.min(360, Math.round(windowHeight * 0.5));

  const showInfoButton = showIngredientsInfo && ingredients && ingredients.length > 0;

  let statsMarginTop = '';
  if (header && !caption) {
    statsMarginTop = 'mt-6';
  } else if (caption) {
    statsMarginTop = 'mt-3';
  }

  return (
    <>
      <GenericCard variant="highlighted" backgroundVariant="gradient">
        <View className="relative">
          <View
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: theme.colors.accent.primary }}
          />

          {showInfoButton ? (
            <Pressable
              onPress={() => setIngredientsModalVisible(true)}
              hitSlop={8}
              className="absolute right-3 top-3 z-20 active:opacity-60"
            >
              <Info size={16} color={theme.colors.accent.primary} />
            </Pressable>
          ) : null}

          <View className="relative z-10 px-4 py-4">
            {header}

            {caption ? (
              <Text
                className={`text-sm ${header ? 'mt-4' : ''} mb-2`}
                style={{ color: theme.colors.text.secondary }}
              >
                {caption}
              </Text>
            ) : null}

            <View className={`flex-row gap-2 ${statsMarginTop}`}>
              <View
                className="flex-1 flex-col items-center rounded-lg p-2"
                style={{
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                }}
              >
                <Text
                  className="mb-1 text-xs font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {t('food.calories')}
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={[
                    { color: theme.colors.text.primary },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  {intuitiveMode ? '0' : formatRoundedDecimal(calories, 2)}
                </Text>
                <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  {t('food.common.kcal')}
                </Text>
              </View>

              <View
                className="flex-1 flex-col items-center rounded-lg p-2"
                style={{
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                }}
              >
                <Text
                  className="mb-1 text-xs font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {narrow ? t('food.macros.proteinShort') : t('food.macros.protein')}
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={[
                    { color: theme.colors.accent.primary },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  {intuitiveMode ? '0' : formatRoundedDecimal(protein, 2)}
                </Text>
                <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  g
                </Text>
              </View>

              <View
                className="flex-1 flex-col items-center rounded-lg p-2"
                style={{
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                }}
              >
                <Text
                  className="mb-1 text-xs font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {narrow ? t('food.macros.carbsShort') : t('food.macros.carbs')}
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={[
                    { color: theme.colors.status.info },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  {intuitiveMode ? '0' : formatRoundedDecimal(carbs, 2)}
                </Text>
                <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  g
                </Text>
              </View>

              <View
                className="flex-1 flex-col items-center rounded-lg p-2"
                style={{
                  backgroundColor: theme.colors.background.white5,
                  alignItems: 'center',
                }}
              >
                <Text
                  className="mb-1 text-xs font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {narrow ? t('food.macros.fatShort') : t('food.macros.fat')}
                </Text>
                <Text
                  className="text-lg font-bold"
                  style={[
                    { color: theme.colors.status.amber },
                    intuitiveMode ? blurFilter(4) : undefined,
                  ]}
                >
                  {intuitiveMode ? '0' : formatRoundedDecimal(fat, 2)}
                </Text>
                <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                  g
                </Text>
              </View>
            </View>

            {fiber != null && fiber > 0.05 ? (
              <Text
                className="mt-3 text-center text-xs"
                style={[
                  { color: theme.colors.text.secondary },
                  intuitiveMode ? blurFilter(4) : undefined,
                ]}
              >
                {t('food.macroValueFormat', {
                  value: intuitiveMode ? '0' : formatRoundedDecimal(fiber, 1),
                  unit: t('common.units.g'),
                  label: t('food.macros.fiber'),
                })}
              </Text>
            ) : null}
          </View>
        </View>
      </GenericCard>

      {showInfoButton ? (
        <CenteredModal
          visible={ingredientsModalVisible}
          onClose={() => setIngredientsModalVisible(false)}
          title={t('food.quickTrackMeal.ingredients')}
          subtitle={t('food.quickTrackMeal.ingredientsCount_other', {
            count: ingredients!.length,
          })}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={{ maxHeight: ingredientsScrollMaxHeight, flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, flexGrow: 0 }}
          >
            {ingredients!.map((ingredient, index) => (
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
                      {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.kcal, 2)} kcal
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </CenteredModal>
      ) : null}
    </>
  );
}
