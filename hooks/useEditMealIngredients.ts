import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Meal from '@/database/models/Meal';
import { MealService } from '@/database/services';
import { handleError } from '@/utils/handleError';

export type Ingredient = {
  mealFoodId?: string; // present when loaded from an existing meal (edit mode)
  foodId: string;
  name: string;
  amount: number; // base amount stored on the meal food row: grams or servings
  referenceGrams: number; // gram-equivalent used for meal scaling math
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

export function useEditMealIngredients(meal: Meal | undefined) {
  const { t } = useTranslation();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const removedMealFoodIdsRef = useRef<string[]>([]);

  useEffect(() => {
    removedMealFoodIdsRef.current = [];

    if (!meal) {
      setIngredients([]);
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
              return {
                mealFoodId: mf.id,
                foodId: mf.foodId,
                name: food?.name ?? t('food.unknownFood'),
                amount: mf.amount,
                referenceGrams: await mf.getReferenceGramWeight(),
                calories: nutrients.calories,
                protein: nutrients.protein,
                carbs: nutrients.carbs,
                fat: nutrients.fat,
                fiber: nutrients.fiber,
                sugar: food?.micros?.sugar ?? 0,
                saturatedFat: food?.micros?.saturatedFat ?? 0,
                sodium: food?.micros?.sodium ?? 0,
                alcohol: food?.micros?.alcohol ?? 0,
                potassium: food?.micros?.potassium ?? 0,
                magnesium: food?.micros?.magnesium ?? 0,
                zinc: food?.micros?.zinc ?? 0,
              };
            } catch (error) {
              await handleError(error, 'useEditMealIngredients.loadIngredient', {
                showSnackbar: false,
              });
              return null;
            }
          })
        );

        setIngredients(
          loaded.filter((ingredient): ingredient is Ingredient => ingredient !== null)
        );
      })
      .catch((error) => {
        handleError(error, 'useEditMealIngredients.loadMeal', {
          showSnackbar: false,
        });
      });
  }, [meal, t]);

  return { ingredients, setIngredients, removedMealFoodIdsRef };
}
