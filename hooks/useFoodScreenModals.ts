import { useState } from 'react';

import type NutritionLog from '@/database/models/NutritionLog';
import { type MealType } from '@/database/models/NutritionLog';

/** Combined state for the three thin modal clusters on the food screen. */
export function useFoodScreenModals() {
  // Food search / entry
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<
    'all' | 'myFoods' | 'openfood' | 'usda' | 'meals'
  >('all');
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);

  // Save-for-later flow
  const [hasSavedForLaterItems, setHasSavedForLaterItems] = useState(false);
  const [isSavedForLaterModalVisible, setIsSavedForLaterModalVisible] = useState(false);
  const [isSaveForLaterLoading, setIsSaveForLaterLoading] = useState(false);
  const [isSaveForLaterPortionVisible, setIsSaveForLaterPortionVisible] = useState(false);
  const [saveForLaterPendingLogs, setSaveForLaterPendingLogs] = useState<NutritionLog[] | null>(
    null
  );
  const [saveForLaterPendingMealType, setSaveForLaterPendingMealType] = useState<MealType | null>(
    null
  );

  // Daily summary / goals
  const [isDailySummaryMenuVisible, setIsDailySummaryMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [isEditCurrentGoalVisible, setIsEditCurrentGoalVisible] = useState(false);

  const requestSaveForLater = (logs: NutritionLog[], mealType: MealType) => {
    setSaveForLaterPendingLogs(logs);
    setSaveForLaterPendingMealType(mealType);
    setIsSaveForLaterPortionVisible(true);
  };

  return {
    // Food search / entry
    foodSearchInitialTab,
    isCreateCustomFoodVisible,
    isFoodSearchModalVisible,
    isMyMealsModalVisible,
    isQuickTrackMealModalVisible,
    setFoodSearchInitialTab,
    setIsCreateCustomFoodVisible,
    setIsFoodSearchModalVisible,
    setIsMyMealsModalVisible,
    setIsQuickTrackMealModalVisible,
    // Save-for-later
    hasSavedForLaterItems,
    isSaveForLaterLoading,
    isSaveForLaterPortionVisible,
    isSavedForLaterModalVisible,
    requestSaveForLater,
    saveForLaterPendingLogs,
    saveForLaterPendingMealType,
    setHasSavedForLaterItems,
    setIsSaveForLaterLoading,
    setIsSaveForLaterPortionVisible,
    setIsSavedForLaterModalVisible,
    setSaveForLaterPendingLogs,
    setSaveForLaterPendingMealType,
    // Daily summary / goals
    isDailySummaryMenuVisible,
    isEditCurrentGoalVisible,
    isGoalsManagementModalVisible,
    setIsDailySummaryMenuVisible,
    setIsEditCurrentGoalVisible,
    setIsGoalsManagementModalVisible,
  };
}
