import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Meal from '@/database/models/Meal';
import { MealService } from '@/database/services';
import { handleError } from '@/utils/handleError';

export type Ingredient = {
  mealFoodId?: string; // present when loaded from an existing meal (edit mode)
  foodId: string;
  name: string;
  amount: number; // in grams
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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
                calories: nutrients.calories,
                protein: nutrients.protein,
                carbs: nutrients.carbs,
                fat: nutrients.fat,
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
