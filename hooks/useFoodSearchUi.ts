import { useState } from 'react';

export function useFoodSearchUi() {
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<
    'all' | 'myFoods' | 'openfood' | 'usda' | 'meals'
  >('all');
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);

  return {
    foodSearchInitialTab,
    isCreateCustomFoodVisible,
    isFoodSearchModalVisible,
    isMyMealsModalVisible,
    isQuickTrackMealModalVisible,
    setFoodSearchInitialTab,
    setIsCreateCustomFoodVisible,
    setIsFoodSearchModalVisible,
    setIsMyMealsModalVisible,
    setIsQuickTrackMealModalVisible,
  };
}
