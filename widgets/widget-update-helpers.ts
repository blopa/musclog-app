import type { WidgetInfo } from 'react-native-android-widget';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { NutritionGoalService, NutritionService } from '../database/services';
import { NutritionWidget } from './NutritionWidget';

/**
 * Request an update for the Nutrition widget
 * This helper function provides the renderWidget callback required by requestWidgetUpdate
 */
export async function requestNutritionWidgetUpdate(): Promise<void> {
  await requestWidgetUpdate({
    widgetName: 'Nutrition',
    renderWidget: async (props: WidgetInfo) => {
      const today = new Date();
      const [nutrients, goal] = await Promise.all([
        NutritionService.getDailyNutrients(today),
        NutritionGoalService.getGoalForDate(today),
      ]);

      return NutritionWidget({
        calories: nutrients.calories,
        targetCalories: goal?.totalCalories ?? 0,
        protein: nutrients.protein,
        targetProtein: goal?.protein ?? 0,
        carbs: nutrients.carbs,
        targetCarbs: goal?.carbs ?? 0,
        fat: nutrients.fat,
        targetFat: goal?.fats ?? 0,
        width: props.width,
      });
    },
  });
}
