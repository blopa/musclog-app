import { useReducer } from 'react';

import type Food from '@/database/models/Food';
import { type MealType } from '@/database/models/NutritionLog';

type MealActionMode = 'move' | 'copy' | 'split';
type CreateMealItem = { food: Food; amount: number };

type MealUiState = {
  addFoodModalPreselectedMealType: MealType | null;
  isAddFoodModalVisible: boolean;
  selectedMealType: MealType;
  selectedMealForMenu: MealType | null;
  isMealMenuVisible: boolean;
  isCreateMealModalVisible: boolean;
  createMealInitialFoods: CreateMealItem[];
  isDeleteAllMealVisible: boolean;
  isDeleteAllMealLoading: boolean;
  isMealActionModalVisible: boolean;
  mealActionMode: MealActionMode;
  isMealActionLoading: boolean;
  isMealInsightsVisible: boolean;
  isMealInsightsLoading: boolean;
  isScaleMealPortionModalVisible: boolean;
  isScaleMealPortionLoading: boolean;
  isMergeDuplicatesVisible: boolean;
  isMergeDuplicatesLoading: boolean;
};

type MealUiAction =
  | { type: 'close-add-food-modal' }
  | { type: 'close-create-meal' }
  | { type: 'close-delete-all' }
  | { type: 'close-meal-action' }
  | { type: 'close-meal-insights' }
  | { type: 'close-meal-menu'; clearSelection?: boolean }
  | { type: 'close-merge-duplicates' }
  | { type: 'close-scale-portion' }
  | { type: 'open-add-food-modal'; mealType: MealType | null }
  | { type: 'open-create-meal'; foods: CreateMealItem[] }
  | { type: 'open-delete-all' }
  | { type: 'open-meal-action'; mode: MealActionMode }
  | { type: 'open-meal-insights' }
  | { type: 'open-meal-menu'; mealType: MealType }
  | { type: 'open-merge-duplicates' }
  | { type: 'open-scale-portion' }
  | { type: 'reset' }
  | { type: 'set-delete-all-loading'; value: boolean }
  | { type: 'set-meal-action-loading'; value: boolean }
  | { type: 'set-meal-insights-loading'; value: boolean }
  | { type: 'set-merge-duplicates-loading'; value: boolean }
  | { type: 'set-scale-portion-loading'; value: boolean }
  | { type: 'set-selected-meal-type'; mealType: MealType }
  | { type: 'clear-meal-selection' };

const initialState: MealUiState = {
  addFoodModalPreselectedMealType: null,
  isAddFoodModalVisible: false,
  selectedMealType: 'breakfast',
  selectedMealForMenu: null,
  isMealMenuVisible: false,
  isCreateMealModalVisible: false,
  createMealInitialFoods: [],
  isDeleteAllMealVisible: false,
  isDeleteAllMealLoading: false,
  isMealActionModalVisible: false,
  mealActionMode: 'move',
  isMealActionLoading: false,
  isMealInsightsVisible: false,
  isMealInsightsLoading: false,
  isScaleMealPortionModalVisible: false,
  isScaleMealPortionLoading: false,
  isMergeDuplicatesVisible: false,
  isMergeDuplicatesLoading: false,
};

function reducer(state: MealUiState, action: MealUiAction): MealUiState {
  switch (action.type) {
    case 'open-meal-menu':
      return {
        ...state,
        selectedMealForMenu: action.mealType,
        isMealMenuVisible: true,
      };
    case 'close-meal-menu':
      return {
        ...state,
        isMealMenuVisible: false,
        selectedMealForMenu: action.clearSelection ? null : state.selectedMealForMenu,
      };
    case 'open-add-food-modal':
      return {
        ...state,
        addFoodModalPreselectedMealType: action.mealType,
        selectedMealType: action.mealType ?? state.selectedMealType,
        isAddFoodModalVisible: true,
      };
    case 'close-add-food-modal':
      return {
        ...state,
        isAddFoodModalVisible: false,
      };
    case 'set-selected-meal-type':
      return {
        ...state,
        selectedMealType: action.mealType,
      };
    case 'open-delete-all':
      return {
        ...state,
        isMealMenuVisible: false,
        isDeleteAllMealVisible: true,
      };
    case 'close-delete-all':
      return {
        ...state,
        isDeleteAllMealVisible: false,
        isDeleteAllMealLoading: false,
        selectedMealForMenu: null,
      };
    case 'open-meal-action':
      return {
        ...state,
        isMealMenuVisible: false,
        mealActionMode: action.mode,
        isMealActionModalVisible: true,
      };
    case 'close-meal-action':
      return {
        ...state,
        isMealActionModalVisible: false,
        isMealActionLoading: false,
        selectedMealForMenu: null,
      };
    case 'open-scale-portion':
      return {
        ...state,
        isMealMenuVisible: false,
        isScaleMealPortionModalVisible: true,
      };
    case 'close-scale-portion':
      return {
        ...state,
        isScaleMealPortionModalVisible: false,
        isScaleMealPortionLoading: false,
        selectedMealForMenu: null,
      };
    case 'open-merge-duplicates':
      return {
        ...state,
        isMergeDuplicatesVisible: true,
      };
    case 'close-merge-duplicates':
      return {
        ...state,
        isMergeDuplicatesVisible: false,
        isMergeDuplicatesLoading: false,
      };
    case 'open-meal-insights':
      return {
        ...state,
        isMealMenuVisible: false,
        isMealInsightsVisible: true,
      };
    case 'close-meal-insights':
      return {
        ...state,
        isMealInsightsVisible: false,
        isMealInsightsLoading: false,
        selectedMealForMenu: null,
      };
    case 'open-create-meal':
      return {
        ...state,
        createMealInitialFoods: action.foods,
        isCreateMealModalVisible: true,
      };
    case 'close-create-meal':
      return {
        ...state,
        isCreateMealModalVisible: false,
        createMealInitialFoods: [],
      };
    case 'set-delete-all-loading':
      return {
        ...state,
        isDeleteAllMealLoading: action.value,
      };
    case 'set-meal-action-loading':
      return {
        ...state,
        isMealActionLoading: action.value,
      };
    case 'set-scale-portion-loading':
      return {
        ...state,
        isScaleMealPortionLoading: action.value,
      };
    case 'set-merge-duplicates-loading':
      return {
        ...state,
        isMergeDuplicatesLoading: action.value,
      };
    case 'set-meal-insights-loading':
      return {
        ...state,
        isMealInsightsLoading: action.value,
      };
    case 'clear-meal-selection':
      return {
        ...state,
        selectedMealForMenu: null,
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

export function useMealUi() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    ...state,
    handleMealMenuPress: (mealType: MealType) => dispatch({ type: 'open-meal-menu', mealType }),
    handleAddFoodToMeal: (mealType: MealType) =>
      dispatch({ type: 'open-add-food-modal', mealType }),
    openAddFoodModal: (mealType: MealType | null = null) =>
      dispatch({ type: 'open-add-food-modal', mealType }),
    closeAddFoodModal: () => dispatch({ type: 'close-add-food-modal' }),
    selectMealType: (mealType: MealType) => dispatch({ type: 'set-selected-meal-type', mealType }),
    openDeleteAll: () => dispatch({ type: 'open-delete-all' }),
    closeDeleteAll: () => dispatch({ type: 'close-delete-all' }),
    openMealAction: (mode: MealActionMode) => dispatch({ type: 'open-meal-action', mode }),
    closeMealAction: () => dispatch({ type: 'close-meal-action' }),
    openScalePortion: () => dispatch({ type: 'open-scale-portion' }),
    closeScalePortion: () => dispatch({ type: 'close-scale-portion' }),
    openMergeDuplicates: () => dispatch({ type: 'open-merge-duplicates' }),
    closeMergeDuplicates: () => dispatch({ type: 'close-merge-duplicates' }),
    openMealInsights: () => dispatch({ type: 'open-meal-insights' }),
    closeMealInsights: () => dispatch({ type: 'close-meal-insights' }),
    openCreateMeal: (foods: CreateMealItem[]) => dispatch({ type: 'open-create-meal', foods }),
    closeCreateMeal: () => dispatch({ type: 'close-create-meal' }),
    closeMealMenu: (clearSelection = false) =>
      dispatch({ type: 'close-meal-menu', clearSelection }),
    clearMealSelection: () => dispatch({ type: 'clear-meal-selection' }),
    setDeleteAllMealLoading: (value: boolean) =>
      dispatch({ type: 'set-delete-all-loading', value }),
    setMealActionLoading: (value: boolean) => dispatch({ type: 'set-meal-action-loading', value }),
    setScaleMealPortionLoading: (value: boolean) =>
      dispatch({ type: 'set-scale-portion-loading', value }),
    setMergeDuplicatesLoading: (value: boolean) =>
      dispatch({ type: 'set-merge-duplicates-loading', value }),
    setMealInsightsLoading: (value: boolean) =>
      dispatch({ type: 'set-meal-insights-loading', value }),
    resetMeal: () => dispatch({ type: 'reset' }),
  };
}
