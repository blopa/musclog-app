import { useState } from 'react';

import type { ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import { type MealType } from '@/database/models/NutritionLog';

type FoodLogDetails = ResolvedLogEntry & { mealType: MealType };
type FoodDialog = null | 'menu' | 'details' | 'delete' | 'move' | 'split';

type FoodLoadingState = {
  delete: boolean;
  move: boolean;
  split: boolean;
};

const INITIAL_LOADING: FoodLoadingState = {
  delete: false,
  move: false,
  split: false,
};

export function useFoodItemUi() {
  const [selectedFoodItem, setSelectedFoodItem] = useState<ResolvedLogEntry | null>(null);
  const [selectedFoodLogDetails, setSelectedFoodLogDetails] = useState<FoodLogDetails | null>(null);
  const [dialog, setDialog] = useState<FoodDialog>(null);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [loading, setLoading] = useState<FoodLoadingState>(INITIAL_LOADING);

  const resetSelection = () => {
    setSelectedFoodItem(null);
    setIsDuplicateMode(false);
  };

  return {
    selectedFoodItem,
    selectedFoodLogDetails,
    isDuplicateMode,
    isFoodMenuVisible: dialog === 'menu',
    isFoodDetailsModalVisible: dialog === 'details',
    isDeleteConfirmationVisible: dialog === 'delete',
    isFoodMoveModalVisible: dialog === 'move',
    isFoodSplitModalVisible: dialog === 'split',
    isDeleteFoodLoading: loading.delete,
    isFoodMoveLoading: loading.move,
    isFoodSplitLoading: loading.split,
    handleFoodCardPress: (entry: ResolvedLogEntry) =>
      setSelectedFoodLogDetails({ ...entry, mealType: entry.log.type }),
    handleFoodMenuPress: (entry: ResolvedLogEntry) => {
      setSelectedFoodItem(entry);
      setDialog('menu');
    },
    openEdit: () => {
      setIsDuplicateMode(false);
      setDialog('details');
    },
    openDuplicate: () => {
      setIsDuplicateMode(true);
      setDialog('details');
    },
    closeFoodDetails: () => {
      setDialog(null);
      resetSelection();
    },
    openDeleteConfirm: () => setDialog('delete'),
    closeDeleteConfirm: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, delete: false }));
      resetSelection();
    },
    openMove: () => setDialog('move'),
    closeFoodMove: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, move: false }));
      resetSelection();
    },
    openSplit: () => setDialog('split'),
    closeFoodSplit: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, split: false }));
      resetSelection();
    },
    closeFoodMenu: (clearSelection = false) => {
      // BottomPopUpMenu always calls onClose right after an item's own onPress, even when
      // that onPress already moved `dialog` to a different value (e.g. 'details' via openEdit).
      // Only clear the dialog if it's still showing the menu, so we don't clobber that transition.
      setDialog((current) => (current === 'menu' ? null : current));
      if (clearSelection) {
        resetSelection();
      }
    },
    closeFoodLogDetails: () => setSelectedFoodLogDetails(null),
    setDeleteFoodLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, delete: value })),
    setMoveFoodLoading: (value: boolean) => setLoading((current) => ({ ...current, move: value })),
    setSplitFoodLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, split: value })),
    resetFoodItem: () => {
      setDialog(null);
      setSelectedFoodLogDetails(null);
      setLoading(INITIAL_LOADING);
      resetSelection();
    },
  };
}
