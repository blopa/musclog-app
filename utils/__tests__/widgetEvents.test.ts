import { widgetEvents } from '@/utils/widgetEvents';

describe('widgetEvents', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('notifies every subscriber when a nutrition widget update is emitted', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubFirst = widgetEvents.onNutritionWidgetUpdate(first);
    const unsubSecond = widgetEvents.onNutritionWidgetUpdate(second);

    widgetEvents.emitNutritionWidgetUpdate();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubFirst();
    unsubSecond();
  });

  it('stops notifying a listener once its unsubscribe function is called', () => {
    const listener = jest.fn();
    const unsubscribe = widgetEvents.onNutritionWidgetUpdate(listener);

    widgetEvents.emitNutritionWidgetUpdate();
    unsubscribe();
    widgetEvents.emitNutritionWidgetUpdate();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing is subscribed', () => {
    expect(() => widgetEvents.emitNutritionWidgetUpdate()).not.toThrow();
  });

  // The emitter exists to decouple database services from widget helpers; a widget helper
  // that throws (e.g. no native widget host) must not take down the service call that
  // triggered the update.
  it('isolates a throwing listener so later listeners still run and the emit does not throw', () => {
    const throwing = jest.fn(() => {
      throw new Error('widget host unavailable');
    });
    const after = jest.fn();
    const unsubThrowing = widgetEvents.onNutritionWidgetUpdate(throwing);
    const unsubAfter = widgetEvents.onNutritionWidgetUpdate(after);

    expect(() => widgetEvents.emitNutritionWidgetUpdate()).not.toThrow();

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error in widget update listener:',
      expect.any(Error)
    );

    unsubThrowing();
    unsubAfter();
  });

  it('deduplicates the same listener reference (Set-backed registry)', () => {
    const listener = jest.fn();
    const unsubA = widgetEvents.onNutritionWidgetUpdate(listener);
    const unsubB = widgetEvents.onNutritionWidgetUpdate(listener);

    widgetEvents.emitNutritionWidgetUpdate();

    expect(listener).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });
});
