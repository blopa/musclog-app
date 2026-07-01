import { useState } from 'react';

import type Food from '@/database/models/Food';
import { type MealType } from '@/database/models/NutritionLog';
import { closeMenuDialog } from '@/hooks/closeMenuDialog';

type MealActionMode = 'move' | 'copy' | 'split';
type CreateMealItem = { food: Food; amount: number };
type MealDialog =
  | null
  | 'addFood'
  | 'menu'
  | 'createMeal'
  | 'deleteAll'
  | 'action'
  | 'insights'
  | 'scale'
  | 'mergeDuplicates';

type MealLoadingState = {
  deleteAll: boolean;
  action: boolean;
  insights: boolean;
  scale: boolean;
  mergeDuplicates: boolean;
};

const INITIAL_LOADING: MealLoadingState = {
  deleteAll: false,
  action: false,
  insights: false,
  scale: false,
  mergeDuplicates: false,
};

export function useMealUi() {
  const [addFoodModalPreselectedMealType, setAddFoodModalPreselectedMealType] =
    useState<MealType | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [createMealInitialFoods, setCreateMealInitialFoods] = useState<CreateMealItem[]>([]);
  const [mealActionMode, setMealActionMode] = useState<MealActionMode>('move');
  const [dialog, setDialog] = useState<MealDialog>(null);
  const [loading, setLoading] = useState<MealLoadingState>(INITIAL_LOADING);

  return {
    addFoodModalPreselectedMealType,
    selectedMealType,
    selectedMealForMenu,
    createMealInitialFoods,
    mealActionMode,
    isAddFoodModalVisible: dialog === 'addFood',
    isMealMenuVisible: dialog === 'menu',
    isCreateMealModalVisible: dialog === 'createMeal',
    isDeleteAllMealVisible: dialog === 'deleteAll',
    isMealActionModalVisible: dialog === 'action',
    isMealInsightsVisible: dialog === 'insights',
    isScaleMealPortionModalVisible: dialog === 'scale',
    isMergeDuplicatesVisible: dialog === 'mergeDuplicates',
    isDeleteAllMealLoading: loading.deleteAll,
    isMealActionLoading: loading.action,
    isMealInsightsLoading: loading.insights,
    isScaleMealPortionLoading: loading.scale,
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
    openDeleteAll: () => setDialog('deleteAll'),
    closeDeleteAll: () => {
      setDialog(null);
      setSelectedMealForMenu(null);
      setLoading((current) => ({ ...current, deleteAll: false }));
    },
    openMealAction: (mode: MealActionMode) => {
      setMealActionMode(mode);
      setDialog('action');
    },
    closeMealAction: () => {
      setDialog(null);
      setSelectedMealForMenu(null);
      setLoading((current) => ({ ...current, action: false }));
    },
    openScalePortion: () => setDialog('scale'),
    closeScalePortion: () => {
      setDialog(null);
      setSelectedMealForMenu(null);
      setLoading((current) => ({ ...current, scale: false }));
    },
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
    setDeleteAllMealLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, deleteAll: value })),
    setMealActionLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, action: value })),
    setScaleMealPortionLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, scale: value })),
    setMergeDuplicatesLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, mergeDuplicates: value })),
    setMealInsightsLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, insights: value })),
    resetMeal: () => {
      setDialog(null);
      setAddFoodModalPreselectedMealType(null);
      setSelectedMealType('breakfast');
      setSelectedMealForMenu(null);
      setCreateMealInitialFoods([]);
      setMealActionMode('move');
      setLoading(INITIAL_LOADING);
    },
  };
}
