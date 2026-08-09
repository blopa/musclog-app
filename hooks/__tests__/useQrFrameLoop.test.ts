/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useQrFrameLoop } from '@/hooks/useQrFrameLoop';
import { getOpticalPreset } from '@/utils/optical/presets';
import { newOpticalSessionId, OpticalStream } from '@/utils/optical/senderSession';

/**
 * These pin the three behaviours the send screen and the bench screen used to implement
 * separately. A regression here is a regression in both.
 */
describe('useQrFrameLoop', () => {
  const preset = getOpticalPreset('tiny');

  const makeStream = (bytes: number) =>
    new OpticalStream(new Uint8Array(bytes).fill(7), preset, newOpticalSessionId());

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('self-schedules exactly one successor per tick', () => {
    const onFrame = jest.fn();
    const { result } = renderHook(() => useQrFrameLoop({ onFrame, running: true }));

    act(() => {
      result.current.install(makeStream(2048), 4);
      result.current.setFps(10);
    });

    // One pending timeout, and each tick queues exactly one successor — never more. A
    // setInterval-style loop would let callbacks pile up once a frame costs more than a period.
    expect(jest.getTimerCount()).toBe(1);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(jest.getTimerCount()).toBe(1);
    expect(onFrame).toHaveBeenCalled();
  });

  it.each([
    ['install then arm', false],
    ['arm then install', true],
  ])('starts the loop whichever order the caller uses (%s)', (_label, armFirst) => {
    const onFrame = jest.fn();
    const { rerender, result } = renderHook(({ running }) => useQrFrameLoop({ onFrame, running }), {
      initialProps: { running: armFirst },
    });

    if (armFirst) {
      act(() => result.current.install(makeStream(2048), 4));
    } else {
      act(() => result.current.install(makeStream(2048), 4));
      rerender({ running: true });
    }
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onFrame).toHaveBeenCalled();
  });

  it('encodes until the cache is full, then loops it with no further encoding', () => {
    const onEncode = jest.fn();
    const onFrame = jest.fn();
    const { result } = renderHook(() => useQrFrameLoop({ onEncode, onFrame, running: true }));

    act(() => {
      result.current.install(makeStream(2048), 3);
      result.current.setFps(60);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const stats = result.current.readStats();
    expect(stats.cacheTarget).toBe(3);
    expect(stats.cachedFrames).toBe(3);
    // More frames were shown than were ever encoded — the surplus came from the cache.
    expect(stats.framesShown).toBeGreaterThan(3);
    expect(onEncode).toHaveBeenCalledTimes(3);
    expect(onFrame).toHaveBeenCalledTimes(stats.framesShown);
  });

  it('never caches when the payload cannot hold a safely loopable set', () => {
    // cacheFrames === 0 is the all-or-nothing signal. Looping a partial set would deadlock the
    // receiver at ~98%, so every frame must stay freshly encoded.
    const onEncode = jest.fn();
    const { result } = renderHook(() =>
      useQrFrameLoop({ onEncode, onFrame: jest.fn(), running: true })
    );

    act(() => {
      result.current.install(makeStream(2048), 0);
      result.current.setFps(60);
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    const stats = result.current.readStats();
    expect(stats.cachedFrames).toBe(0);
    expect(onEncode).toHaveBeenCalledTimes(stats.framesShown);
  });

  it('clear() stops the loop and drops the cache', () => {
    const onFrame = jest.fn();
    const { result } = renderHook(() => useQrFrameLoop({ onFrame, running: true }));

    act(() => {
      result.current.install(makeStream(2048), 3);
      result.current.setFps(60);
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    act(() => result.current.clear());

    const shownAtClear = onFrame.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onFrame).toHaveBeenCalledTimes(shownAtClear);
    expect(result.current.readStats()).toEqual({
      cacheTarget: 0,
      cachedFrames: 0,
      framesShown: 0,
    });
  });
});
