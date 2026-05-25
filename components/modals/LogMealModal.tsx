import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FoodNutritionSectionCard } from '@/components/cards/FoodNutritionSectionCard';
import { FilterTabs } from '@/components/FilterTabs';
import { ServingSizeSelector } from '@/components/ServingSizeSelector';
import { Button } from '@/components/theme/Button';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';

import { DatePickerInput } from './DatePickerInput';
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
    /** Grams the displayed macros refer to; defaults to 100g when omitted. */
    grams?: number;
  };
  ingredients?: Ingredient[];
  initialMealType?: MealType;
  initialDate?: Date;
  onLogMeal: (date: Date, mealType: MealType, portionGrams: number) => void;
};

const MIN_PORTION_G = 1;
const MAX_PORTION_G = 9999;

function clampPortionGrams(g: number): number {
  if (Number.isNaN(g) || !Number.isFinite(g)) {
    return MIN_PORTION_G;
  }
  return Math.min(MAX_PORTION_G, Math.max(MIN_PORTION_G, g));
}

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
  const { intuitiveEatingMode } = useSettings();
  const [selectedDate, setSelectedDate] = useState(() =>
    localCalendarDayDate(initialDate ?? new Date())
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType ?? 'lunch');
  const [isLogging, setIsLogging] = useState(false);

  const referenceGrams = useMemo(() => Math.max(meal.grams ?? 100, 1), [meal.grams]);

  const [portionGrams, setPortionGrams] = useState(referenceGrams);

  useEffect(() => {
    if (visible) {
      const syncGrams = () => {
        setPortionGrams(referenceGrams);
      };
      syncGrams();
    }
  }, [visible, referenceGrams]);

  useEffect(() => {
    if (visible) {
      const syncDateTime = () => {
        setSelectedDate(localCalendarDayDate(initialDate ?? new Date()));
        setSelectedMealType(initialMealType ?? 'lunch');
      };
      syncDateTime();
    }
  }, [visible, initialDate, initialMealType]);

  useEffect(() => {
    if (!visible) {
      const reset = () => {
        setShowDatePicker(false);
      };
      reset();
    }
  }, [visible]);

  const portionScale = portionGrams / referenceGrams;

  const scaledMeal = useMemo(
    () => ({
      calories: meal.calories * portionScale,
      protein: meal.protein * portionScale,
      carbs: meal.carbs * portionScale,
      fat: meal.fat * portionScale,
    }),
    [meal.calories, meal.carbs, meal.fat, meal.protein, portionScale]
  );

  const scaledIngredients = useMemo(
    () =>
      ingredients?.map((ing) => ({
        name: ing.name,
        kcal: ing.kcal * portionScale,
        protein: ing.protein * portionScale,
        carbs: ing.carbs * portionScale,
        fat: ing.fat * portionScale,
        grams: ing.grams * portionScale,
      })),
    [ingredients, portionScale]
  );

  const handlePortionGramsChange = useCallback((g: number) => {
    setPortionGrams(clampPortionGrams(g));
  }, []);

  const handleLogMeal = useCallback(async () => {
    setIsLogging(true);
    await flushLoadingPaint();

    try {
      onLogMeal(selectedDate, selectedMealType, clampPortionGrams(portionGrams));
      onClose();
    } finally {
      setIsLogging(false);
    }
  }, [onClose, onLogMeal, portionGrams, selectedDate, selectedMealType]);

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
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('meals.logMeal')}
      footer={footer}
      scrollable
      closable={!isLogging}
    >
      <View className="mb-6 mt-6 gap-6 px-4">
        <FoodNutritionSectionCard
          food={{
            name: meal.name,
            category: meal.type,
            calories: scaledMeal.calories,
            protein: scaledMeal.protein,
            carbs: scaledMeal.carbs,
            fat: scaledMeal.fat,
          }}
          canEdit={false}
          mode="meal"
          nutritionalData={{ fiber: 0, saturatedFat: 0, sodium: 0 }}
          servingSize={1}
          servingBasis="per_serving"
          isLoadingDetails={false}
          intuitiveMode={intuitiveEatingMode}
          ingredients={scaledIngredients}
        />

        <ServingSizeSelector value={portionGrams} onChange={handlePortionGramsChange} />

        <DatePickerInput
          selectedDate={selectedDate}
          onPress={() => setShowDatePicker(true)}
          label={t('food.foodDetails.date')}
          variant="default"
        />

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

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setShowDatePicker(false);
        }}
      />
    </FullScreenModal>
  );
}
