import { useReducer } from 'react';

import type { ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import { type MealType } from '@/database/models/NutritionLog';

type FoodLogDetails = ResolvedLogEntry & { mealType: MealType };

type FoodItemUiState = {
  selectedFoodItem: ResolvedLogEntry | null;
  isFoodMenuVisible: boolean;
  isFoodDetailsModalVisible: boolean;
  selectedFoodLogDetails: FoodLogDetails | null;
  isDeleteConfirmationVisible: boolean;
  isDeleteFoodLoading: boolean;
  isDuplicateMode: boolean;
  isFoodMoveModalVisible: boolean;
  isFoodMoveLoading: boolean;
  isFoodSplitModalVisible: boolean;
  isFoodSplitLoading: boolean;
};

type FoodItemUiAction =
  | { type: 'close-delete-confirmation' }
  | { type: 'close-details' }
  | { type: 'close-food-log-details' }
  | { type: 'close-menu'; clearSelection?: boolean }
  | { type: 'close-move' }
  | { type: 'close-split' }
  | { type: 'open-delete-confirmation' }
  | { type: 'open-details'; duplicateMode: boolean }
  | { type: 'open-food-log-details'; entry: ResolvedLogEntry }
  | { type: 'open-menu'; entry: ResolvedLogEntry }
  | { type: 'open-move' }
  | { type: 'open-split' }
  | { type: 'reset' }
  | { type: 'set-delete-loading'; value: boolean }
  | { type: 'set-move-loading'; value: boolean }
  | { type: 'set-split-loading'; value: boolean };

const initialState: FoodItemUiState = {
  selectedFoodItem: null,
  isFoodMenuVisible: false,
  isFoodDetailsModalVisible: false,
  selectedFoodLogDetails: null,
  isDeleteConfirmationVisible: false,
  isDeleteFoodLoading: false,
  isDuplicateMode: false,
  isFoodMoveModalVisible: false,
  isFoodMoveLoading: false,
  isFoodSplitModalVisible: false,
  isFoodSplitLoading: false,
};

function reducer(state: FoodItemUiState, action: FoodItemUiAction): FoodItemUiState {
  switch (action.type) {
    case 'open-menu':
      return {
        ...state,
        selectedFoodItem: action.entry,
        isFoodMenuVisible: true,
      };
    case 'close-menu':
      return {
        ...state,
        isFoodMenuVisible: false,
        selectedFoodItem: action.clearSelection ? null : state.selectedFoodItem,
      };
    case 'open-food-log-details':
      return {
        ...state,
        selectedFoodLogDetails: { ...action.entry, mealType: action.entry.log.type },
      };
    case 'close-food-log-details':
      return {
        ...state,
        selectedFoodLogDetails: null,
      };
    case 'open-details':
      return {
        ...state,
        isFoodMenuVisible: false,
        isFoodDetailsModalVisible: true,
        isDuplicateMode: action.duplicateMode,
      };
    case 'close-details':
      return {
        ...state,
        isFoodDetailsModalVisible: false,
        isDuplicateMode: false,
        selectedFoodItem: null,
      };
    case 'open-delete-confirmation':
      return {
        ...state,
        isFoodMenuVisible: false,
        isDeleteConfirmationVisible: true,
      };
    case 'close-delete-confirmation':
      return {
        ...state,
        isDeleteConfirmationVisible: false,
        isDeleteFoodLoading: false,
        selectedFoodItem: null,
      };
    case 'open-move':
      return {
        ...state,
        isFoodMenuVisible: false,
        isFoodMoveModalVisible: true,
      };
    case 'close-move':
      return {
        ...state,
        isFoodMoveModalVisible: false,
        isFoodMoveLoading: false,
        selectedFoodItem: null,
      };
    case 'open-split':
      return {
        ...state,
        isFoodMenuVisible: false,
        isFoodSplitModalVisible: true,
      };
    case 'close-split':
      return {
        ...state,
        isFoodSplitModalVisible: false,
        isFoodSplitLoading: false,
        selectedFoodItem: null,
      };
    case 'set-delete-loading':
      return {
        ...state,
        isDeleteFoodLoading: action.value,
      };
    case 'set-move-loading':
      return {
        ...state,
        isFoodMoveLoading: action.value,
      };
    case 'set-split-loading':
      return {
        ...state,
        isFoodSplitLoading: action.value,
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

export function useFoodItemUi() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    ...state,
    handleFoodCardPress: (entry: ResolvedLogEntry) =>
      dispatch({ type: 'open-food-log-details', entry }),
    handleFoodMenuPress: (entry: ResolvedLogEntry) => dispatch({ type: 'open-menu', entry }),
    openEdit: () => dispatch({ type: 'open-details', duplicateMode: false }),
    openDuplicate: () => dispatch({ type: 'open-details', duplicateMode: true }),
    closeFoodDetails: () => dispatch({ type: 'close-details' }),
    openDeleteConfirm: () => dispatch({ type: 'open-delete-confirmation' }),
    closeDeleteConfirm: () => dispatch({ type: 'close-delete-confirmation' }),
    openMove: () => dispatch({ type: 'open-move' }),
    closeFoodMove: () => dispatch({ type: 'close-move' }),
    openSplit: () => dispatch({ type: 'open-split' }),
    closeFoodSplit: () => dispatch({ type: 'close-split' }),
    closeFoodMenu: (clearSelection = false) => dispatch({ type: 'close-menu', clearSelection }),
    closeFoodLogDetails: () => dispatch({ type: 'close-food-log-details' }),
    setDeleteFoodLoading: (value: boolean) => dispatch({ type: 'set-delete-loading', value }),
    setMoveFoodLoading: (value: boolean) => dispatch({ type: 'set-move-loading', value }),
    setSplitFoodLoading: (value: boolean) => dispatch({ type: 'set-split-loading', value }),
    resetFoodItem: () => dispatch({ type: 'reset' }),
  };
}
