import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, TouchableOpacity } from 'react-native';

import { IdentifiedItem, MealEstimationScreen } from '@/components/MealEstimationScreen';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

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

  const handleDeleteItem = (itemId: string) => {
    // TODO: use ConfirmationModal instead and i18n for translations
    Alert.alert(t('meals.deleteItem.title'), t('meals.deleteItem.message'), [
      { text: t('meals.deleteItem.cancel'), style: 'cancel' },
      {
        text: t('meals.deleteItem.delete'),
        style: 'destructive',
        onPress: () => {
          setIdentifiedItems((prev) => prev.filter((item) => item.id !== itemId));
        },
      },
    ]);
  };

  const handleConfirmAndLog = () => {
    // TODO: Implement meal logging functionality
    // In a real app, this would save the meal to your nutrition log
    console.log('Success', 'Meal logged successfully!');
    onClose();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Meal Estimation"
      headerRight={
        <TouchableOpacity
          onPress={handleRetake}
          className="flex-row items-center gap-2 rounded-lg px-3 py-2"
          style={{
            backgroundColor: theme.colors.background.white10,
          }}
        >
          <Camera size={16} color="white" />
          <Text className="text-sm font-medium text-white">Retake</Text>
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
      />
    </FullScreenModal>
  );
}
