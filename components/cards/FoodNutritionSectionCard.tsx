import { AlertTriangle, Edit3 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { roundToDecimalPlaces } from '../../utils/roundDecimal';
import { FoodInfoCard } from './FoodInfoCard';

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
};

type FoodNutritionSectionProps = {
  food: FoodData;
  canEdit: boolean;
  showIncompleteWarning?: boolean;
  mode: 'meal' | 'foodLog' | 'food' | 'barcode' | null;
  onEditPress: () => void;
  nutritionalData: NutritionalData;
  servingSize: number;
  isLoadingDetails: boolean;
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
}: FoodNutritionSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const scaleFactor = servingSize / 100;

  const showAdditionalNutrition =
    mode !== 'meal' &&
    ((nutritionalData.fiber ?? 0) > 0 ||
      (nutritionalData.sugar ?? 0) > 0 ||
      (nutritionalData.saturatedFat ?? 0) > 0 ||
      (nutritionalData.sodium ?? 0) > 0);

  const showLoadingOnly =
    isLoadingDetails && mode !== 'meal' && mode !== 'food' && mode !== 'foodLog';

  return (
    <View className="mt-6">
      <View className="relative">
        <FoodInfoCard food={food} />
        {canEdit && mode !== 'meal' ? (
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

      {showAdditionalNutrition ? (
        <View className="mt-4 rounded-2xl border border-border-light bg-bg-overlay p-4">
          <Text className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
            {t('food.foodDetails.additionalNutrition')}
          </Text>
          <View className="gap-2">
            {nutritionalData.fiber > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.macros.fiber')}</Text>
                <Text className="text-sm font-medium text-text-primary">
                  {roundToDecimalPlaces(nutritionalData.fiber * scaleFactor)}g
                </Text>
              </View>
            ) : null}
            {(nutritionalData.sugar ?? 0) > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.foodDetails.sugars')}</Text>
                <Text className="text-sm font-medium text-text-primary">
                  {roundToDecimalPlaces((nutritionalData.sugar ?? 0) * scaleFactor)}g
                </Text>
              </View>
            ) : null}
            {nutritionalData.saturatedFat > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">
                  {t('food.foodDetails.saturatedFat')}
                </Text>
                <Text className="text-sm font-medium text-text-primary">
                  {roundToDecimalPlaces(nutritionalData.saturatedFat * scaleFactor)}g
                </Text>
              </View>
            ) : null}
            {nutritionalData.sodium > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-secondary">{t('food.foodDetails.salt')}</Text>
                <Text className="text-sm font-medium text-text-primary">
                  {roundToDecimalPlaces(nutritionalData.sodium * scaleFactor)}g
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
