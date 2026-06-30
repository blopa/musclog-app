import { useState } from 'react';

import type Food from '@/database/models/Food';
import { type MealType } from '@/database/models/NutritionLog';

export function useMealUi() {
  const [addFoodModalPreselectedMealType, setAddFoodModalPreselectedMealType] =
    useState<MealType | null>(null);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [isMealMenuVisible, setIsMealMenuVisible] = useState(false);
  const [isCreateMealModalVisible, setIsCreateMealModalVisible] = useState(false);
  const [createMealInitialFoods, setCreateMealInitialFoods] = useState<
    { food: Food; amount: number }[]
  >([]);
  const [isDeleteAllMealVisible, setIsDeleteAllMealVisible] = useState(false);
  const [isDeleteAllMealLoading, setIsDeleteAllMealLoading] = useState(false);
  const [isMealActionModalVisible, setIsMealActionModalVisible] = useState(false);
  const [mealActionMode, setMealActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealActionLoading, setIsMealActionLoading] = useState(false);
  const [isMealInsightsVisible, setIsMealInsightsVisible] = useState(false);
  const [isMealInsightsLoading, setIsMealInsightsLoading] = useState(false);
  const [isScaleMealPortionModalVisible, setIsScaleMealPortionModalVisible] = useState(false);
  const [isScaleMealPortionLoading, setIsScaleMealPortionLoading] = useState(false);
  const [isMergeDuplicatesVisible, setIsMergeDuplicatesVisible] = useState(false);
  const [isMergeDuplicatesLoading, setIsMergeDuplicatesLoading] = useState(false);

  const handleMealMenuPress = (mealType: MealType) => {
    setSelectedMealForMenu(mealType);
    setIsMealMenuVisible(true);
  };

  const handleAddFoodToMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddFoodModalPreselectedMealType(mealType);
    setIsAddFoodModalVisible(true);
  };

  return {
    addFoodModalPreselectedMealType,
    createMealInitialFoods,
    handleAddFoodToMeal,
    handleMealMenuPress,
    isAddFoodModalVisible,
    isCreateMealModalVisible,
    isDeleteAllMealLoading,
    isDeleteAllMealVisible,
    isMealActionLoading,
    isMealActionModalVisible,
    isMealInsightsLoading,
    isMealInsightsVisible,
    isMealMenuVisible,
    isMergeDuplicatesLoading,
    isMergeDuplicatesVisible,
    isScaleMealPortionLoading,
    isScaleMealPortionModalVisible,
    mealActionMode,
    selectedMealForMenu,
    selectedMealType,
    setAddFoodModalPreselectedMealType,
    setCreateMealInitialFoods,
    setIsAddFoodModalVisible,
    setIsCreateMealModalVisible,
    setIsDeleteAllMealLoading,
    setIsDeleteAllMealVisible,
    setIsMealActionLoading,
    setIsMealActionModalVisible,
    setIsMealInsightsLoading,
    setIsMealInsightsVisible,
    setIsMealMenuVisible,
    setIsMergeDuplicatesLoading,
    setIsMergeDuplicatesVisible,
    setIsScaleMealPortionLoading,
    setIsScaleMealPortionModalVisible,
    setMealActionMode,
    setSelectedMealForMenu,
    setSelectedMealType,
  };
}
