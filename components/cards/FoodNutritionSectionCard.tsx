import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, AlertTriangle, Edit3 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';
import { blurFilter } from '@/utils/blurFilter';

import { FoodInfoCard } from './FoodInfoCard';
import { InfoCard } from './InfoCard';
import { IngredientListModal, MealIngredient } from './IngredientListModal';
import {
  hasNutritionQualityData,
  isHighFiberFood,
  isHighProteinFood,
  type NutritionQualityInput,
} from './nutritionQuality';
import { NutritionQualityData } from './NutritionQualityData';

export type { MealIngredient };

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
  servingBasis?: 'per_100g' | 'per_serving';
  isLoadingDetails: boolean;
  protein?: number;
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
  useQualityAccordion?: boolean;
  ingredients?: MealIngredient[];
  nutritionQuality?: NutritionQualityInput;
};

export function FoodNutritionSectionCard({
  food,
  canEdit,
  mode,
  onEditPress,
  nutritionalData,
  servingSize,
  servingBasis = 'per_100g',
  isLoadingDetails,
  protein,
  showIncompleteWarning = false,
  onTryAnotherSource,
  isRefetchingSource = false,
  alternateSourceNotFound = false,
  caloriesTooLowWarning,
  intuitiveMode = false,
  showName = true,
  ingredients,
  nutritionQuality,
  useQualityAccordion = true,
}: FoodNutritionSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const [ingredientsModalVisible, setIngredientsModalVisible] = useState(false);
  const [nutritionExpanded, setNutritionExpanded] = useState(false);

  const scaleFactor = servingBasis === 'per_serving' ? servingSize : servingSize / 100;
  const highProtein = isHighProteinFood(protein ?? food.protein, food.calories);
  const highFiber = isHighFiberFood(
    food.carbs,
    (nutritionalData.fiber ?? 0) * scaleFactor,
    food.calories
  );

  const resolvedLabels = {
    ...nutritionQuality?.labels,
    highProtein: nutritionQuality?.labels?.highProtein === true || highProtein,
    highFiber: nutritionQuality?.labels?.highFiber === true || highFiber,
  };

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
  const hasQualityData =
    (nutritionQuality != null &&
      hasNutritionQualityData({
        ...nutritionQuality,
        labels: resolvedLabels,
      })) ||
    highProtein ||
    highFiber;
  const hasExpandableNutritionContent = showAdditionalNutrition || hasQualityData;

  const microCount = [
    nutritionalData.fiber > 0,
    (nutritionalData.sugar ?? 0) > 0,
    nutritionalData.saturatedFat > 0,
    nutritionalData.sodium > 0,
    (nutritionalData.alcohol ?? 0) > 0,
    (nutritionalData.potassium ?? 0) > 0,
    (nutritionalData.magnesium ?? 0) > 0,
    (nutritionalData.zinc ?? 0) > 0,
  ].filter(Boolean).length;

  const effectivelyUseAccordion = useQualityAccordion && (hasQualityData || microCount > 2);

  const showLoadingOnly = isLoadingDetails && (mode === 'externalProduct' || mode === null);

  return (
    <View className="mt-6">
      <View className="relative">
        <FoodInfoCard
          food={food}
          intuitiveMode={intuitiveMode}
          showName={showName}
          onInfoPress={
            ingredients && ingredients.length > 0
              ? () => setIngredientsModalVisible(true)
              : undefined
          }
        />
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
      </View>

      {ingredients && ingredients.length > 0 ? (
        <IngredientListModal
          visible={ingredientsModalVisible}
          onClose={() => setIngredientsModalVisible(false)}
          ingredients={ingredients}
          intuitiveMode={intuitiveMode}
        />
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

      <View style={{ overflow: 'hidden' }}>
        <View
          style={
            effectivelyUseAccordion && !nutritionExpanded
              ? { maxHeight: 110, overflow: 'hidden' }
              : undefined
          }
        >
          {nutritionQuality || highProtein || highFiber ? (
            <NutritionQualityData
              nutriScore={nutritionQuality?.nutriScore}
              ecoScore={nutritionQuality?.ecoScore}
              novaGroup={nutritionQuality?.novaGroup}
              labels={resolvedLabels}
              protein={protein ?? food.protein}
              carbs={food.carbs}
              fiber={nutritionalData.fiber}
              calories={food.calories}
            />
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
                      {'g'}
                    </Text>
                  </View>
                ) : null}
                {(nutritionalData.sugar ?? 0) > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text-secondary">
                      {t('food.foodDetails.sugars')}
                    </Text>
                    <Text
                      className="text-sm font-medium text-text-primary"
                      style={intuitiveMode ? blurFilter(4) : undefined}
                    >
                      {intuitiveMode
                        ? '0'
                        : formatRoundedDecimal((nutritionalData.sugar ?? 0) * scaleFactor, 1)}
                      {'g'}
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
                      {'g'}
                    </Text>
                  </View>
                ) : null}
                {nutritionalData.sodium > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text-secondary">
                      {t('food.foodDetails.salt')}
                    </Text>
                    <Text
                      className="text-sm font-medium text-text-primary"
                      style={intuitiveMode ? blurFilter(4) : undefined}
                    >
                      {intuitiveMode
                        ? '0'
                        : formatRoundedDecimal(nutritionalData.sodium * scaleFactor, 1)}
                      {'g'}
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
                      {'g'}
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
                      {'mg'}
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
                      {'mg'}
                    </Text>
                  </View>
                ) : null}
                {(nutritionalData.zinc ?? 0) > 0 ? (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-text-secondary">
                      {t('food.foodDetails.zinc')}
                    </Text>
                    <Text
                      className="text-sm font-medium text-text-primary"
                      style={intuitiveMode ? blurFilter(4) : undefined}
                    >
                      {intuitiveMode
                        ? '0'
                        : formatRoundedDecimal((nutritionalData.zinc ?? 0) * scaleFactor * 1000, 2)}
                      {'mg'}
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

        {effectivelyUseAccordion && !nutritionExpanded && hasExpandableNutritionContent ? (
          <>
            <LinearGradient
              colors={[
                addOpacityToHex(theme.colors.background.primary, 0.5),
                addOpacityToHex(theme.colors.background.primary, 0.78),
                addOpacityToHex(theme.colors.background.primary, 0.94),
                theme.colors.background.primary,
              ]}
              locations={[0, 0.2, 0.42, 0.62]}
              style={{ bottom: 0, height: 100, left: 0, position: 'absolute', right: 0 }}
              pointerEvents="none"
            />
            <Pressable
              onPress={() => setNutritionExpanded(true)}
              hitSlop={12}
              className="items-center py-1"
              style={{ bottom: 0, left: 0, position: 'absolute', right: 0 }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: theme.colors.accent.primary }}
              >
                {t('food.foodDetails.showMoreNutrition')}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
