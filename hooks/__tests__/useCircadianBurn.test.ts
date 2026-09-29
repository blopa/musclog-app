import { act, renderHook } from '@testing-library/react';

import { circadianBurnedKcal, MINUTES_PER_DAY } from '@/utils/circadianBurn';

import { useCircadianBurn } from '../useCircadianBurn';

const TDEE = 2400;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe('useCircadianBurn', () => {
  beforeEach(() => {
    // 8am local on a fixed day. Fake timers move `Date.now()` too, so advancing the
    // timers below is what moves the wall clock.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 17, 8, 0, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the elapsed burn for the current clock, not the whole TDEE', () => {
    const { result } = renderHook(() => useCircadianBurn(TDEE));

    expect(result.current.burned).toBeCloseTo(circadianBurnedKcal(TDEE, 8 * 60), 6);
    expect(result.current.burned).toBeLessThan(TDEE);
    expect(result.current.minutesSinceMidnight).toBeCloseTo(8 * 60, 6);
    expect(result.current.dayProgress).toBeCloseTo((8 * 60) / MINUTES_PER_DAY, 6);
    expect(result.current.blockKey).toBe('morning');
  });

  it('advances as the clock moves', () => {
    const { result } = renderHook(() => useCircadianBurn(TDEE));
    const atEight = result.current.burned;

    act(() => {
      jest.advanceTimersByTime(4 * HOUR);
    });

    expect(result.current.minutesSinceMidnight).toBeCloseTo(12 * 60, 6);
    expect(result.current.burned).toBeGreaterThan(atEight);
    expect(result.current.blockKey).toBe('midday');
  });

  // A per-minute readout does not need a per-second tick, but the live counter in the
  // science modal does, so the interval is the caller's choice.
  it('ticks at the requested interval', () => {
    const perSecond = renderHook(() => useCircadianBurn(TDEE, { tickMs: 1_000 }));
    const perMinute = renderHook(() => useCircadianBurn(TDEE));

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(perSecond.result.current.minutesSinceMidnight).toBeCloseTo(8 * 60 + 1 / 60, 6);
    expect(perMinute.result.current.minutesSinceMidnight).toBeCloseTo(8 * 60, 6);
  });

  // The science modal stays mounted while hidden: it must not tick behind a closed sheet,
  // and it must not come back showing the clock as it was when it closed.
  it('stops ticking while disabled and resynchronises when re-enabled', () => {
    const { rerender, result } = renderHook(
      ({ enabled }: { enabled: boolean }) => useCircadianBurn(TDEE, { enabled }),
      { initialProps: { enabled: false } }
    );

    act(() => {
      jest.advanceTimersByTime(7 * HOUR);
    });

    expect(result.current.minutesSinceMidnight).toBeCloseTo(8 * 60, 6);

    act(() => {
      rerender({ enabled: true });
    });

    expect(result.current.minutesSinceMidnight).toBeCloseTo(15 * 60, 6);
  });

  it('clears its interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useCircadianBurn(TDEE));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
