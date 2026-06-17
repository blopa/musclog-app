import { useCallback } from 'react';

import { database } from '@/database';
import type { MealType, MicrosData } from '@/database/models';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import Meal from '@/database/models/Meal';
import { FoodService, MealService, NutritionService } from '@/database/services';
import type { EditedOverrides } from '@/hooks/useFoodEditForm';
import {
  findAlternateBarcodeSource,
  type ProductDetailsQueryData,
} from '@/hooks/useFoodProductDetails';
import { isSuccessFoodDetailProductState } from '@/types/guards/openFoodFacts';
import { combineLocalDateAndTime, instantForDateTimeInTimezone } from '@/utils/calendarDate';
import { inferBarcodeNutritionSource } from '@/utils/externalFoodProduct';
import { handleError } from '@/utils/handleError';
import { toFiniteMacro } from '@/utils/inferCaloriesFromMacros';
import { extractLabelsFromOFFProduct } from '@/utils/openFoodFactsMapper';
import { getProductName } from '@/utils/productName';

type ScaledNutritionalData = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
};

type UseFoodMealTrackingActionsParams = {
  // Mode inputs / props
  meal?: Meal | null;
  food?: Food | null;
  foodLog?: any;
  localFood: Food | null;
  barcode?: string | null;
  productFromSearch?: any;
  productDetails: ProductDetailsQueryData | null | undefined;
  refetchedProductDetails: ProductDetailsQueryData | null;

  // Selection / edit state
  selectedDate: Date;
  selectedTime: Date;
  selectedMeal: MealType;
  servingSize: number;
  isFavorite: boolean;
  matchedPortion: FoodPortion | null;
  editedOverrides: EditedOverrides | null;

  // Derived values
  mealScaleFactor: number;
  resolvedFoodServingMode: boolean | undefined;
  nutritionalData: ScaledNutritionalData;
  effectiveMicrosPer100g: MicrosData;

  // Setters
  setIsAddingFood: (value: boolean) => void;
  setIsFoodNotFoundModalVisible: (value: boolean) => void;
  setIsRefetchingSource: (value: boolean) => void;
  setRefetchedProductDetails: (value: ProductDetailsQueryData | null) => void;
  setAlternateSourceLookupFailed: (value: boolean) => void;
  setLocalCanEdit: (value: boolean) => void;

  // Parent callbacks
  onAddFood?: (data: { servingSize: number; meal: string; date: Date }) => void;
  onLogMeal?: (data: { meal: string; date: Date }) => void;
  onClose: () => void;
  onFoodTracked?: () => void;
  onNutritionLogTracked?: () => void;

  // Context helpers
  showSnackbar: (type: 'success' | 'error', message: string) => void;
  t: (key: string) => string;
};

/**
 * Encapsulates the non-edit action handlers for {@link FoodMealTrackingDetailsModal}: logging or
 * updating a food/meal, the food-not-found dismissal, and the "try another source" lookup. The
 * edit-pop-up state and handlers live in {@link useFoodEditForm}; the modal owns all other state
 * and passes the slices these handlers need.
 */
export function useFoodMealTrackingActions(params: UseFoodMealTrackingActionsParams) {
  const {
    meal,
    food,
    foodLog,
    localFood,
    barcode,
    productFromSearch,
    productDetails,
    refetchedProductDetails,
    selectedDate,
    selectedTime,
    selectedMeal,
    servingSize,
    isFavorite,
    matchedPortion,
    editedOverrides,
    mealScaleFactor,
    resolvedFoodServingMode,
    nutritionalData,
    effectiveMicrosPer100g,
    setIsAddingFood,
    setIsFoodNotFoundModalVisible,
    setIsRefetchingSource,
    setRefetchedProductDetails,
    setAlternateSourceLookupFailed,
    setLocalCanEdit,
    onAddFood,
    onLogMeal,
    onClose,
    onFoodTracked,
    onNutritionLogTracked,
    showSnackbar,
    t,
  } = params;

  const handleAddFood = useCallback(async () => {
    setIsAddingFood(true);
    // Small delay to allow React to render the loading state before closing
    await new Promise((resolve) => setTimeout(resolve, 1));

    try {
      // The stored `date` carries the consumed datetime: picked day + picked time.
      const loggedDateTime = combineLocalDateAndTime(selectedDate, selectedTime);

      // Shared tail for the four "log a single food record" branches: log it (with a short settle
      // delay so the write is visible to refetches), notify parents, close, and confirm.
      const logFoodAndFinish = async (foodId: string) => {
        await Promise.all([
          NutritionService.logFood(foodId, loggedDateTime, selectedMeal, servingSize),
          new Promise((resolve) => setTimeout(resolve, 100)),
        ]);

        onAddFood?.({ servingSize, meal: selectedMeal, date: selectedDate });
        onNutritionLogTracked?.();
        onClose();
        onFoodTracked?.();
        showSnackbar('success', t('food.foodDetails.successMessage'));
      };

      if (meal) {
        const mealWithFoods = await MealService.getMealWithFoods(meal.id);
        if (!mealWithFoods) {
          throw new Error('Failed to get meal foods');
        }

        // Log each food in the meal, scaled by (amount in g / total meal g)
        const mealGroupId = meal.id;
        const mealGroupName = meal.name ?? undefined;
        for (const mealFood of mealWithFoods.foods) {
          await NutritionService.logFood(
            mealFood.foodId,
            loggedDateTime,
            selectedMeal,
            mealFood.amount * mealScaleFactor,
            mealFood.portionId,
            undefined,
            mealGroupId,
            mealGroupName
          );
        }

        // Sync favorite status if it changed
        if (isFavorite !== Boolean(meal.isFavorite)) {
          await MealService.toggleMealFavorite(meal.id);
        }

        onLogMeal?.({ meal: selectedMeal, date: selectedDate });
        onNutritionLogTracked?.();
        onClose();
        onFoodTracked?.();
        showSnackbar('success', t('food.foodDetails.successMessage'));
        return;
      }

      // If editing an existing food log, update it instead of creating a new one
      if (foodLog) {
        const timezone = foodLog.timezone;
        // Store the consumed datetime: picked day + picked time, anchored to the
        // record's recording timezone.
        const dateTimestamp = instantForDateTimeInTimezone(selectedDate, selectedTime, timezone);
        await foodLog.updateTrackingDetails({
          amount: servingSize,
          date: dateTimestamp,
          mealType: selectedMeal,
          portionId: resolvedFoodServingMode ? foodLog.portionId : undefined,
          timezone,
        });

        onAddFood?.({ servingSize, meal: selectedMeal, date: selectedDate });
        onClose();
        onFoodTracked?.();
        showSnackbar('success', t('food.foodDetails.successMessage'));
        return;
      }

      const foodData = food ?? localFood;
      if (foodData) {
        const effectivePdForName = refetchedProductDetails ?? productDetails;
        const pendingFoodUpdates: Record<string, unknown> = {};

        // Apply user edits (name, barcode, description, macros, micros) to the persisted food record
        if (editedOverrides) {
          if (editedOverrides.name != null) {
            pendingFoodUpdates.name = editedOverrides.name;
          }

          if (editedOverrides.barcode != null) {
            pendingFoodUpdates.barcode = editedOverrides.barcode;
          }

          if (editedOverrides.description != null) {
            pendingFoodUpdates.description = editedOverrides.description;
          }

          if (editedOverrides.calories != null) {
            pendingFoodUpdates.calories = editedOverrides.calories;
          }

          if (editedOverrides.protein != null) {
            pendingFoodUpdates.protein = editedOverrides.protein;
          }

          if (editedOverrides.carbs != null) {
            pendingFoodUpdates.carbs = editedOverrides.carbs;
          }

          if (editedOverrides.fat != null) {
            pendingFoodUpdates.fat = editedOverrides.fat;
          }

          if (editedOverrides.fiber != null) {
            pendingFoodUpdates.fiber = editedOverrides.fiber;
          }

          if (editedOverrides.micros != null) {
            pendingFoodUpdates.micros = effectiveMicrosPer100g;
          }
        }

        // If localFood has no name and no name override, try to fill from API details
        // so NutritionService.logFood reads the correct name from the food record
        if (
          localFood &&
          !localFood.name?.trim() &&
          pendingFoodUpdates.name == null &&
          isSuccessFoodDetailProductState(effectivePdForName)
        ) {
          const { name: correctName, found } = getProductName(effectivePdForName);
          if (found) {
            pendingFoodUpdates.name = correctName;
          }
        }

        // Persist inferred per-100g calories so logFood snapshot matches the modal (Food row was 0 kcal).
        if (
          toFiniteMacro(foodData.calories) <= 0 &&
          toFiniteMacro(nutritionalData.calories) > 0 &&
          pendingFoodUpdates.calories == null
        ) {
          pendingFoodUpdates.calories = nutritionalData.calories;
        }

        const shouldPersistFoodUpdates =
          Object.keys(pendingFoodUpdates).length > 0 || (isFavorite && !foodData.isFavorite);

        if (shouldPersistFoodUpdates) {
          await database.write(async () => {
            if (Object.keys(pendingFoodUpdates).length > 0) {
              await foodData.update((record: any) => {
                for (const [key, value] of Object.entries(pendingFoodUpdates)) {
                  record[key] = value;
                }
              });
            }

            if (isFavorite && !foodData.isFavorite) {
              await foodData.update((record: any) => {
                record.isFavorite = true;
              });
            }
          });
        }

        await logFoodAndFinish(foodData.id);
        return;
      }

      // Handle API food: prefer barcode-fetched details over search results to get micros
      let productToSave: any =
        (isSuccessFoodDetailProductState(productDetails) ? productDetails.product : null) ??
        productFromSearch;
      if (!productToSave) {
        throw new Error('Product details not loaded');
      }

      // Apply user edits (e.g. from AI-sourced data) to name, barcode and description
      if (editedOverrides) {
        if (productToSave.fdcId) {
          productToSave = {
            ...productToSave,
            description: editedOverrides.name?.trim() || productToSave.description,
            gtinUpc: editedOverrides.barcode?.trim() || productToSave.gtinUpc,
            ingredients: editedOverrides.description?.trim() || productToSave.ingredients,
          };
        } else {
          const codeFromProduct = (productToSave as { code?: string }).code;
          const fallbackName = getProductName(productToSave).name;
          productToSave = {
            ...productToSave,
            product_name: (editedOverrides.name?.trim() || fallbackName).trim() || fallbackName,
            code: (editedOverrides.barcode?.trim() || codeFromProduct) ?? '',
            ingredients_text: editedOverrides.description?.trim() || productToSave.ingredients_text,
          } as typeof productToSave;
        }
      }

      // Musclog handle
      if ((productDetails as any)?.source === 'musclog') {
        const musclogProduct = (productDetails as any).product;
        const newFood = await FoodService.createFromMusclogProduct(
          musclogProduct,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            isFavorite: isFavorite,
          },
          barcode ?? undefined
        );

        await logFoodAndFinish(newFood.id);
        return;
      }

      // USDA handle
      if (productToSave.fdcId) {
        const pdForCreate = refetchedProductDetails ?? productDetails;
        const usdaRawMicros =
          pdForCreate && (pdForCreate as any)?.product?.foodNutrients
            ? ((pdForCreate as any).product as any).foodNutrients.reduce((acc: any, n: any) => {
                const num = n.nutrientNumber || n.number || n.nutrient?.number;
                if (num) {
                  acc[num] = n.value ?? n.amount;
                }
                return acc;
              }, {})
            : {};
        const newFood = await FoodService.createFromUSDAProduct(
          productToSave,
          {
            calories: nutritionalData.calories,
            protein: nutritionalData.protein,
            carbs: nutritionalData.carbs,
            fat: nutritionalData.fat,
            fiber: nutritionalData.fiber,
            sugar: nutritionalData.sugar,
            saturatedFat: nutritionalData.saturatedFat,
            sodium: nutritionalData.sodium,
            micros: {
              ...usdaRawMicros,
              ...effectiveMicrosPer100g,
            },
            isFavorite: isFavorite,
          },
          matchedPortion
        );

        await logFoodAndFinish(newFood.id);
        return;
      }

      // Save product to local database (search result has same shape as V3 for our usage)
      const pdForOffCreate = refetchedProductDetails ?? productDetails;
      const offRawNutriments =
        pdForOffCreate && (pdForOffCreate as any)?.product?.nutriments
          ? ((pdForOffCreate as any).product as any).nutriments
          : {};

      const newFood = await FoodService.createFromV3Product(
        productToSave,
        {
          calories: nutritionalData.calories,
          protein: nutritionalData.protein,
          carbs: nutritionalData.carbs,
          fat: nutritionalData.fat,
          fiber: nutritionalData.fiber,
          sugar: nutritionalData.sugar,
          saturatedFat: nutritionalData.saturatedFat,
          sodium: nutritionalData.sodium,
          micros: {
            ...offRawNutriments,
            ...effectiveMicrosPer100g,
          },
          isFavorite: isFavorite,
          nutriscore:
            typeof productToSave.nutriscore_grade === 'string' && productToSave.nutriscore_grade
              ? productToSave.nutriscore_grade.toLowerCase()
              : productFromSearch?.nutriscore,
          ecoscore:
            typeof productToSave.ecoscore_grade === 'string' && productToSave.ecoscore_grade
              ? productToSave.ecoscore_grade.toLowerCase()
              : productFromSearch?.ecoscore,
          novaGroup:
            typeof productToSave.nova_group === 'number'
              ? productToSave.nova_group
              : productFromSearch?.novaGroup,
          labels: extractLabelsFromOFFProduct(productToSave) ?? productFromSearch?.labels,
        },
        matchedPortion
      );

      await logFoodAndFinish(newFood.id);
    } catch (error) {
      handleError(error, 'FoodMealTrackingDetailsModal.handleAddFood', {
        snackbarMessage: t('food.foodDetails.errorMessage'),
      });
    } finally {
      setIsAddingFood(false);
    }
  }, [
    meal,
    foodLog,
    food,
    localFood,
    productDetails,
    productFromSearch,
    editedOverrides,
    nutritionalData.calories,
    nutritionalData.protein,
    nutritionalData.carbs,
    nutritionalData.fat,
    nutritionalData.fiber,
    nutritionalData.sugar,
    nutritionalData.saturatedFat,
    nutritionalData.sodium,
    isFavorite,
    matchedPortion,
    selectedDate,
    selectedTime,
    selectedMeal,
    servingSize,
    onAddFood,
    onClose,
    onFoodTracked,
    showSnackbar,
    t,
    onLogMeal,
    onNutritionLogTracked,
    mealScaleFactor,
    resolvedFoodServingMode,
    refetchedProductDetails,
    barcode,
    effectiveMicrosPer100g,
    setIsAddingFood,
  ]);

  // FoodNotFoundModal's actions (try-AI-scan / search-again / create-custom / close) currently all
  // just dismiss this modal so the parent can resume the camera; collapse them into one handler
  // until they actually need to diverge.
  const handleFoodNotFoundClose = useCallback(() => {
    setIsFoodNotFoundModalVisible(false);
    onClose();
  }, [onClose, setIsFoodNotFoundModalVisible]);

  const handleTryAnotherSource = useCallback(async () => {
    if (!barcode) {
      return;
    }

    setIsRefetchingSource(true);

    const effectiveDetails = refetchedProductDetails ?? productDetails;
    const currentSource = inferBarcodeNutritionSource(effectiveDetails, productFromSearch);

    try {
      const found = await findAlternateBarcodeSource(barcode, currentSource);
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
    barcode,
    productDetails,
    productFromSearch,
    refetchedProductDetails,
    setIsRefetchingSource,
    setRefetchedProductDetails,
    setAlternateSourceLookupFailed,
    setLocalCanEdit,
  ]);

  return {
    handleAddFood,
    handleFoodNotFoundClose,
    handleTryAnotherSource,
  };
}
