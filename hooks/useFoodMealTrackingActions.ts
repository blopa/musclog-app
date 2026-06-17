import { useCallback } from 'react';

import {
  type FoodMealTrackingActionNutrition,
  type FoodMealTrackingActionSelection,
  FoodMealTrackingActionService,
  type FoodMealTrackingActionTarget,
} from '@/database/services/FoodMealTrackingActionService';
import { findAlternateBarcodeSource } from '@/hooks/useFoodProductDetails';
import {
  inferBarcodeNutritionSource,
  type ProductDetailsQueryData,
} from '@/utils/externalFoodProduct';
import { handleError } from '@/utils/handleError';

type UseFoodMealTrackingActionsParams = {
  target: FoodMealTrackingActionTarget;
  selection: FoodMealTrackingActionSelection;
  nutrition: FoodMealTrackingActionNutrition;
  setters: {
    setIsAddingFood: (value: boolean) => void;
    setIsFoodNotFoundModalVisible: (value: boolean) => void;
    setIsRefetchingSource: (value: boolean) => void;
    setRefetchedProductDetails: (value: ProductDetailsQueryData | null) => void;
    setAlternateSourceLookupFailed: (value: boolean) => void;
    setLocalCanEdit: (value: boolean) => void;
  };
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

export function useFoodMealTrackingActions({
  target,
  selection,
  nutrition,
  setters,
  callbacks,
  feedback,
}: UseFoodMealTrackingActionsParams) {
  const {
    setIsAddingFood,
    setIsFoodNotFoundModalVisible,
    setIsRefetchingSource,
    setRefetchedProductDetails,
    setAlternateSourceLookupFailed,
    setLocalCanEdit,
  } = setters;
  const { onAddFood, onLogMeal, onClose, onFoodTracked, onNutritionLogTracked } = callbacks;
  const { showSnackbar, t } = feedback;

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
      handleError(error, 'FoodMealTrackingDetailsModal.handleAddFood', {
        snackbarMessage: t('food.foodDetails.errorMessage'),
      });
    } finally {
      setIsAddingFood(false);
    }
  }, [
    nutrition,
    onAddFood,
    onClose,
    onFoodTracked,
    onLogMeal,
    onNutritionLogTracked,
    selection,
    setIsAddingFood,
    showSnackbar,
    t,
    target,
  ]);

  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
  }, [onClose, setIsFoodNotFoundModalVisible]);

  const handleTryAnotherSource = useCallback(async () => {
    if (!target.barcode) {
      return;
    }

    setIsRefetchingSource(true);

    const effectiveDetails = target.refetchedProductDetails ?? target.productDetails;
    const currentSource = inferBarcodeNutritionSource(effectiveDetails, target.productFromSearch);

    try {
      const found = await findAlternateBarcodeSource(target.barcode, currentSource);
      if (found) {
        setAlternateSourceLookupFailed(false);
        setRefetchedProductDetails(found);
      } else {
        setAlternateSourceLookupFailed(true);
        setLocalCanEdit(true);
      }
    } catch (error) {
      handleError(error, 'FoodMealTrackingDetailsModal.handleTryAnotherSource');
      setAlternateSourceLookupFailed(true);
      setLocalCanEdit(true);
    } finally {
      setIsRefetchingSource(false);
    }
  }, [
    setAlternateSourceLookupFailed,
    setIsRefetchingSource,
    setLocalCanEdit,
    setRefetchedProductDetails,
    target,
  ]);

  return {
    handleAddFood,
    handleFoodNotFoundClose,
    handleTryAnotherSource,
  };
}
