import {
  clearFatalError,
  createGracefulFatalHandler,
  type GlobalErrorHandler,
  getFatalError,
  hasFatalErrorSubscribers,
  installGracefulFatalHandler,
  resetFatalErrorStoreForTests,
  subscribeFatalError,
} from '@/utils/fatalErrorStore';

function target(hasSubscribers: boolean) {
  return { show: jest.fn(), hasSubscribers: jest.fn(() => hasSubscribers) };
}

describe('createGracefulFatalHandler', () => {
  it('shows a fatal error on screen instead of letting React Native close the app', () => {
    const previous = jest.fn();
    const screen = target(true);
    const error = new Error('boom');

    createGracefulFatalHandler(previous, { isDev: false, target: screen })(error, true);

    expect(screen.show).toHaveBeenCalledWith(error);
    expect(previous).not.toHaveBeenCalled();
  });

  it('falls back to React Native when nothing can show the error', () => {
    const previous = jest.fn();
    const error = new Error('boom');

    createGracefulFatalHandler(previous, { isDev: false, target: target(false) })(error, true);

    expect(previous).toHaveBeenCalledWith(error, true);
  });

  it('leaves non-fatal errors to React Native', () => {
    const previous = jest.fn();
    const screen = target(true);

    createGracefulFatalHandler(previous, { isDev: false, target: screen })(new Error('x'), false);

    expect(screen.show).not.toHaveBeenCalled();
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it("keeps development's red box", () => {
    const previous = jest.fn();
    const screen = target(true);

    createGracefulFatalHandler(previous, { isDev: true, target: screen })(new Error('x'), true);

    expect(screen.show).not.toHaveBeenCalled();
    expect(previous).toHaveBeenCalledTimes(1);
  });

  it('falls back to React Native when showing the error fails', () => {
    const previous = jest.fn();
    const screen = {
      show: jest.fn(() => {
        throw new Error('render failed');
      }),
      hasSubscribers: () => true,
    };

    expect(() =>
      createGracefulFatalHandler(previous, { isDev: false, target: screen })(new Error('x'), true)
    ).not.toThrow();
    expect(previous).toHaveBeenCalledTimes(1);
  });
});

describe('installGracefulFatalHandler', () => {
  beforeEach(() => resetFatalErrorStoreForTests());

  function fakeErrorUtils(initial: GlobalErrorHandler) {
    let handler = initial;

    return {
      getGlobalHandler: () => handler,
      setGlobalHandler: (next: GlobalErrorHandler) => {
        handler = next;
      },
      fire: (error: unknown, isFatal: boolean) => handler(error, isFatal),
    };
  }

  it('is reached through a handler Sentry installs afterwards, which reports first', () => {
    const reactNativeDefault = jest.fn();
    const errorUtils = fakeErrorUtils(reactNativeDefault);
    const order: string[] = [];

    installGracefulFatalHandler(errorUtils, false);

    // What Sentry's ReactNativeErrorHandlers integration does at init: wrap whatever is installed.
    const wrapped = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      order.push('sentry');
      wrapped(error, isFatal);
    });

    const unsubscribe = subscribeFatalError(() => order.push('screen'));
    const error = new Error('fatal');
    errorUtils.fire(error, true);

    expect(order).toEqual(['sentry', 'screen']);
    expect(getFatalError()).toEqual({ error });
    expect(reactNativeDefault).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('installs once', () => {
    const errorUtils = fakeErrorUtils(jest.fn());
    const setGlobalHandler = jest.spyOn(errorUtils, 'setGlobalHandler');

    installGracefulFatalHandler(errorUtils, false);
    installGracefulFatalHandler(errorUtils, false);

    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('does nothing where there is no ErrorUtils', () => {
    expect(() => installGracefulFatalHandler(undefined, false)).not.toThrow();
  });
});

describe('fatal error store', () => {
  beforeEach(() => resetFatalErrorStoreForTests());

  it('tells subscribers, counts them and clears', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeFatalError(listener);

    expect(hasFatalErrorSubscribers()).toBe(true);

    const error = new Error('x');
    createGracefulFatalHandler(jest.fn(), { isDev: false })(error, true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFatalError()).toEqual({ error });

    clearFatalError();
    expect(getFatalError()).toBeNull();

    unsubscribe();
    expect(hasFatalErrorSubscribers()).toBe(false);
  });
});
