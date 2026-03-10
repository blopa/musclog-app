import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { NutritionGoalService, NutritionService } from '../database/services';
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

        props.renderWidget(
          NutritionWidget({
            calories: nutrients.calories,
            targetCalories: goal?.totalCalories ?? 0,
            protein: nutrients.protein,
            targetProtein: goal?.protein ?? 0,
            carbs: nutrients.carbs,
            targetCarbs: goal?.carbs ?? 0,
            fat: nutrients.fat,
            targetFat: goal?.fats ?? 0,
            width: widgetInfo.width,
            height: widgetInfo.height,
          })
        );
      }

      break;

    default:
      break;
  }
}
