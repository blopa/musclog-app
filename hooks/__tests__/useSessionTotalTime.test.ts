/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';

let mockStaticExport = false;

jest.mock('@/constants/platform', () => ({
  get isStaticExport() {
    return mockStaticExport;
  },
}));

const START = new Date('2026-03-14T10:00:00.000Z').getTime();

/** Wall clock driven independently of the timer queue, so a tick can be fired without time passing. */
let now = START;
const setNow = (value: number) => {
  now = value;
};

/** Fire the 1s interval `count` times without advancing `Date.now()` itself. */
const tick = (count = 1) => {
  act(() => {
    for (let i = 0; i < count; i += 1) {
      jest.advanceTimersByTime(1000);
    }
  });
};

describe('useSessionTotalTime', () => {
  beforeEach(() => {
    mockStaticExport = false;
    now = START;
    // `Date` stays real so the tests, not the timer queue, decide what time it is.
    jest.useFakeTimers({ doNotFake: ['Date'] });
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('anchored to a startTime (resuming a workout)', () => {
    it('reports the already-elapsed time immediately, without waiting a tick', () => {
      // Reopening a session mid-workout must not flash 00:00:00 for a second.
      setNow(START + 3_725_000); // 1h 2m 5s

      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      expect(result.current).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    });

    it('advances once per second', () => {
      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 0 });

      setNow(START + 1000);
      tick();

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 1 });
    });

    it('rolls seconds into minutes and minutes into hours', () => {
      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      setNow(START + 59_000);
      tick();
      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 59 });

      setNow(START + 60_000);
      tick();
      expect(result.current).toEqual({ hours: 0, minutes: 1, seconds: 0 });

      setNow(START + 3_600_000);
      tick();
      expect(result.current).toEqual({ hours: 1, minutes: 0, seconds: 0 });
    });

    it('catches up after the JS timer was throttled in the background', () => {
      // setInterval does not fire while the app is backgrounded; recomputing from the
      // wall clock (rather than incrementing) is what keeps the timer honest — a single
      // tick after a 10-minute gap must land on 10:00, not 00:01.
      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      setNow(START + 600_000);
      tick();

      expect(result.current).toEqual({ hours: 0, minutes: 10, seconds: 0 });
    });

    it('keeps the same object identity when the elapsed second has not changed', () => {
      // The state setter bails out on an unchanged tick so consumers do not re-render
      // when the displayed h:m:s is identical.
      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));
      const first = result.current;

      setNow(START + 500);
      tick();

      expect(result.current).toBe(first);
    });

    it('truncates a partial second rather than rounding it up', () => {
      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      setNow(START + 1999);
      tick();

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 1 });
    });

    it('stops ticking once unmounted', () => {
      const { result, unmount } = renderHook(() => useSessionTotalTime({ startTime: START }));

      unmount();
      setNow(START + 5000);
      tick(5);

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 0 });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('re-anchors when the startTime changes', () => {
      const { rerender, result } = renderHook(
        ({ startTime }) => useSessionTotalTime({ startTime }),
        { initialProps: { startTime: START } }
      );

      setNow(START + 10_000);
      rerender({ startTime: START + 7000 });

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 3 });
    });
  });

  describe('without a startTime (increment fallback)', () => {
    it('starts from the supplied initial time', () => {
      const { result } = renderHook(() =>
        useSessionTotalTime({ initialTime: { hours: 1, minutes: 30, seconds: 0 } })
      );

      expect(result.current).toEqual({ hours: 1, minutes: 30, seconds: 0 });
    });

    it('defaults to zero when no initial time is given', () => {
      const { result } = renderHook(() => useSessionTotalTime({}));

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });

    it('increments one second per tick, ignoring the wall clock entirely', () => {
      const { result } = renderHook(() => useSessionTotalTime({}));

      tick();
      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 1 });

      // The clock jumping forward must not affect the increment-based fallback.
      setNow(START + 500_000);
      tick(2);
      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 3 });
    });

    it('carries the initial offset across the minute and hour boundaries', () => {
      const { result } = renderHook(() =>
        useSessionTotalTime({ initialTime: { hours: 0, minutes: 59, seconds: 58 } })
      );

      tick(2);

      expect(result.current).toEqual({ hours: 1, minutes: 0, seconds: 0 });
    });

    it('stops ticking once unmounted', () => {
      const { result, unmount } = renderHook(() => useSessionTotalTime({}));

      unmount();
      tick(5);

      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 0 });
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('during static web export', () => {
    it('never starts a timer, so the export build cannot hang on a pending interval', () => {
      mockStaticExport = true;

      const { result } = renderHook(() => useSessionTotalTime({ startTime: START }));

      expect(jest.getTimerCount()).toBe(0);
      expect(result.current).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    });
  });
});
