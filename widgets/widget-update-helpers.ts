import type { WidgetInfo } from 'react-native-android-widget';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';

import { NutritionWidget } from './NutritionWidget';

/**
 * Request an update for the Nutrition widget.
 * Call this from UI components after making changes to nutrition data.
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
