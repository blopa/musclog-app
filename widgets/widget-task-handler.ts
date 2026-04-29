import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { resolveDailyMacros } from '@/utils/dynamicNutritionTarget';

import { NutritionWidget } from './NutritionWidget';
import { SmartCameraWidget } from './SmartCameraWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction } = props;

  switch (widgetInfo.widgetName) {
    case 'SmartCamera':
      if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
        props.renderWidget(SmartCameraWidget());
      }

      break;

    case 'Nutrition':
      if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
        const today = new Date();
        const [nutrients, goal] = await Promise.all([
          NutritionService.getDailyNutrients(today),
          NutritionGoalService.getGoalForDate(today),
        ]);

        const macros = goal ? ((await resolveDailyMacros(goal, today)) ?? goal) : null;

        props.renderWidget(
          NutritionWidget({
            calories: nutrients.calories,
            targetCalories: macros?.totalCalories ?? 0,
            protein: nutrients.protein,
            targetProtein: macros?.protein ?? 0,
            carbs: nutrients.carbs,
            targetCarbs: macros?.carbs ?? 0,
            fat: nutrients.fat,
            targetFat: macros?.fats ?? 0,
            width: widgetInfo.width,
          })
        );
      }

      break;

    default:
      break;
  }
}
