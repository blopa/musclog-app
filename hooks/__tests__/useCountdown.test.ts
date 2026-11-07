import { act, renderHook } from '@testing-library/react';

import { useCountdown } from '../useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 7, 12, 0, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at the full count and counts whole seconds down', () => {
    const { result } = renderHook(() => useCountdown(5, true, jest.fn()));

    expect(result.current).toBe(5);

    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(4);

    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current).toBe(1);
  });

  it('calls onElapsed exactly once, when the count reaches zero', () => {
    const onElapsed = jest.fn();
    const { result } = renderHook(() => useCountdown(5, true, onElapsed));

    act(() => {
      jest.advanceTimersByTime(4_900);
    });
    expect(onElapsed).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it('does not run, and never calls back, while disabled', () => {
    const onElapsed = jest.fn();
    const { result } = renderHook(() => useCountdown(5, false, onElapsed));

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe(5);
    expect(onElapsed).not.toHaveBeenCalled();
  });

  it('starts counting only once it is enabled', () => {
    const onElapsed = jest.fn();
    const { result, rerender } = renderHook(({ enabled }) => useCountdown(5, enabled, onElapsed), {
      initialProps: { enabled: false },
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onElapsed).not.toHaveBeenCalled();

    rerender({ enabled: true });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(result.current).toBe(3);

    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  // A page in an in-app browser can be paused in the background. The count follows the clock, so
  // when the timers wake up late the visitor is forwarded at once, not 5 ticks later.
  it('follows the wall clock when its timers were held back', () => {
    const onElapsed = jest.fn();
    const { result } = renderHook(() => useCountdown(5, true, onElapsed));

    act(() => {
      jest.setSystemTime(new Date(2026, 10, 7, 12, 0, 20, 0));
      jest.advanceTimersByTime(250);
    });

    expect(result.current).toBe(0);
    expect(onElapsed).toHaveBeenCalledTimes(1);
  });

  it('calls the latest callback, not the one from the first render', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ onElapsed }) => useCountdown(5, true, onElapsed), {
      initialProps: { onElapsed: first },
    });

    rerender({ onElapsed: second });
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops its timer when unmounted', () => {
    const onElapsed = jest.fn();
    const { unmount } = renderHook(() => useCountdown(5, true, onElapsed));

    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(onElapsed).not.toHaveBeenCalled();
  });
});
