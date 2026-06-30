import { useState } from 'react';

import type NutritionLog from '@/database/models/NutritionLog';
import { type MealType } from '@/database/models/NutritionLog';

export function useSaveForLaterUi() {
  const [hasSavedForLaterItems, setHasSavedForLaterItems] = useState(false);
  const [isSavedForLaterModalVisible, setIsSavedForLaterModalVisible] = useState(false);
  const [isSaveForLaterLoading, setIsSaveForLaterLoading] = useState(false);
  const [isSaveForLaterPortionVisible, setIsSaveForLaterPortionVisible] = useState(false);
  const [saveForLaterPendingLogs, setSaveForLaterPendingLogs] = useState<NutritionLog[] | null>(
    null
  );
  const [saveForLaterPendingMealType, setSaveForLaterPendingMealType] = useState<MealType | null>(
    null
  );

  const requestSaveForLater = (logs: NutritionLog[], mealType: MealType) => {
    setSaveForLaterPendingLogs(logs);
    setSaveForLaterPendingMealType(mealType);
    setIsSaveForLaterPortionVisible(true);
  };

  return {
    hasSavedForLaterItems,
    isSaveForLaterLoading,
    isSaveForLaterPortionVisible,
    isSavedForLaterModalVisible,
    requestSaveForLater,
    saveForLaterPendingLogs,
    saveForLaterPendingMealType,
    setHasSavedForLaterItems,
    setIsSaveForLaterLoading,
    setIsSaveForLaterPortionVisible,
    setIsSavedForLaterModalVisible,
    setSaveForLaterPendingLogs,
    setSaveForLaterPendingMealType,
  };
}
