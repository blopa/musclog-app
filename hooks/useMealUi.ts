import { useState } from 'react';

import type Food from '@/database/models/Food';
import { type MealType } from '@/database/models/NutritionLog';
import { closeMenuDialog } from '@/hooks/closeMenuDialog';

type CreateMealItem = { food: Food; amount: number };
type MealDialog = null | 'addFood' | 'menu' | 'createMeal' | 'insights' | 'mergeDuplicates';

type MealLoadingState = {
  insights: boolean;
  mergeDuplicates: boolean;
};

const INITIAL_LOADING: MealLoadingState = {
  insights: false,
  mergeDuplicates: false,
};

/**
 * UI state of a meal section: its menu, adding food, building a meal, AI insights and merging
 * duplicates. Copying, moving, splitting, scaling and deleting a section are not here — they go
 * through `DiaryActionPanels`.
 */
export function useMealUi() {
  const [addFoodModalPreselectedMealType, setAddFoodModalPreselectedMealType] =
    useState<MealType | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [createMealInitialFoods, setCreateMealInitialFoods] = useState<CreateMealItem[]>([]);
  const [dialog, setDialog] = useState<MealDialog>(null);
  const [loading, setLoading] = useState<MealLoadingState>(INITIAL_LOADING);

  return {
    addFoodModalPreselectedMealType,
    selectedMealType,
    selectedMealForMenu,
    createMealInitialFoods,
    isAddFoodModalVisible: dialog === 'addFood',
    isMealMenuVisible: dialog === 'menu',
    isCreateMealModalVisible: dialog === 'createMeal',
    isMealInsightsVisible: dialog === 'insights',
    isMergeDuplicatesVisible: dialog === 'mergeDuplicates',
    isMealInsightsLoading: loading.insights,
    isMergeDuplicatesLoading: loading.mergeDuplicates,
    handleMealMenuPress: (mealType: MealType) => {
      setSelectedMealForMenu(mealType);
      setDialog('menu');
    },
    handleAddFoodToMeal: (mealType: MealType) => {
      setAddFoodModalPreselectedMealType(mealType);
      setSelectedMealType(mealType);
      setDialog('addFood');
    },
    openAddFoodModal: (mealType: MealType | null = null) => {
      setAddFoodModalPreselectedMealType(mealType);
      if (mealType != null) {
        setSelectedMealType(mealType);
      }

      setDialog('addFood');
    },
    closeAddFoodModal: () => setDialog(null),
    selectMealType: (mealType: MealType) => setSelectedMealType(mealType),
    openMergeDuplicates: () => setDialog('mergeDuplicates'),
    closeMergeDuplicates: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, mergeDuplicates: false }));
    },
    openMealInsights: () => setDialog('insights'),
    closeMealInsights: () => {
      setDialog(null);
      setSelectedMealForMenu(null);
      setLoading((current) => ({ ...current, insights: false }));
    },
    openCreateMeal: (foods: CreateMealItem[]) => {
      setCreateMealInitialFoods(foods);
      setDialog('createMeal');
    },
    closeCreateMeal: () => {
      setDialog(null);
      setCreateMealInitialFoods([]);
    },
    closeMealMenu: (clearSelection = false) => {
      closeMenuDialog(setDialog);
      if (clearSelection) {
        setSelectedMealForMenu(null);
      }
    },
    clearMealSelection: () => setSelectedMealForMenu(null),
    setMergeDuplicatesLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, mergeDuplicates: value })),
    setMealInsightsLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, insights: value })),
  };
}
