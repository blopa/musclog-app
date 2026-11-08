import { AppState, type AppStateStatus } from 'react-native';

import { BootForegroundClock } from '@/database/bootForegroundClock';

describe('BootForegroundClock', () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  let removeListener: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    listener = undefined;
    removeListener = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      listener = handler;
      return { remove: removeListener };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    jest.restoreAllMocks();
  });

  it('starts paused when the app is already backgrounded', () => {
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    const clock = new BootForegroundClock();
    const callback = jest.fn();
    clock.setTimeout(callback, 1_000);

    jest.advanceTimersByTime(60_000);
    expect(clock.elapsed()).toBe(0);
    expect(callback).not.toHaveBeenCalled();

    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    listener?.('active');
    jest.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    clock.dispose();
  });

  it('discards time when AppState changes without a listener event, then resumes the remaining budget', () => {
    const clock = new BootForegroundClock();
    const callback = jest.fn();
    clock.setTimeout(callback, 10_000);
    jest.advanceTimersByTime(5_000);

    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    jest.setSystemTime(Date.now() + 3 * 60 * 60 * 1_000);
    jest.advanceTimersByTime(5_000);

    expect(callback).not.toHaveBeenCalled();
    expect(clock.elapsed()).toBe(0);

    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    listener?.('active');
    jest.advanceTimersByTime(9_999);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    clock.dispose();
  });

  it('clears timers, resolves delays and removes its listener on dispose', async () => {
    const clock = new BootForegroundClock();
    const callback = jest.fn();
    let delayResolved = false;
    void clock.delay(10_000).then(() => {
      delayResolved = true;
    });
    clock.setTimeout(callback, 10_000);

    const queuedListener = listener;
    clock.dispose();
    await Promise.resolve();

    expect(delayResolved).toBe(true);
    expect(removeListener).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    queuedListener?.('active');
    jest.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
