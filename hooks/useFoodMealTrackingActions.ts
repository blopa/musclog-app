import { useCallback, useState } from 'react';

import {
  type FoodMealTrackingActionNutrition,
  type FoodMealTrackingActionSelection,
  FoodMealTrackingActionService,
  type FoodMealTrackingActionTarget,
} from '@/database/services/FoodMealTrackingActionService';
import { handleError } from '@/utils/handleError';

type UseFoodMealTrackingActionsParams = {
  target: FoodMealTrackingActionTarget;
  selection: FoodMealTrackingActionSelection;
  nutrition: FoodMealTrackingActionNutrition;
  /** Context label passed to {@link handleError} when the track action fails. */
  errorContext: string;
  callbacks: {
    onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
    onLogMeal?: (data: { meal: string; date: Date }) => void;
    onClose: () => void;
    onFoodTracked?: () => void;
    onNutritionLogTracked?: () => void;
  };
  feedback: {
    showSnackbar: (type: 'success' | 'error', message: string) => void;
    t: (key: string) => string;
  };
};

/**
 * Owns the "add food / log meal" action: drives the {@link FoodMealTrackingActionService}, fans the
 * result out to the host callbacks, and tracks its own in-flight (`isAddingFood`) state.
 */
export function useFoodMealTrackingActions({
  target,
  selection,
  nutrition,
  errorContext,
  callbacks,
  feedback,
}: UseFoodMealTrackingActionsParams) {
  const { onAddFood, onLogMeal, onClose, onFoodTracked, onNutritionLogTracked } = callbacks;
  const { showSnackbar, t } = feedback;
  const [isAddingFood, setIsAddingFood] = useState(false);

  const handleAddFood = useCallback(async () => {
    setIsAddingFood(true);
    await new Promise((resolve) => setTimeout(resolve, 1));

    try {
      const result = await FoodMealTrackingActionService.trackFoodOrMeal({
        target,
        selection,
        nutrition,
      });

      if (result.kind === 'mealLogged') {
        onLogMeal?.({ meal: selection.selectedMeal, date: selection.selectedDate });
        onNutritionLogTracked?.();
      } else {
        onAddFood?.({
          servingSize: selection.servingSize,
          meal: selection.selectedMeal,
          date: selection.selectedDate,
        });

        if (result.kind === 'foodLogged') {
          onNutritionLogTracked?.();
        }
      }

      onClose();
      onFoodTracked?.();
      showSnackbar('success', t('food.foodDetails.successMessage'));
    } catch (error) {
      handleError(error, errorContext, {
        snackbarMessage: t('food.foodDetails.errorMessage'),
      });
    } finally {
      setIsAddingFood(false);
    }
  }, [
    errorContext,
    nutrition,
    onAddFood,
    onClose,
    onFoodTracked,
    onLogMeal,
    onNutritionLogTracked,
    selection,
    showSnackbar,
    t,
    target,
  ]);

  return {
    isAddingFood,
    handleAddFood,
  };
}
