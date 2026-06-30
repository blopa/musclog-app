import { useReducer } from 'react';

import type { MealGroup } from '@/components/nutrition/foodTypes';

type MealGroupActionMode = 'move' | 'copy' | 'split';

type MealGroupUiState = {
  selectedMealGroup: MealGroup | null;
  isMealGroupMenuVisible: boolean;
  isDeleteMealGroupVisible: boolean;
  isDeleteMealGroupLoading: boolean;
  isMealGroupScaleModalVisible: boolean;
  isMealGroupScaleLoading: boolean;
  isMealGroupActionModalVisible: boolean;
  mealGroupActionMode: MealGroupActionMode;
  isMealGroupActionLoading: boolean;
  isMealGroupInsightsVisible: boolean;
  isMealGroupInsightsLoading: boolean;
  isMealGroupDetailsVisible: boolean;
  selectedMealGroupForDetails: MealGroup | null;
};

type MealGroupUiAction =
  | { type: 'clear-group-selection' }
  | { type: 'close-delete-group' }
  | { type: 'close-details' }
  | { type: 'close-group-action' }
  | { type: 'close-group-insights' }
  | { type: 'close-group-menu'; clearSelection?: boolean }
  | { type: 'close-group-scale' }
  | { type: 'open-delete-group' }
  | { type: 'open-details'; group: MealGroup }
  | { type: 'open-group-action'; mode: MealGroupActionMode }
  | { type: 'open-group-insights' }
  | { type: 'open-group-menu'; group: MealGroup }
  | { type: 'open-group-scale' }
  | { type: 'reset' }
  | { type: 'set-delete-group-loading'; value: boolean }
  | { type: 'set-group-action-loading'; value: boolean }
  | { type: 'set-group-insights-loading'; value: boolean }
  | { type: 'set-group-scale-loading'; value: boolean };

const initialState: MealGroupUiState = {
  selectedMealGroup: null,
  isMealGroupMenuVisible: false,
  isDeleteMealGroupVisible: false,
  isDeleteMealGroupLoading: false,
  isMealGroupScaleModalVisible: false,
  isMealGroupScaleLoading: false,
  isMealGroupActionModalVisible: false,
  mealGroupActionMode: 'move',
  isMealGroupActionLoading: false,
  isMealGroupInsightsVisible: false,
  isMealGroupInsightsLoading: false,
  isMealGroupDetailsVisible: false,
  selectedMealGroupForDetails: null,
};

function reducer(state: MealGroupUiState, action: MealGroupUiAction): MealGroupUiState {
  switch (action.type) {
    case 'open-group-menu':
      return {
        ...state,
        selectedMealGroup: action.group,
        isMealGroupMenuVisible: true,
      };
    case 'close-group-menu':
      return {
        ...state,
        isMealGroupMenuVisible: false,
        selectedMealGroup: action.clearSelection ? null : state.selectedMealGroup,
      };
    case 'open-details':
      return {
        ...state,
        selectedMealGroupForDetails: action.group,
        isMealGroupDetailsVisible: true,
      };
    case 'close-details':
      return {
        ...state,
        isMealGroupDetailsVisible: false,
        selectedMealGroupForDetails: null,
      };
    case 'open-group-scale':
      return {
        ...state,
        isMealGroupMenuVisible: false,
        isMealGroupScaleModalVisible: true,
      };
    case 'close-group-scale':
      return {
        ...state,
        isMealGroupScaleModalVisible: false,
        isMealGroupScaleLoading: false,
        selectedMealGroup: null,
      };
    case 'open-group-action':
      return {
        ...state,
        isMealGroupMenuVisible: false,
        mealGroupActionMode: action.mode,
        isMealGroupActionModalVisible: true,
      };
    case 'close-group-action':
      return {
        ...state,
        isMealGroupActionModalVisible: false,
        isMealGroupActionLoading: false,
        selectedMealGroup: null,
      };
    case 'open-group-insights':
      return {
        ...state,
        isMealGroupMenuVisible: false,
        isMealGroupInsightsVisible: true,
      };
    case 'close-group-insights':
      return {
        ...state,
        isMealGroupInsightsVisible: false,
        isMealGroupInsightsLoading: false,
        selectedMealGroup: null,
      };
    case 'open-delete-group':
      return {
        ...state,
        isMealGroupMenuVisible: false,
        isDeleteMealGroupVisible: true,
      };
    case 'close-delete-group':
      return {
        ...state,
        isDeleteMealGroupVisible: false,
        isDeleteMealGroupLoading: false,
        selectedMealGroup: null,
      };
    case 'set-delete-group-loading':
      return {
        ...state,
        isDeleteMealGroupLoading: action.value,
      };
    case 'set-group-scale-loading':
      return {
        ...state,
        isMealGroupScaleLoading: action.value,
      };
    case 'set-group-action-loading':
      return {
        ...state,
        isMealGroupActionLoading: action.value,
      };
    case 'set-group-insights-loading':
      return {
        ...state,
        isMealGroupInsightsLoading: action.value,
      };
    case 'clear-group-selection':
      return {
        ...state,
        selectedMealGroup: null,
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

export function useMealGroupUi() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    ...state,
    handleMealGroupMenuPress: (group: MealGroup) => dispatch({ type: 'open-group-menu', group }),
    handleMealGroupCardPress: (group: MealGroup) => dispatch({ type: 'open-details', group }),
    openGroupScale: () => dispatch({ type: 'open-group-scale' }),
    closeGroupScale: () => dispatch({ type: 'close-group-scale' }),
    openGroupAction: (mode: MealGroupActionMode) => dispatch({ type: 'open-group-action', mode }),
    closeGroupAction: () => dispatch({ type: 'close-group-action' }),
    openGroupInsights: () => dispatch({ type: 'open-group-insights' }),
    closeGroupInsights: () => dispatch({ type: 'close-group-insights' }),
    openGroupDeleteConfirm: () => dispatch({ type: 'open-delete-group' }),
    closeDeleteMealGroup: () => dispatch({ type: 'close-delete-group' }),
    closeMealGroupMenu: (clearSelection = false) =>
      dispatch({ type: 'close-group-menu', clearSelection }),
    closeMealGroupDetails: () => dispatch({ type: 'close-details' }),
    clearSelectedMealGroup: () => dispatch({ type: 'clear-group-selection' }),
    setDeleteMealGroupLoading: (value: boolean) =>
      dispatch({ type: 'set-delete-group-loading', value }),
    setGroupScaleLoading: (value: boolean) => dispatch({ type: 'set-group-scale-loading', value }),
    setGroupActionLoading: (value: boolean) =>
      dispatch({ type: 'set-group-action-loading', value }),
    setGroupInsightsLoading: (value: boolean) =>
      dispatch({ type: 'set-group-insights-loading', value }),
    resetMealGroup: () => dispatch({ type: 'reset' }),
  };
}
