import { useState } from 'react';

export function useDailySummaryUi() {
  const [isDailySummaryMenuVisible, setIsDailySummaryMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [isEditCurrentGoalVisible, setIsEditCurrentGoalVisible] = useState(false);

  return {
    isDailySummaryMenuVisible,
    isEditCurrentGoalVisible,
    isGoalsManagementModalVisible,
    setIsDailySummaryMenuVisible,
    setIsEditCurrentGoalVisible,
    setIsGoalsManagementModalVisible,
  };
}
