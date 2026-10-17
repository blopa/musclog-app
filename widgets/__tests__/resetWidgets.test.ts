import { widgetEvents } from '@/utils/widgetEvents';
import { handleError } from '@/utils/handleError';

import CycleWidget from '../CycleWidget';
import { INITIAL_CYCLE_SNAPSHOT } from '../cycleWidgetSnapshot';
import NutritionWidget from '../NutritionWidget';
import { resetWidgets } from '../resetWidgets';
import SmartCameraWidget from '../SmartCameraWidget';
import { INITIAL_CAMERA_SNAPSHOT, INITIAL_NUTRITION_SNAPSHOT } from '../widgetSnapshot';

jest.mock('../CycleWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));
jest.mock('../NutritionWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));
jest.mock('../SmartCameraWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('invalidates pending refreshes before clearing every persisted widget snapshot', async () => {
  const reset = jest.fn();
  const unsubscribe = widgetEvents.onReset(reset);
  await resetWidgets();
  expect(reset).toHaveBeenCalledTimes(1);
  expect(NutritionWidget.updateSnapshot).toHaveBeenCalledWith(INITIAL_NUTRITION_SNAPSHOT);
  expect(SmartCameraWidget.updateSnapshot).toHaveBeenCalledWith(INITIAL_CAMERA_SNAPSHOT);
  expect(CycleWidget.updateSnapshot).toHaveBeenCalledWith(INITIAL_CYCLE_SNAPSHOT);
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    (NutritionWidget.updateSnapshot as jest.Mock).mock.invocationCallOrder[0]
  );
  unsubscribe();
});

it('reports a native widget failure while clearing the other widget and allowing data reset', async () => {
  const error = new Error('Widget host unavailable');
  (NutritionWidget.updateSnapshot as jest.Mock).mockImplementationOnce(() => {
    throw error;
  });
  await expect(resetWidgets()).resolves.toBeUndefined();
  expect(SmartCameraWidget.updateSnapshot).toHaveBeenCalledWith(INITIAL_CAMERA_SNAPSHOT);
  expect(handleError).toHaveBeenCalledWith(error, 'widgets.reset', { showSnackbar: false });
});
