import { handleError } from '@/utils/handleError';
import { widgetEvents } from '@/utils/widgetEvents';

import { INITIAL_CAMERA_SNAPSHOT, INITIAL_NUTRITION_SNAPSHOT } from './widgetSnapshot';

export async function resetWidgets(): Promise<void> {
  widgetEvents.emitReset();
  // Defer native view evaluation until reset; importing the database must not initialize widget UI.
  const clear = [
    () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const widget = (require('./NutritionWidget') as typeof import('./NutritionWidget')).default;
      widget.updateSnapshot(INITIAL_NUTRITION_SNAPSHOT);
    },
    () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const widget = (require('./SmartCameraWidget') as typeof import('./SmartCameraWidget'))
        .default;
      widget.updateSnapshot(INITIAL_CAMERA_SNAPSHOT);
    },
  ];
  for (const reset of clear) {
    try {
      reset();
    } catch (error) {
      void handleError(error, 'widgets.reset', { showSnackbar: false });
    }
  }
}
