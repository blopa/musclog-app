import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity } from 'react-native';

import {
  type IdentifiedItem,
  type MacroEstimate,
  MealEstimationScreen,
} from '@/components/MealEstimationScreen';
import { useSnackbar } from '@/context/SnackbarContext';
import type { MealType } from '@/database/models/NutritionLog';
import { NutritionService } from '@/database/services/NutritionService';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { totalCarbsForFoodSource } from '@/utils/carbsConvention';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

const inferMealTypeFromTime = (date: Date): MealType => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  }
  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }
  if (hour >= 15 && hour < 22) {
    return 'dinner';
  }

  return 'snack';
};

type MealEstimationModalProps = {
  visible: boolean;
  onClose: () => void;
  mealImage: string;
  // In a real app, these would come from your AI service
  aiEstimationData?: {
    totalCalories: number;
    protein: MacroEstimate;
    carbs: MacroEstimate;
    fat: MacroEstimate;
    identifiedItems: IdentifiedItem[];
  };
};

// TODO: remove mocks, check designs and use this
export function MealEstimationModal({
  visible,
  onClose,
  mealImage,
  aiEstimationData,
}: MealEstimationModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const [identifiedItems, setIdentifiedItems] = useState<IdentifiedItem[]>(
    aiEstimationData?.identifiedItems || []
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMealType, setSelectedMealType] = useState<MealType>(() =>
    inferMealTypeFromTime(new Date())
  );
  const [showDatePicker, setShowDatePicker] = useSubModalVisibility(visible);

  // Default estimation data for demo purposes
  const defaultEstimationData = {
    totalCalories: 675,
    protein: { grams: 42, goal: 150, percentage: 28 },
    carbs: { grams: 68, goal: 200, percentage: 45 },
    fat: { grams: 24, goal: 65, percentage: 27 },
    identifiedItems: [
      {
        id: '1',
        name: 'Grilled Chicken Breast',
        weight: '150g',
        calories: 248,
        imageUri: 'https://example.com/chicken.jpg',
      },
      {
        id: '2',
        name: 'Brown Rice',
        weight: '200g',
        calories: 232,
        imageUri: 'https://example.com/rice.jpg',
      },
      {
        id: '3',
        name: 'Steamed Broccoli',
        weight: '100g',
        calories: 35,
        imageUri: 'https://example.com/broccoli.jpg',
      },
      {
        id: '4',
        name: 'Olive Oil',
        weight: '1 tbsp',
        calories: 120,
      },
    ],
  };

  const estimationData = aiEstimationData || defaultEstimationData;

  const handleRetake = () => {
    // TODO: Implement camera retake functionality
    // Close this modal and trigger camera retake
    onClose();
    // In a real app, you would trigger the camera again
    console.log('Retake photo');
  };

  const handleAddItem = () => {
    // TODO: Implement food search modal functionality
    // In a real app, this would open a food search modal
    console.log('Add Item', 'This would open the food search modal');
  };

  const handleEditItem = (item: IdentifiedItem) => {
    // TODO: Implement edit item modal for meal estimation
    // In a real app, this would open an edit modal for the item
    console.log('Edit Item', `Editing ${item.name}`);
  };

  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

  const handleDeleteItem = (itemId: string) => {
    setItemToDeleteId(itemId);
  };

  const confirmDeleteItem = () => {
    if (itemToDeleteId) {
      setIdentifiedItems((prev) => prev.filter((item) => item.id !== itemToDeleteId));
      setItemToDeleteId(null);
    }
  };

  const handleConfirmAndLog = async () => {
    try {
      await NutritionService.logCustomMeal(
        {
          name: t('nutrition.mealEstimation.title'),
          calories: estimationData.totalCalories,
          protein: estimationData.protein.grams,
          // The estimate comes from the LLM, whose prompt uses the net-carbs convention.
          carbs: totalCarbsForFoodSource('ai', {
            carbs: estimationData.carbs.grams,
            fiber: 0,
          }),
          fat: estimationData.fat.grams,
        },
        selectedDate,
        selectedMealType
      );
      showSnackbar('success', t('nutrition.mealEstimation.logged'));
      onClose();
    } catch (error) {
      handleError(error, 'MealEstimationModal.handleConfirmAndLog');
      showSnackbar('error', t('nutrition.mealEstimation.logError'));
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('nutrition.mealEstimation.title')}
      headerRight={
        <TouchableOpacity
          onPress={handleRetake}
          className="flex-row items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: theme.colors.background.ink10,
          }}
        >
          <Camera size={16} color={theme.colors.text.primary} />
          <Text className="text-sm font-medium text-text-primary">
            {t('nutrition.mealEstimation.retake')}
          </Text>
        </TouchableOpacity>
      }
      scrollable={false}
    >
      <MealEstimationScreen
        mealImage={mealImage}
        totalCalories={estimationData.totalCalories}
        protein={estimationData.protein}
        carbs={estimationData.carbs}
        fat={estimationData.fat}
        identifiedItems={identifiedItems}
        onRetake={handleRetake}
        onAddItem={handleAddItem}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
        onConfirmAndLog={handleConfirmAndLog}
        selectedDate={selectedDate}
        selectedMealType={selectedMealType}
        onMealTypeChange={setSelectedMealType}
        onShowDatePicker={() => setShowDatePicker(true)}
      />
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
      />
      <ConfirmationModal
        visible={!!itemToDeleteId}
        onClose={() => setItemToDeleteId(null)}
        onConfirm={confirmDeleteItem}
        title={t('meals.deleteItem.title')}
        message={t('meals.deleteItem.message')}
        confirmLabel={t('meals.deleteItem.delete')}
        cancelLabel={t('meals.deleteItem.cancel')}
        variant="destructive"
      />
    </FullScreenModal>
  );
}
