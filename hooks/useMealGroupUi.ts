import { useState } from 'react';

import type { MealGroup } from '@/components/nutrition/foodTypes';
import { closeMenuDialog } from '@/hooks/closeMenuDialog';

type MealGroupDialog = null | 'menu' | 'details' | 'insights';

/**
 * UI state of a grouped meal card: its menu, its details sheet and the AI insights sheet. Copying,
 * moving, splitting, scaling and deleting a group are not here — they go through `DiaryActionPanels`.
 */
export function useMealGroupUi() {
  const [selectedMealGroup, setSelectedMealGroup] = useState<MealGroup | null>(null);
  const [dialog, setDialog] = useState<MealGroupDialog>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  const clearGroup = () => setSelectedMealGroup(null);

  return {
    selectedMealGroup,
    selectedMealGroupForDetails: dialog === 'details' ? selectedMealGroup : null,
    isMealGroupMenuVisible: dialog === 'menu',
    isMealGroupInsightsVisible: dialog === 'insights',
    isMealGroupDetailsVisible: dialog === 'details',
    isMealGroupInsightsLoading: isInsightsLoading,
    handleMealGroupMenuPress: (group: MealGroup) => {
      setSelectedMealGroup(group);
      setDialog('menu');
    },
    handleMealGroupCardPress: (group: MealGroup) => {
      setSelectedMealGroup(group);
      setDialog('details');
    },
    openGroupInsights: () => setDialog('insights'),
    closeGroupInsights: () => {
      setDialog(null);
      setIsInsightsLoading(false);
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
    setGroupInsightsLoading: setIsInsightsLoading,
  };
}
