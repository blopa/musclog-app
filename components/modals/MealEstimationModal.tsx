import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity } from 'react-native';

import { IdentifiedItem, MealEstimationScreen } from '@/components/MealEstimationScreen';
import type { MealType } from '@/database/models/NutritionLog';
import { NutritionService } from '@/database/services';
import { useTheme } from '@/hooks/useTheme';

import { ConfirmationModal } from './ConfirmationModal';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';

const inferMealTypeFromTime = (date: Date): MealType => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) {return 'breakfast';}
  if (hour >= 11 && hour < 15) {return 'lunch';}
  if (hour >= 15 && hour < 22) {return 'dinner';}
  return 'snack';
};

const parseAmount = (amountStr: string): number => {
  const match = amountStr.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

type MealEstimationModalProps = {
  visible: boolean;
  onClose: () => void;
  mealImage: string;
  // In a real app, these would come from your AI service
  aiEstimationData?: {
    totalCalories: number;
    protein: { amount: string; goal: number; percentage: number };
    carbs: { amount: string; goal: number; percentage: number };
    fat: { amount: string; goal: number; percentage: number };
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
  const [identifiedItems, setIdentifiedItems] = useState<IdentifiedItem[]>(
    aiEstimationData?.identifiedItems || []
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMealType, setSelectedMealType] = useState<MealType>(inferMealTypeFromTime(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Default estimation data for demo purposes
  const defaultEstimationData = {
    totalCalories: 675,
    protein: { amount: '42g', goal: 150, percentage: 28 },
    carbs: { amount: '68g', goal: 200, percentage: 45 },
    fat: { amount: '24g', goal: 65, percentage: 27 },
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
          protein: parseAmount(estimationData.protein.amount),
          carbs: parseAmount(estimationData.carbs.amount),
          fat: parseAmount(estimationData.fat.amount),
        },
        selectedDate,
        selectedMealType
      );
      onClose();
    } catch (error) {
      console.error('Error logging estimated meal:', error);
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
        onDateChange={setSelectedDate}
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
