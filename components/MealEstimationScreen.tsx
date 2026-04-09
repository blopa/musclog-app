import { Edit2, Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './cards/GenericCard';
import { MacroCard } from './cards/MacroCard';
import { Button } from './theme/Button';

export type IdentifiedItem = {
  id: string;
  name: string;
  weight: string;
  calories: number;
  imageUri?: string;
};

type MealEstimationScreenProps = {
  mealImage: string;
  totalCalories: number;
  protein: { amount: string; goal: number; percentage: number };
  carbs: { amount: string; goal: number; percentage: number };
  fat: { amount: string; goal: number; percentage: number };
  identifiedItems: IdentifiedItem[];
  onRetake: () => void;
  onAddItem: () => void;
  onEditItem: (item: IdentifiedItem) => void;
  onDeleteItem: (itemId: string) => void;
  onConfirmAndLog: () => void;
};

// TODO: remove mocks, check designs and use this
export function MealEstimationScreen({
  mealImage,
  totalCalories,
  protein,
  carbs,
  fat,
  identifiedItems,
  onRetake,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onConfirmAndLog,
}: MealEstimationScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();

  const macroColors = {
    protein: theme.colors.status.emerald10,
    proteinProgress: theme.colors.status.emerald30,
    carbs: theme.colors.status.amber,
    carbsProgress: theme.colors.status.amber10,
    fat: theme.colors.status.warning,
    fatProgress: theme.colors.status.warning10,
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Meal Image */}
        <View className="relative">
          <Image source={{ uri: mealImage }} className="h-64 w-full" resizeMode="cover" />
          {/* AI Estimated Badge */}
          <View
            className="absolute left-4 top-4 rounded-full px-3 py-1.5"
            style={{ backgroundColor: theme.colors.accent.primary }}
          >
            <Text className="text-xs font-semibold uppercase text-white">
              {t('nutrition.aiCamera.modes.mealPhoto')} {t('nutrition.aiCamera.estimated')}
            </Text>
          </View>
        </View>

        <View className="p-4">
          {/* Estimated Nutrition Section */}
          <View className="mb-6">
            <Text className="mb-4 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
              {t('nutrition.createMeal.estimated')} {t('nutrition.createMeal.totalNutrition')}
            </Text>

            {/* Total Calories */}
            <View className="mb-4">
              <Text className="text-4xl font-bold" style={{ color: theme.colors.text.primary }}>
                {formatInteger(Math.round(totalCalories))} {t('nutrition.common.kcal')}
              </Text>
            </View>

            {/* Macro Cards */}
            <View className="flex-row gap-3">
              <MacroCard
                name={t('nutrition.macros.protein')}
                percentage={protein.percentage}
                amount={protein.amount}
                goal={protein.goal}
                color={macroColors.protein}
                progressColor={macroColors.proteinProgress}
              />
              <MacroCard
                name={t('nutrition.macros.carbs')}
                percentage={carbs.percentage}
                amount={carbs.amount}
                goal={carbs.goal}
                color={macroColors.carbs}
                progressColor={macroColors.carbsProgress}
              />
              <MacroCard
                name={t('nutrition.macros.fat')}
                percentage={fat.percentage}
                amount={fat.amount}
                goal={fat.goal}
                color={macroColors.fat}
                progressColor={macroColors.fatProgress}
              />
            </View>
          </View>

          {/* Identified Items Section */}
          <View className="mb-6">
            <Text className="mb-4 text-xl font-bold" style={{ color: theme.colors.text.primary }}>
              {t('nutrition.mealEstimation.identifiedItems')}
            </Text>

            {identifiedItems.map((item) => (
              <GenericCard key={item.id} variant="card" containerStyle={{ marginBottom: 12 }}>
                <View className="flex-row items-center p-3">
                  {/* Item Image */}
                  <View
                    className="mr-3 h-12 w-12 rounded-lg"
                    style={{ backgroundColor: theme.colors.background.secondary }}
                  >
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        className="h-full w-full rounded-lg"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="flex h-full w-full items-center justify-center rounded-lg">
                        <Text
                          className="text-lg font-bold"
                          style={{ color: theme.colors.text.tertiary }}
                        >
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Item Details */}
                  <View className="flex-1">
                    <Text
                      className="text-base font-semibold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {item.name}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {item.weight} • {formatInteger(Math.round(item.calories))}{' '}
                      {t('nutrition.common.kcal')}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => onEditItem(item)}
                      className="rounded-lg p-2"
                      style={{ backgroundColor: theme.colors.background.secondary }}
                    >
                      <Edit2 size={16} color={theme.colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDeleteItem(item.id)}
                      className="rounded-lg p-2"
                      style={{ backgroundColor: theme.colors.background.secondary }}
                    >
                      <Trash2 size={16} color={theme.colors.status.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </GenericCard>
            ))}

            {/* Add Item Button */}
            <TouchableOpacity
              onPress={onAddItem}
              className="mt-3 flex-row items-center justify-center rounded-lg border p-4"
              style={{
                borderColor: theme.colors.border.default,
                backgroundColor: theme.colors.background.secondary,
              }}
            >
              <Plus size={20} color={theme.colors.accent.primary} />
              <Text className="ml-2 font-semibold" style={{ color: theme.colors.accent.primary }}>
                {t('nutrition.mealEstimation.addItem')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View
        className="w-full px-4 pb-6 pt-4"
        style={{
          backgroundColor: theme.colors.background.primary,
          borderTopColor: theme.colors.border.default,
          borderTopWidth: 1,
        }}
      >
        <Button
          label={t('nutrition.mealEstimation.confirmAndLog')}
          onPress={onConfirmAndLog}
          variant="gradientCta"
          width="full"
          size="lg"
        />
      </View>
    </View>
  );
}
