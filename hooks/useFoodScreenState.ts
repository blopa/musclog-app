import { useState } from 'react';

import type { MealGroup, ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import { type MealType } from '@/database/models/NutritionLog';

export function useFoodScreenState() {
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<
    'all' | 'myFoods' | 'openfood' | 'usda' | 'meals'
  >('all');
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
  const [isDailySummaryMenuVisible, setIsDailySummaryMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [isEditCurrentGoalVisible, setIsEditCurrentGoalVisible] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<ResolvedLogEntry | null>(null);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDeleteFoodLoading, setIsDeleteFoodLoading] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [selectedFoodLogDetails, setSelectedFoodLogDetails] = useState<
    (ResolvedLogEntry & { mealType: MealType }) | null
  >(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [addFoodModalPreselectedMealType, setAddFoodModalPreselectedMealType] =
    useState<MealType | null>(null);
  const [isMealMenuVisible, setIsMealMenuVisible] = useState(false);
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [isCreateMealModalVisible, setIsCreateMealModalVisible] = useState(false);
  const [createMealInitialFoods, setCreateMealInitialFoods] = useState<
    { food: Food; amount: number }[]
  >([]);
  const [isDeleteAllMealVisible, setIsDeleteAllMealVisible] = useState(false);
  const [isDeleteAllMealLoading, setIsDeleteAllMealLoading] = useState(false);
  const [isMealActionModalVisible, setIsMealActionModalVisible] = useState(false);
  const [mealActionMode, setMealActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealActionLoading, setIsMealActionLoading] = useState(false);
  const [isMergeDuplicatesVisible, setIsMergeDuplicatesVisible] = useState(false);
  const [isMergeDuplicatesLoading, setIsMergeDuplicatesLoading] = useState(false);
  const [isMealInsightsVisible, setIsMealInsightsVisible] = useState(false);
  const [isMealInsightsLoading, setIsMealInsightsLoading] = useState(false);
  const [isFoodMoveModalVisible, setIsFoodMoveModalVisible] = useState(false);
  const [isFoodMoveLoading, setIsFoodMoveLoading] = useState(false);
  const [isFoodSplitModalVisible, setIsFoodSplitModalVisible] = useState(false);
  const [isFoodSplitLoading, setIsFoodSplitLoading] = useState(false);
  const [isScaleMealPortionModalVisible, setIsScaleMealPortionModalVisible] = useState(false);
  const [isScaleMealPortionLoading, setIsScaleMealPortionLoading] = useState(false);
  const [selectedMealGroup, setSelectedMealGroup] = useState<MealGroup | null>(null);
  const [isMealGroupMenuVisible, setIsMealGroupMenuVisible] = useState(false);
  const [isDeleteMealGroupVisible, setIsDeleteMealGroupVisible] = useState(false);
  const [isDeleteMealGroupLoading, setIsDeleteMealGroupLoading] = useState(false);
  const [isSavedForLaterModalVisible, setIsSavedForLaterModalVisible] = useState(false);
  const [hasSavedForLaterItems, setHasSavedForLaterItems] = useState(false);
  const [isSaveForLaterLoading, setIsSaveForLaterLoading] = useState(false);
  const [isSaveForLaterPortionVisible, setIsSaveForLaterPortionVisible] = useState(false);
  const [saveForLaterPendingLogs, setSaveForLaterPendingLogs] = useState<NutritionLog[] | null>(
    null
  );
  const [saveForLaterPendingMealType, setSaveForLaterPendingMealType] = useState<MealType | null>(
    null
  );
  const [isMealGroupScaleModalVisible, setIsMealGroupScaleModalVisible] = useState(false);
  const [isMealGroupScaleLoading, setIsMealGroupScaleLoading] = useState(false);
  const [isMealGroupActionModalVisible, setIsMealGroupActionModalVisible] = useState(false);
  const [mealGroupActionMode, setMealGroupActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealGroupActionLoading, setIsMealGroupActionLoading] = useState(false);
  const [isMealGroupInsightsVisible, setIsMealGroupInsightsVisible] = useState(false);
  const [isMealGroupInsightsLoading, setIsMealGroupInsightsLoading] = useState(false);
  const [isMealGroupDetailsVisible, setIsMealGroupDetailsVisible] = useState(false);
  const [selectedMealGroupForDetails, setSelectedMealGroupForDetails] = useState<MealGroup | null>(
    null
  );

  const handleFoodMenuPress = (entry: ResolvedLogEntry) => {
    setSelectedFoodItem(entry);
    setIsFoodMenuVisible(true);
  };

  const handleFoodCardPress = (entry: ResolvedLogEntry) => {
    setSelectedFoodLogDetails({ ...entry, mealType: entry.log.type });
  };

  const handleMealGroupMenuPress = (group: MealGroup) => {
    setSelectedMealGroup(group);
    setIsMealGroupMenuVisible(true);
  };

  const handleMealGroupCardPress = (group: MealGroup) => {
    setSelectedMealGroupForDetails(group);
    setIsMealGroupDetailsVisible(true);
  };

  const handleAddFoodToMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddFoodModalPreselectedMealType(mealType);
    setIsAddFoodModalVisible(true);
  };

  const handleMealMenuPress = (mealType: MealType) => {
    setSelectedMealForMenu(mealType);
    setIsMealMenuVisible(true);
  };

  const requestSaveForLater = (logs: NutritionLog[], mealType: MealType) => {
    setSaveForLaterPendingLogs(logs);
    setSaveForLaterPendingMealType(mealType);
    setIsSaveForLaterPortionVisible(true);
  };

  return {
    addFoodModalPreselectedMealType,
    createMealInitialFoods,
    foodSearchInitialTab,
    handleAddFoodToMeal,
    handleFoodCardPress,
    handleFoodMenuPress,
    handleMealGroupCardPress,
    handleMealGroupMenuPress,
    handleMealMenuPress,
    hasSavedForLaterItems,
    isAddFoodModalVisible,
    isCreateCustomFoodVisible,
    isCreateMealModalVisible,
    isDailySummaryMenuVisible,
    isDeleteAllMealLoading,
    isDeleteAllMealVisible,
    isDeleteConfirmationVisible,
    isDeleteFoodLoading,
    isDeleteMealGroupLoading,
    isDeleteMealGroupVisible,
    isDuplicateMode,
    isEditCurrentGoalVisible,
    isFoodDetailsModalVisible,
    isFoodMenuVisible,
    isFoodMoveLoading,
    isFoodMoveModalVisible,
    isFoodSearchModalVisible,
    isFoodSplitLoading,
    isFoodSplitModalVisible,
    isGoalsManagementModalVisible,
    isMealActionLoading,
    isMealActionModalVisible,
    isMealGroupActionLoading,
    isMealGroupActionModalVisible,
    isMealGroupDetailsVisible,
    isMealGroupInsightsLoading,
    isMealGroupInsightsVisible,
    isMealGroupMenuVisible,
    isMealGroupScaleLoading,
    isMealGroupScaleModalVisible,
    isMealInsightsLoading,
    isMealInsightsVisible,
    isMealMenuVisible,
    isMergeDuplicatesLoading,
    isMergeDuplicatesVisible,
    isMyMealsModalVisible,
    isQuickTrackMealModalVisible,
    isSaveForLaterLoading,
    isSaveForLaterPortionVisible,
    isSavedForLaterModalVisible,
    isScaleMealPortionLoading,
    isScaleMealPortionModalVisible,
    mealActionMode,
    mealGroupActionMode,
    requestSaveForLater,
    saveForLaterPendingLogs,
    saveForLaterPendingMealType,
    selectedFoodItem,
    selectedFoodLogDetails,
    selectedMealForMenu,
    selectedMealGroup,
    selectedMealGroupForDetails,
    selectedMealType,
    setAddFoodModalPreselectedMealType,
    setCreateMealInitialFoods,
    setFoodSearchInitialTab,
    setHasSavedForLaterItems,
    setIsAddFoodModalVisible,
    setIsCreateCustomFoodVisible,
    setIsCreateMealModalVisible,
    setIsDailySummaryMenuVisible,
    setIsDeleteAllMealLoading,
    setIsDeleteAllMealVisible,
    setIsDeleteConfirmationVisible,
    setIsDeleteFoodLoading,
    setIsDeleteMealGroupLoading,
    setIsDeleteMealGroupVisible,
    setIsDuplicateMode,
    setIsEditCurrentGoalVisible,
    setIsFoodDetailsModalVisible,
    setIsFoodMenuVisible,
    setIsFoodMoveLoading,
    setIsFoodMoveModalVisible,
    setIsFoodSearchModalVisible,
    setIsFoodSplitLoading,
    setIsFoodSplitModalVisible,
    setIsGoalsManagementModalVisible,
    setIsMealActionLoading,
    setIsMealActionModalVisible,
    setIsMealGroupActionLoading,
    setIsMealGroupActionModalVisible,
    setIsMealGroupDetailsVisible,
    setIsMealGroupInsightsLoading,
    setIsMealGroupInsightsVisible,
    setIsMealGroupMenuVisible,
    setIsMealGroupScaleLoading,
    setIsMealGroupScaleModalVisible,
    setIsMealInsightsLoading,
    setIsMealInsightsVisible,
    setIsMealMenuVisible,
    setIsMergeDuplicatesLoading,
    setIsMergeDuplicatesVisible,
    setIsMyMealsModalVisible,
    setIsQuickTrackMealModalVisible,
    setIsSaveForLaterLoading,
    setIsSaveForLaterPortionVisible,
    setIsSavedForLaterModalVisible,
    setIsScaleMealPortionLoading,
    setIsScaleMealPortionModalVisible,
    setMealActionMode,
    setMealGroupActionMode,
    setSaveForLaterPendingLogs,
    setSaveForLaterPendingMealType,
    setSelectedFoodItem,
    setSelectedFoodLogDetails,
    setSelectedMealForMenu,
    setSelectedMealGroup,
    setSelectedMealGroupForDetails,
    setSelectedMealType,
  };
}
