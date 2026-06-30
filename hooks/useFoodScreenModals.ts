import { useState } from 'react';

import type NutritionLog from '@/database/models/NutritionLog';
import { type MealType } from '@/database/models/NutritionLog';

type FoodSearchTab = 'all' | 'myFoods' | 'openfood' | 'usda' | 'meals';

export function useFoodScreenModals() {
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<FoodSearchTab>('all');
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
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
  const [isDailySummaryMenuVisible, setIsDailySummaryMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [isEditCurrentGoalVisible, setIsEditCurrentGoalVisible] = useState(false);

  const clearSaveForLaterPending = () => {
    setSaveForLaterPendingLogs(null);
    setSaveForLaterPendingMealType(null);
  };

  return {
    foodSearch: {
      initialTab: foodSearchInitialTab,
      visible: isFoodSearchModalVisible,
      open: (tab: FoodSearchTab = 'all') => {
        setFoodSearchInitialTab(tab);
        setIsFoodSearchModalVisible(true);
      },
      close: () => setIsFoodSearchModalVisible(false),
      setInitialTab: setFoodSearchInitialTab,
    },
    createCustomFood: {
      visible: isCreateCustomFoodVisible,
      open: () => setIsCreateCustomFoodVisible(true),
      close: () => setIsCreateCustomFoodVisible(false),
    },
    myMeals: {
      visible: isMyMealsModalVisible,
      open: () => setIsMyMealsModalVisible(true),
      close: () => setIsMyMealsModalVisible(false),
    },
    quickTrackMeal: {
      visible: isQuickTrackMealModalVisible,
      open: () => setIsQuickTrackMealModalVisible(true),
      close: () => setIsQuickTrackMealModalVisible(false),
    },
    dailySummaryMenu: {
      visible: isDailySummaryMenuVisible,
      open: () => setIsDailySummaryMenuVisible(true),
      close: () => setIsDailySummaryMenuVisible(false),
    },
    goalsManagement: {
      visible: isGoalsManagementModalVisible,
      open: () => setIsGoalsManagementModalVisible(true),
      close: () => setIsGoalsManagementModalVisible(false),
    },
    editCurrentGoal: {
      visible: isEditCurrentGoalVisible,
      open: () => setIsEditCurrentGoalVisible(true),
      close: () => setIsEditCurrentGoalVisible(false),
    },
    savedForLater: {
      hasItems: hasSavedForLaterItems,
      setHasItems: setHasSavedForLaterItems,
      visible: isSavedForLaterModalVisible,
      open: () => setIsSavedForLaterModalVisible(true),
      close: () => setIsSavedForLaterModalVisible(false),
      isLoading: isSaveForLaterLoading,
      setLoading: setIsSaveForLaterLoading,
      portionSelectorVisible: isSaveForLaterPortionVisible,
      pendingLogs: saveForLaterPendingLogs,
      pendingMealType: saveForLaterPendingMealType,
      request: (logs: NutritionLog[], mealType: MealType) => {
        setSaveForLaterPendingLogs(logs);
        setSaveForLaterPendingMealType(mealType);
        setIsSaveForLaterPortionVisible(true);
      },
      closePortionSelector: () => setIsSaveForLaterPortionVisible(false),
      clearPending: clearSaveForLaterPending,
    },
  };
}
