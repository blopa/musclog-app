import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Meal from '@/database/models/Meal';
import { MealService } from '@/database/services';
import { handleError } from '@/utils/handleError';

export type Ingredient = {
  localId: string; // stable UI key for editing/removal, even when the same food appears multiple times
  mealFoodId?: string; // present when loaded from an existing meal (edit mode)
  foodId: string;
  name: string;
  amount: number; // base amount stored on the meal food row: grams or servings
  referenceGrams: number; // gram-equivalent used for meal scaling math
  isPerServing: boolean; // true when amount is a serving count, false when it's grams
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  alcohol?: number;
  potassium?: number;
  magnesium?: number;
  zinc?: number;
};

let ingredientLocalIdCounter = 0;

export function createIngredientLocalId(prefix: string): string {
  ingredientLocalIdCounter += 1;
  return `${prefix}-${ingredientLocalIdCounter}`;
}

export function useEditMealIngredients(meal: Meal | undefined) {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const removedMealFoodIdsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    removedMealFoodIdsRef.current = [];

    if (!meal) {
      const clearIngredients = () => {
        setIngredients([]);
      };
      clearIngredients();
      return;
    }

    MealService.getMealWithFoods(meal.id)
      .then(async (result) => {
        if (!result) {
          return;
        }

        const loaded: (Ingredient | null)[] = await Promise.all(
          result.foods.map(async (mf) => {
            try {
              const food = await mf.food;
              const nutrients = await mf.getNutrients();
              const micros = await mf.getMicros();
              return {
                localId: mf.id,
                mealFoodId: mf.id,
                foodId: mf.foodId,
                name: food?.name ?? t('food.unknownFood'),
                amount: mf.amount,
                referenceGrams: await mf.getReferenceGramWeight(),
                isPerServing: food?.resolvedNutritionBasis === 'per_serving',
                calories: nutrients.calories,
                protein: nutrients.protein,
                carbs: nutrients.carbs,
                fat: nutrients.fat,
                fiber: nutrients.fiber,
                sugar: micros.sugar ?? 0,
                saturatedFat: micros.saturatedFat ?? 0,
                sodium: micros.sodium ?? 0,
                alcohol: micros.alcohol ?? 0,
                potassium: micros.potassium ?? 0,
                magnesium: micros.magnesium ?? 0,
                zinc: micros.zinc ?? 0,
              };
            } catch (error) {
              await handleError(error, 'useEditMealIngredients.loadIngredient', {
                showSnackbar: false,
              });
              return null;
            }
          })
        );

        if (!cancelled) {
          setIngredients(
            loaded.filter((ingredient): ingredient is Ingredient => ingredient !== null)
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          handleError(error, 'useEditMealIngredients.loadMeal', {
            showSnackbar: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meal, t]);

  return { ingredients, setIngredients, removedMealFoodIdsRef };
}
