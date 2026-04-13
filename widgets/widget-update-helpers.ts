import { Platform } from 'react-native';
import type { WidgetInfo } from 'react-native-android-widget';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { widgetEvents } from '@/utils/widgetEvents';

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

/**
 * Subscribe to widget update events from database services.
 * This breaks the circular dependency between services and widget helpers.
 */
widgetEvents.onNutritionWidgetUpdate(() => {
  // Only trigger on Android
  if (Platform.OS === 'android') {
    requestNutritionWidgetUpdate().catch((error: Error) => {
      console.error('Failed to update nutrition widget:', error);
    });
  }
});
