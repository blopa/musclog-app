import { useState } from 'react';

import type { MealGroup } from '@/components/nutrition/foodTypes';

export function useMealGroupUi() {
  const [selectedMealGroup, setSelectedMealGroup] = useState<MealGroup | null>(null);
  const [isMealGroupMenuVisible, setIsMealGroupMenuVisible] = useState(false);
  const [isDeleteMealGroupVisible, setIsDeleteMealGroupVisible] = useState(false);
  const [isDeleteMealGroupLoading, setIsDeleteMealGroupLoading] = useState(false);
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

  const handleMealGroupMenuPress = (group: MealGroup) => {
    setSelectedMealGroup(group);
    setIsMealGroupMenuVisible(true);
  };

  const handleMealGroupCardPress = (group: MealGroup) => {
    setSelectedMealGroupForDetails(group);
    setIsMealGroupDetailsVisible(true);
  };

  return {
    handleMealGroupCardPress,
    handleMealGroupMenuPress,
    isDeleteMealGroupLoading,
    isDeleteMealGroupVisible,
    isMealGroupActionLoading,
    isMealGroupActionModalVisible,
    isMealGroupDetailsVisible,
    isMealGroupInsightsLoading,
    isMealGroupInsightsVisible,
    isMealGroupMenuVisible,
    isMealGroupScaleLoading,
    isMealGroupScaleModalVisible,
    mealGroupActionMode,
    selectedMealGroup,
    selectedMealGroupForDetails,
    setIsDeleteMealGroupLoading,
    setIsDeleteMealGroupVisible,
    setIsMealGroupActionLoading,
    setIsMealGroupActionModalVisible,
    setIsMealGroupDetailsVisible,
    setIsMealGroupInsightsLoading,
    setIsMealGroupInsightsVisible,
    setIsMealGroupMenuVisible,
    setIsMealGroupScaleLoading,
    setIsMealGroupScaleModalVisible,
    setMealGroupActionMode,
    setSelectedMealGroup,
    setSelectedMealGroupForDetails,
  };
}
