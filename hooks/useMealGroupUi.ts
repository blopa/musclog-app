import { useState } from 'react';

import type { MealGroup } from '@/components/nutrition/foodTypes';
import { closeMenuDialog } from '@/hooks/closeMenuDialog';

type MealGroupActionMode = 'move' | 'copy' | 'split';
type MealGroupDialog = null | 'menu' | 'details' | 'delete' | 'scale' | 'action' | 'insights';

type MealGroupLoadingState = {
  delete: boolean;
  scale: boolean;
  action: boolean;
  insights: boolean;
};

const INITIAL_LOADING: MealGroupLoadingState = {
  delete: false,
  scale: false,
  action: false,
  insights: false,
};

export function useMealGroupUi() {
  const [selectedMealGroup, setSelectedMealGroup] = useState<MealGroup | null>(null);
  const [dialog, setDialog] = useState<MealGroupDialog>(null);
  const [mealGroupActionMode, setMealGroupActionMode] = useState<MealGroupActionMode>('move');
  const [loading, setLoading] = useState<MealGroupLoadingState>(INITIAL_LOADING);

  const clearGroup = () => setSelectedMealGroup(null);

  return {
    selectedMealGroup,
    selectedMealGroupForDetails: dialog === 'details' ? selectedMealGroup : null,
    mealGroupActionMode,
    isMealGroupMenuVisible: dialog === 'menu',
    isDeleteMealGroupVisible: dialog === 'delete',
    isMealGroupScaleModalVisible: dialog === 'scale',
    isMealGroupActionModalVisible: dialog === 'action',
    isMealGroupInsightsVisible: dialog === 'insights',
    isMealGroupDetailsVisible: dialog === 'details',
    isDeleteMealGroupLoading: loading.delete,
    isMealGroupScaleLoading: loading.scale,
    isMealGroupActionLoading: loading.action,
    isMealGroupInsightsLoading: loading.insights,
    handleMealGroupMenuPress: (group: MealGroup) => {
      setSelectedMealGroup(group);
      setDialog('menu');
    },
    handleMealGroupCardPress: (group: MealGroup) => {
      setSelectedMealGroup(group);
      setDialog('details');
    },
    openGroupScale: () => setDialog('scale'),
    closeGroupScale: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, scale: false }));
      clearGroup();
    },
    openGroupAction: (mode: MealGroupActionMode) => {
      setMealGroupActionMode(mode);
      setDialog('action');
    },
    closeGroupAction: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, action: false }));
      clearGroup();
    },
    openGroupInsights: () => setDialog('insights'),
    closeGroupInsights: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, insights: false }));
      clearGroup();
    },
    openGroupDeleteConfirm: () => setDialog('delete'),
    closeDeleteMealGroup: () => {
      setDialog(null);
      setLoading((current) => ({ ...current, delete: false }));
      clearGroup();
    },
    closeMealGroupMenu: (clearSelection = false) => {
      closeMenuDialog(setDialog);
      if (clearSelection) {
        clearGroup();
      }
    },
    closeMealGroupDetails: () => {
      setDialog(null);
      clearGroup();
    },
    clearSelectedMealGroup: clearGroup,
    setDeleteMealGroupLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, delete: value })),
    setGroupScaleLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, scale: value })),
    setGroupActionLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, action: value })),
    setGroupInsightsLoading: (value: boolean) =>
      setLoading((current) => ({ ...current, insights: value })),
    resetMealGroup: () => {
      setDialog(null);
      setMealGroupActionMode('move');
      setLoading(INITIAL_LOADING);
      clearGroup();
    },
  };
}
