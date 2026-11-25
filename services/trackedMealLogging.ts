import { randomUUID } from 'expo-crypto';

import type { MealType } from '@/database/models/NutritionLog';
import { NutritionService } from '@/database/services/NutritionService';
import type { TrackMealIngredient } from '@/utils/coachAI';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';

/**
 * The one logger for an AI-estimated meal, used by the coach chat and the camera. A plate is logged
 * food by food, not as one food made of its totals, so each food keeps its matched id, its fiber
 * and the carbs convention the diary stores (see `storedMealCarbs`).
 */
export async function logTrackedMeal(params: {
  ingredients: readonly TrackMealIngredient[];
  date: Date;
  mealType: MealType;
  /** The grams the person actually ate; the estimate is scaled to it. */
  portionGrams: number;
  mealName?: string;
  imageUrl?: string;
  /** Time of day on `date`; omit for "that day, right now". */
  consumedTime?: Date;
}): Promise<void> {
  const { ingredients, date, mealType, portionGrams, mealName, imageUrl, consumedTime } = params;
  const baseTotalGrams = ingredients.reduce((sum, item) => sum + item.grams, 0);
  const safeBase = baseTotalGrams > 0 ? baseTotalGrams : 1;
  const scale = portionGrams / safeBase;

  const scaled = ingredients.map((item) => {
    const scaledGramsRaw = item.grams * scale;
    const scaledGrams = scaledGramsRaw > 0 ? roundToDecimalPlaces(scaledGramsRaw, 1) : 1;

    return {
      name: item.name,
      // Rounded to 2 dp: scaling leaves float noise (0.4 × 1.5 = 0.6000000000000001) in the diary.
      calories: roundToDecimalPlaces(item.kcal * scale, 2),
      protein: roundToDecimalPlaces(item.protein * scale, 2),
      carbs: roundToDecimalPlaces(item.carbs * scale, 2),
      fat: roundToDecimalPlaces(item.fat * scale, 2),
      fiber: roundToDecimalPlaces((item.fiber ?? 0) * scale, 2),
      grams: scaledGrams,
      foodId: item.foodId,
    };
  });

  if (scaled.length === 1) {
    const food = scaled[0];
    await NutritionService.logCustomMeal(
      {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        foodId: food.foodId,
        // A matched food keeps its own picture, not the photo of the plate.
        imageUrl: food.foodId ? undefined : imageUrl,
      },
      date,
      mealType,
      food.grams,
      { loggedMealName: mealName, consumedTime }
    );
    return;
  }

  await NutritionService.logCustomMealsBatch(scaled, date, mealType, {
    groupId: randomUUID(),
    loggedMealName: mealName,
    imageUrl,
    consumedTime,
  });
}
