import { useState } from 'react';

import type { ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import { type MealType } from '@/database/models/NutritionLog';
import { closeMenuDialog } from '@/hooks/closeMenuDialog';

type FoodLogDetails = ResolvedLogEntry & { mealType: MealType };
type FoodDialog = null | 'menu' | 'details';

/**
 * UI state of a single food card: its menu and the edit/duplicate sheet it opens. Moving,
 * splitting and deleting a food are not here — they go through `DiaryActionPanels`.
 */
export function useFoodItemUi() {
  const [selectedFoodItem, setSelectedFoodItem] = useState<ResolvedLogEntry | null>(null);
  const [selectedFoodLogDetails, setSelectedFoodLogDetails] = useState<FoodLogDetails | null>(null);
  const [dialog, setDialog] = useState<FoodDialog>(null);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);

  const resetSelection = () => {
    setSelectedFoodItem(null);
    setIsDuplicateMode(false);
  };

  return {
    selectedFoodItem,
    selectedFoodLogDetails,
    isDuplicateMode,
    isFoodMenuVisible: dialog === 'menu',
    isFoodDetailsModalVisible: dialog === 'details',
    handleFoodCardPress: (entry: ResolvedLogEntry) =>
      setSelectedFoodLogDetails({ ...entry, mealType: entry.log.type }),
    handleFoodMenuPress: (entry: ResolvedLogEntry) => {
      setSelectedFoodItem(entry);
      setDialog('menu');
    },
    openEdit: () => {
      setIsDuplicateMode(false);
      setDialog('details');
    },
    openDuplicate: () => {
      setIsDuplicateMode(true);
      setDialog('details');
    },
    closeFoodDetails: () => {
      setDialog(null);
      resetSelection();
    },
    closeFoodMenu: (clearSelection = false) => {
      closeMenuDialog(setDialog);
      if (clearSelection) {
        resetSelection();
      }
    },
    closeFoodLogDetails: () => setSelectedFoodLogDetails(null),
  };
}
