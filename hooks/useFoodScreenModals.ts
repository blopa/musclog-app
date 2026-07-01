import { useCallback, useMemo, useState } from 'react';

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

  const openFoodSearch = useCallback((tab: FoodSearchTab = 'all') => {
    setFoodSearchInitialTab(tab);
    setIsFoodSearchModalVisible(true);
  }, []);

  const closeFoodSearch = useCallback(() => setIsFoodSearchModalVisible(false), []);
  const openCreateCustomFood = useCallback(() => setIsCreateCustomFoodVisible(true), []);
  const closeCreateCustomFood = useCallback(() => setIsCreateCustomFoodVisible(false), []);
  const openMyMeals = useCallback(() => setIsMyMealsModalVisible(true), []);
  const closeMyMeals = useCallback(() => setIsMyMealsModalVisible(false), []);
  const openQuickTrackMeal = useCallback(() => setIsQuickTrackMealModalVisible(true), []);
  const closeQuickTrackMeal = useCallback(() => setIsQuickTrackMealModalVisible(false), []);
  const openDailySummaryMenu = useCallback(() => setIsDailySummaryMenuVisible(true), []);
  const closeDailySummaryMenu = useCallback(() => setIsDailySummaryMenuVisible(false), []);
  const openGoalsManagement = useCallback(() => setIsGoalsManagementModalVisible(true), []);
  const closeGoalsManagement = useCallback(() => setIsGoalsManagementModalVisible(false), []);
  const openEditCurrentGoal = useCallback(() => setIsEditCurrentGoalVisible(true), []);
  const closeEditCurrentGoal = useCallback(() => setIsEditCurrentGoalVisible(false), []);
  const openSavedForLater = useCallback(() => setIsSavedForLaterModalVisible(true), []);
  const closeSavedForLater = useCallback(() => setIsSavedForLaterModalVisible(false), []);
  const requestSaveForLater = useCallback((logs: NutritionLog[], mealType: MealType) => {
    setSaveForLaterPendingLogs(logs);
    setSaveForLaterPendingMealType(mealType);
    setIsSaveForLaterPortionVisible(true);
  }, []);
  const closeSaveForLaterPortionSelector = useCallback(
    () => setIsSaveForLaterPortionVisible(false),
    []
  );
  const clearSaveForLaterPending = useCallback(() => {
    setSaveForLaterPendingLogs(null);
    setSaveForLaterPendingMealType(null);
  }, []);

  return useMemo(
    () => ({
      foodSearch: {
        initialTab: foodSearchInitialTab,
        visible: isFoodSearchModalVisible,
        open: openFoodSearch,
        close: closeFoodSearch,
        setInitialTab: setFoodSearchInitialTab,
      },
      createCustomFood: {
        visible: isCreateCustomFoodVisible,
        open: openCreateCustomFood,
        close: closeCreateCustomFood,
      },
      myMeals: {
        visible: isMyMealsModalVisible,
        open: openMyMeals,
        close: closeMyMeals,
      },
      quickTrackMeal: {
        visible: isQuickTrackMealModalVisible,
        open: openQuickTrackMeal,
        close: closeQuickTrackMeal,
      },
      dailySummaryMenu: {
        visible: isDailySummaryMenuVisible,
        open: openDailySummaryMenu,
        close: closeDailySummaryMenu,
      },
      goalsManagement: {
        visible: isGoalsManagementModalVisible,
        open: openGoalsManagement,
        close: closeGoalsManagement,
      },
      editCurrentGoal: {
        visible: isEditCurrentGoalVisible,
        open: openEditCurrentGoal,
        close: closeEditCurrentGoal,
      },
      savedForLater: {
        hasItems: hasSavedForLaterItems,
        setHasItems: setHasSavedForLaterItems,
        visible: isSavedForLaterModalVisible,
        open: openSavedForLater,
        close: closeSavedForLater,
        isLoading: isSaveForLaterLoading,
        setLoading: setIsSaveForLaterLoading,
        portionSelectorVisible: isSaveForLaterPortionVisible,
        pendingLogs: saveForLaterPendingLogs,
        pendingMealType: saveForLaterPendingMealType,
        request: requestSaveForLater,
        closePortionSelector: closeSaveForLaterPortionSelector,
        clearPending: clearSaveForLaterPending,
      },
    }),
    [
      clearSaveForLaterPending,
      closeCreateCustomFood,
      closeDailySummaryMenu,
      closeEditCurrentGoal,
      closeFoodSearch,
      closeGoalsManagement,
      closeMyMeals,
      closeQuickTrackMeal,
      closeSavedForLater,
      closeSaveForLaterPortionSelector,
      foodSearchInitialTab,
      hasSavedForLaterItems,
      isCreateCustomFoodVisible,
      isDailySummaryMenuVisible,
      isEditCurrentGoalVisible,
      isFoodSearchModalVisible,
      isGoalsManagementModalVisible,
      isMyMealsModalVisible,
      isQuickTrackMealModalVisible,
      isSavedForLaterModalVisible,
      isSaveForLaterLoading,
      isSaveForLaterPortionVisible,
      openCreateCustomFood,
      openDailySummaryMenu,
      openEditCurrentGoal,
      openFoodSearch,
      openGoalsManagement,
      openMyMeals,
      openQuickTrackMeal,
      openSavedForLater,
      requestSaveForLater,
      saveForLaterPendingLogs,
      saveForLaterPendingMealType,
    ]
  );
}
