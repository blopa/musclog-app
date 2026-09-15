import { type TFunction } from 'i18next';
import { Apple, Coffee, Edit2, HelpCircle,Moon, Plus, Trash2 , Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { MealType } from '@/database/models/NutritionLog';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './cards/GenericCard';
import { MacroCard } from './cards/MacroCard';
import { DatePickerInput } from './modals/DatePickerInput';
import { OptionsSelector, type SelectorOption } from './OptionsSelector';
import { Button } from './theme/Button';

type Theme = ReturnType<typeof useTheme>;

export const getMealTypeOptions = (theme: Theme, t: TFunction): SelectorOption<MealType>[] => [
  {
    id: 'breakfast',
    label: t('food.meals.breakfast'),
    description: t('food.meals.descriptions.breakfast'),
    icon: Coffee,
    iconBgColor: theme.colors.status.warning10,
    iconColor: theme.colors.status.warning,
  },
  {
    id: 'lunch',
    label: t('food.meals.lunch'),
    description: t('food.meals.descriptions.lunch'),
    icon: Utensils,
    iconBgColor: theme.colors.status.brandVivid || theme.colors.status.info10 || theme.colors.status.info10,
    iconColor: theme.colors.status.brandVivid || theme.colors.status.info,
  },
  {
    id: 'dinner',
    label: t('food.meals.dinner'),
    description: t('food.meals.descriptions.dinner'),
    icon: Moon,
    iconBgColor: theme.colors.status.brandVivid10 || theme.colors.status.info10,
    iconColor: theme.colors.status.brandVivid || theme.colors.status.info,
  },
  {
    id: 'snack',
    label: t('food.meals.snack'),
    description: t('food.meals.descriptions.snack'),
    icon: Apple,
    iconBgColor: theme.colors.status.success20,
    iconColor: theme.colors.status.success,
  },
  {
    id: 'other',
    label: t('food.meals.other'),
    description: t('food.meals.descriptions.other'),
    icon: HelpCircle,
    iconBgColor: theme.colors.background.ink10,
    iconColor: theme.colors.text.secondary,
  },
];

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
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedMealType: MealType;
  onMealTypeChange: (mealType: MealType) => void;
  onShowDatePicker: () => void;
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
  selectedDate,
  selectedMealType,
  onMealTypeChange,
  onShowDatePicker,
}: MealEstimationScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();

  const mealTypeOptions = getMealTypeOptions(theme, t);
  const macroColors = {
    protein: theme.colors.status.brandVivid || theme.colors.status.info10,
    proteinProgress: theme.colors.status.brandVivid || theme.colors.status.info20,
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
              <GenericCard key={item.id} variant="flat" containerStyle={{ marginBottom: 12 }}>
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

      {/* Meal Context Selectors */}
      <View className="px-4 pt-4">
        <View className="mb-4">
          <DatePickerInput
            label={t('food.quickTrackMeal.date')}
            selectedDate={selectedDate}
            onPress={onShowDatePicker}
            variant="default"
          />
        </View>

        <View className="mb-4">
          <OptionsSelector<MealType>
            title={t('food.quickTrackMeal.mealType')}
            options={mealTypeOptions}
            selectedId={selectedMealType}
            onSelect={onMealTypeChange}
          />
        </View>
      </View>

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
