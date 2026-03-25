import { Check, Coffee, Info } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { FilterTabs } from '../FilterTabs';
import { Button } from '../theme/Button';
import { CenteredModal } from './CenteredModal';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

type Ingredient = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
};

type LogMealModalProps = {
  visible: boolean;
  onClose: () => void;
  meal: {
    name: string;
    type: string;
    image?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients?: Ingredient[];
  initialMealType?: MealType;
  initialDate?: Date;
  onLogMeal: (date: Date, mealType: MealType) => void;
};

export function LogMealModal({
  visible,
  onClose,
  meal,
  ingredients,
  initialMealType,
  initialDate,
  onLogMeal,
}: LogMealModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType ?? 'lunch');
  const [isLogging, setIsLogging] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);

  const formatDate = useCallback((date: Date) => {
    return date.toISOString().split('T')[0];
  }, []);

  const handleLogMeal = useCallback(async () => {
    setIsLogging(true);
    // Small delay to allow React to render the loading state before closing
    await new Promise((resolve) => setTimeout(resolve, 1));

    try {
      onLogMeal(selectedDate, selectedMealType);
      onClose();
    } finally {
      setIsLogging(false);
    }
  }, [onClose, onLogMeal, selectedDate, selectedMealType]);

  const footer = (
    <Button
      label={t('meals.logMeal')}
      variant="gradientCta"
      size="md"
      width="full"
      icon={Check}
      onPress={handleLogMeal}
      loading={isLogging}
      disabled={isLogging}
    />
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('meals.logMeal')}
        footer={footer}
        scrollable
      >
        <View className="mb-6 mt-6 gap-6 px-4">
          {/* Meal Details Card */}
          <GenericCard variant="highlighted" backgroundVariant="gradient">
            <View className="relative">
              {/* Gradient decoration */}
              <View
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
                style={{ backgroundColor: theme.colors.accent.primary }}
              />

              <View className="relative z-10 px-4 py-4">
                {/* Meal Header */}
                <View className="mb-4 flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="mb-2 flex-row items-center gap-2">
                      <Text
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{
                          color: theme.colors.text.secondary,
                          backgroundColor: theme.colors.background.white5,
                          paddingHorizontal: theme.spacing.padding.xs,
                          paddingVertical: theme.spacing.padding.xsHalf,
                          borderRadius: theme.borderRadius.sm,
                          alignSelf: 'flex-start',
                        }}
                      >
                        {meal.type}
                      </Text>
                      {ingredients && ingredients.length > 0 ? (
                        <Pressable
                          onPress={() => setShowIngredients(true)}
                          hitSlop={8}
                          className="active:opacity-60"
                        >
                          <Info size={16} color={theme.colors.accent.primary} />
                        </Pressable>
                      ) : null}
                    </View>
                    <Text
                      className="mb-1 text-2xl font-bold leading-tight tracking-tight"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.name}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('meals.customMeal')} • {t('meals.createdByYou')}
                    </Text>
                  </View>

                  {meal.image ? (
                    <Image
                      source={{ uri: meal.image }}
                      className="ml-3 h-16 w-16 rounded-lg"
                      style={{ backgroundColor: theme.colors.background.overlay }}
                    />
                  ) : null}
                </View>

                {/* Nutrition Stats */}
                <View className="mt-6 flex-row gap-2">
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
                      style={{ color: theme.colors.text.primary }}
                    >
                      {meal.calories}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      kcal
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
                      {windowWidth < 380
                        ? t('food.macros.proteinShort', 'P')
                        : t('food.macros.protein')}
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      {meal.protein}
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
                      {windowWidth < 380
                        ? t('food.macros.carbsShort', 'C')
                        : t('food.macros.carbs')}
                    </Text>
                    <Text className="text-lg font-bold" style={{ color: theme.colors.status.info }}>
                      {meal.carbs}
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
                      {windowWidth < 380 ? t('food.macros.fatShort', 'F') : t('food.macros.fat')}
                    </Text>
                    <Text
                      className="text-lg font-bold"
                      style={{ color: theme.colors.status.amber }}
                    >
                      {meal.fat}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
                      g
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </GenericCard>

          {/* Date Picker */}
          <View>
            <Text
              className="mb-3 ml-1 text-sm font-semibold"
              style={{ color: theme.colors.text.primary }}
            >
              {t('food.foodDetails.date')}
            </Text>
            <Pressable
              className="flex-row items-center justify-between rounded-xl p-4"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.border.light,
                borderWidth: theme.borderWidth.thin,
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <View className="flex-row items-center gap-3">
                <Coffee size={theme.iconSize.md} color={theme.colors.text.secondary} />
                <Text
                  className="text-base font-medium"
                  style={{ color: theme.colors.text.primary }}
                >
                  {formatDate(selectedDate)}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Meal Type Selector */}
          <View>
            <Text
              className="mb-3 text-xs font-bold uppercase tracking-wider"
              style={{ color: theme.colors.text.secondary }}
            >
              {t('meals.mealType')}
            </Text>
            <FilterTabs
              tabs={[
                { id: 'breakfast', label: t('food.meals.breakfast') },
                { id: 'lunch', label: t('food.meals.lunch') },
                { id: 'dinner', label: t('food.meals.dinner') },
                { id: 'snack', label: t('food.meals.snacks') },
                { id: 'other', label: t('food.meals.other') },
              ]}
              activeTab={selectedMealType}
              onTabChange={(tabId) => setSelectedMealType(tabId as MealType)}
              showContainer={false}
              scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
            />
          </View>
        </View>
      </FullScreenModal>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
      />

      {/* Ingredients Detail Popup */}
      {ingredients && ingredients.length > 0 ? (
        <CenteredModal
          visible={showIngredients}
          onClose={() => setShowIngredients(false)}
          title={meal.type}
          subtitle={`${ingredients.length} ingredients`}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 360 }}
            contentContainerStyle={{ gap: 8 }}
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
                    {ingredient.grams}g
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <View className="items-end">
                    <Text
                      className="text-xs font-bold"
                      style={{ color: theme.colors.accent.primary }}
                    >
                      P {ingredient.protein}g
                    </Text>
                    <Text className="text-xs font-bold" style={{ color: theme.colors.status.info }}>
                      C {ingredient.carbs}g
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className="text-xs font-bold"
                      style={{ color: theme.colors.status.amber }}
                    >
                      F {ingredient.fat}g
                    </Text>
                    <Text
                      className="text-xs font-medium"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      {ingredient.kcal} kcal
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
