import { AlertCircle, AlertTriangle, Edit3, Info } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { MealIngredient } from '@/components/cards/MealNutritionHighlightCard';
import { CenteredModal } from '@/components/modals/CenteredModal';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { blurFilter } from '@/utils/blurFilter';

import { FoodInfoCard } from './FoodInfoCard';
import { InfoCard } from './InfoCard';

type FoodData = {
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: 'openfood' | 'usda' | 'local' | 'ai' | 'musclog';
};

type NutritionalData = {
  fiber: number;
  sugar?: number;
  saturatedFat: number;
  sodium: number;
  alcohol?: number;
  potassium?: number;
  magnesium?: number;
  zinc?: number;
};

/** How food details were opened: saved food, log, meal, or external catalog (barcode scan / search preload). */
export type FoodDetailsNutritionSectionMode =
  | 'meal'
  | 'foodLog'
  | 'food'
  | 'externalProduct'
  | null;

type FoodNutritionSectionProps = {
  food: FoodData;
  canEdit: boolean;
  showIncompleteWarning?: boolean;
  mode: FoodDetailsNutritionSectionMode;
  onEditPress?: () => void;
  nutritionalData: NutritionalData;
  servingSize: number;
  isLoadingDetails: boolean;
  onTryAnotherSource?: () => void;
  isRefetchingSource?: boolean;
  /** After alternate sources were tried with no usable data — show edit-only message, no "try another" link. */
  alternateSourceNotFound?: boolean;
  caloriesTooLowWarning?: {
    inferredCalories: number;
    onAccept: () => void;
  };
  intuitiveMode?: boolean;
  showName?: boolean;
  /** When provided, shows an info button that opens an ingredients modal. */
  ingredients?: MealIngredient[];
};

export function FoodNutritionSectionCard({
  food,
  canEdit,
  mode,
  onEditPress,
  nutritionalData,
  servingSize,
  isLoadingDetails,
  showIncompleteWarning = false,
  onTryAnotherSource,
  isRefetchingSource = false,
  alternateSourceNotFound = false,
  caloriesTooLowWarning,
  intuitiveMode = false,
  showName = true,
  ingredients,
}: FoodNutritionSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { height: windowHeight } = useWindowDimensions();
  const [ingredientsModalVisible, setIngredientsModalVisible] = useState(false);
  const ingredientsScrollMaxHeight = Math.min(360, Math.round(windowHeight * 0.5));

  const scaleFactor = servingSize / 100;

  const showAdditionalNutrition =
    mode !== 'meal' &&
    ((nutritionalData.fiber ?? 0) > 0 ||
      (nutritionalData.sugar ?? 0) > 0 ||
      (nutritionalData.saturatedFat ?? 0) > 0 ||
      (nutritionalData.sodium ?? 0) > 0 ||
      (nutritionalData.alcohol ?? 0) > 0 ||
      (nutritionalData.potassium ?? 0) > 0 ||
      (nutritionalData.magnesium ?? 0) > 0 ||
      (nutritionalData.zinc ?? 0) > 0);

  const showLoadingOnly = isLoadingDetails && (mode === 'externalProduct' || mode === null);

  return (
    <View className="mt-6">
      <View className="relative">
        <FoodInfoCard food={food} intuitiveMode={intuitiveMode} showName={showName} />
        {canEdit && mode !== 'meal' && onEditPress ? (
          <Pressable
            onPress={onEditPress}
            className="absolute bottom-3 right-3 z-10 h-9 w-9 items-center justify-center rounded-full bg-bg-overlay"
            style={{
              elevation: 2,
              shadowColor: theme.colors.text.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
            }}
          >
            <Edit3 size={theme.iconSize.sm} color={theme.colors.text.secondary} />
          </Pressable>
        ) : null}
        {ingredients && ingredients.length > 0 ? (
          <Pressable
            onPress={() => setIngredientsModalVisible(true)}
            hitSlop={8}
            className="absolute right-3 top-3 z-10 h-9 w-9 items-center justify-center rounded-full bg-bg-overlay"
            style={{
              elevation: 2,
              shadowColor: theme.colors.text.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
            }}
          >
            <Info size={theme.iconSize.sm} color={theme.colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>

      {ingredients && ingredients.length > 0 ? (
        <CenteredModal
          visible={ingredientsModalVisible}
          onClose={() => setIngredientsModalVisible(false)}
          title={t('food.quickTrackMeal.ingredients')}
          subtitle={t('food.quickTrackMeal.ingredientsCount_other', { count: ingredients.length })}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={{ maxHeight: ingredientsScrollMaxHeight, flexGrow: 0 }}
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
                      {intuitiveMode ? '0' : formatRoundedDecimal(ingredient.kcal, 2)} kcal
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </CenteredModal>
      ) : null}

      {showIncompleteWarning ? (
        <View
          className="mt-3 flex-row items-center gap-2 rounded-xl border px-3 py-2"
          style={{
            borderColor: theme.colors.status.warning50,
            backgroundColor: theme.colors.status.warning10,
          }}
        >
          <AlertTriangle size={theme.iconSize.sm} color={theme.colors.status.warning} />
          <Text className="flex-1 text-xs text-text-secondary">
            {t('food.foodDetails.incompleteNutritionWarning')}
          </Text>
        </View>
      ) : null}

      {onTryAnotherSource || isRefetchingSource || alternateSourceNotFound ? (
        isRefetchingSource ? (
          <View className="mt-3 items-center justify-center py-14">
            <View style={{ transform: [{ scale: 2.25 }] }}>
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
            </View>
          </View>
        ) : alternateSourceNotFound ? (
          <View className="mt-3">
            <InfoCard
              variant="warning"
              icon={AlertCircle}
              label={t('food.foodDetails.zeroMacrosNotFoundTitle')}
              message={t('food.foodDetails.zeroMacrosNotFoundBody')}
              expandable={false}
              size="sm"
            />
          </View>
        ) : (
          <View className="mt-3 gap-2">
            <InfoCard
              variant="warning"
              icon={AlertCircle}
              label={t('food.foodDetails.zeroMacrosBannerTitle')}
              message={t('food.foodDetails.zeroMacrosWarningBody')}
              expandable={false}
              size="sm"
            />
            <Pressable onPress={onTryAnotherSource} hitSlop={8} className="self-start">
              <Text
                className="text-xs font-semibold"
                style={{ color: theme.colors.status.warning }}
              >
                {t('food.foodDetails.tryAnotherSource')}
              </Text>
            </Pressable>
          </View>
        )
      ) : null}

      {caloriesTooLowWarning ? (
        <View className="mt-3 gap-2">
          <InfoCard
            variant="warning"
            icon={AlertCircle}
            label={t('food.foodDetails.caloriesTooLowTitle')}
            message={t('food.foodDetails.caloriesTooLowBody', {
              inferred: formatRoundedDecimal(caloriesTooLowWarning.inferredCalories, 1),
            })}
            expandable={false}
            size="sm"
          />
          <Pressable onPress={caloriesTooLowWarning.onAccept} hitSlop={8} className="self-start">
            <Text className="text-xs font-semibold" style={{ color: theme.colors.status.warning }}>
              {t('food.foodDetails.caloriesTooLowAction', {
                inferred: formatRoundedDecimal(caloriesTooLowWarning.inferredCalories, 1),
              })}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {showAdditionalNutrition ? (
        <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
          <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
            {t('food.foodDetails.additionalNutrition')}
          </Text>
          <View className="gap-2">
            {nutritionalData.fiber > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.macros.fiber')}</Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal(nutritionalData.fiber * scaleFactor, 1)}
                  g
                </Text>
              </View>
            ) : null}
            {(nutritionalData.sugar ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.foodDetails.sugars')}</Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal((nutritionalData.sugar ?? 0) * scaleFactor, 1)}
                  g
                </Text>
              </View>
            ) : null}
            {nutritionalData.saturatedFat > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">
                  {t('food.foodDetails.saturatedFat')}
                </Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal(nutritionalData.saturatedFat * scaleFactor, 1)}
                  g
                </Text>
              </View>
            ) : null}
            {nutritionalData.sodium > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.foodDetails.salt')}</Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal(nutritionalData.sodium * scaleFactor, 1)}
                  g
                </Text>
              </View>
            ) : null}
            {(nutritionalData.alcohol ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.macros.alcohol')}</Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal((nutritionalData.alcohol ?? 0) * scaleFactor, 1)}
                  g
                </Text>
              </View>
            ) : null}
            {(nutritionalData.potassium ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">
                  {t('food.foodDetails.potassium')}
                </Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal(
                        (nutritionalData.potassium ?? 0) * scaleFactor * 1000,
                        1
                      )}
                  mg
                </Text>
              </View>
            ) : null}
            {(nutritionalData.magnesium ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">
                  {t('food.foodDetails.magnesium')}
                </Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal(
                        (nutritionalData.magnesium ?? 0) * scaleFactor * 1000,
                        1
                      )}
                  mg
                </Text>
              </View>
            ) : null}
            {(nutritionalData.zinc ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.foodDetails.zinc')}</Text>
                <Text
                  className="text-sm font-medium text-text-primary"
                  style={intuitiveMode ? blurFilter(4) : undefined}
                >
                  {intuitiveMode
                    ? '0'
                    : formatRoundedDecimal((nutritionalData.zinc ?? 0) * scaleFactor * 1000, 2)}
                  mg
                </Text>
              </View>
            ) : null}
            {isLoadingDetails ? (
              <View className="mt-2 flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                <Text className="text-xs text-text-secondary">
                  {t('food.foodDetails.loadingMoreDetails')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : showLoadingOnly ? (
        <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
          <View className="flex-row items-center justify-center gap-2">
            <ActivityIndicator size="small" color={theme.colors.accent.primary} />
            <Text className="text-xs text-text-secondary">
              {t('food.foodDetails.loadingDetails')}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
