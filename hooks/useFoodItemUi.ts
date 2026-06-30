import { useState } from 'react';

import type { ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type NutritionLog from '@/database/models/NutritionLog';
import { type MealType } from '@/database/models/NutritionLog';

export function useFoodItemUi() {
  const [selectedFoodItem, setSelectedFoodItem] = useState<ResolvedLogEntry | null>(null);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [selectedFoodLogDetails, setSelectedFoodLogDetails] = useState<
    (ResolvedLogEntry & { mealType: MealType }) | null
  >(null);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDeleteFoodLoading, setIsDeleteFoodLoading] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [isFoodMoveModalVisible, setIsFoodMoveModalVisible] = useState(false);
  const [isFoodMoveLoading, setIsFoodMoveLoading] = useState(false);
  const [isFoodSplitModalVisible, setIsFoodSplitModalVisible] = useState(false);
  const [isFoodSplitLoading, setIsFoodSplitLoading] = useState(false);

  const handleFoodMenuPress = (entry: ResolvedLogEntry) => {
    setSelectedFoodItem(entry);
    setIsFoodMenuVisible(true);
  };

  const handleFoodCardPress = (entry: ResolvedLogEntry) => {
    setSelectedFoodLogDetails({ ...entry, mealType: entry.log.type });
  };

  return {
    handleFoodCardPress,
    handleFoodMenuPress,
    isDeleteConfirmationVisible,
    isDeleteFoodLoading,
    isDuplicateMode,
    isFoodDetailsModalVisible,
    isFoodMenuVisible,
    isFoodMoveLoading,
    isFoodMoveModalVisible,
    isFoodSplitLoading,
    isFoodSplitModalVisible,
    selectedFoodItem,
    selectedFoodLogDetails,
    setIsDeleteConfirmationVisible,
    setIsDeleteFoodLoading,
    setIsDuplicateMode,
    setIsFoodDetailsModalVisible,
    setIsFoodMenuVisible,
    setIsFoodMoveLoading,
    setIsFoodMoveModalVisible,
    setIsFoodSplitLoading,
    setIsFoodSplitModalVisible,
    setSelectedFoodItem,
    setSelectedFoodLogDetails,
  };
}
