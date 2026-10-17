/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useWorkTimer } from '@/hooks/useWorkTimer';
import { NotificationService } from '@/services/NotificationService';
import { playRestBeat } from '@/utils/restTimerHaptics';

jest.mock('react-native', () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    scheduleWorkTimerNotification: jest.fn().mockResolvedValue(undefined),
    cancelWorkTimerNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/utils/restTimerHaptics', () => ({ playRestBeat: jest.fn() }));

const notifications = NotificationService as jest.Mocked<typeof NotificationService>;

describe('useWorkTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  const setup = (onFinish: () => boolean = () => false, hapticsEnabled = true) =>
    renderHook(() => useWorkTimer({ hapticsEnabled, hapticStrength: 'standard', onFinish }));

  it('stays out of the way until opened, then lets the length be set', () => {
    const { result } = setup();
    expect(result.current.mode).toBe('closed');
    act(() => result.current.open());
    expect(result.current.mode).toBe('ready');
    expect(result.current.seconds).toBe(30);
    act(() => result.current.adjust(1));
    act(() => result.current.adjust(1));
    expect(result.current.seconds).toBe(40);
    act(() => result.current.adjust(-1));
    expect(result.current.seconds).toBe(35);
  });

  it('counts down, schedules its alert, and finishes exactly once at zero', () => {
    const onFinish = jest.fn(() => false);
    const { result } = setup(onFinish);
    act(() => result.current.open());
    act(() => result.current.start());
    expect(result.current.mode).toBe('running');
    expect(notifications.scheduleWorkTimerNotification).toHaveBeenCalledWith(30);

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current.remaining).toBe(20);
    expect(onFinish).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.mode).toBe('ready');
    // Ready again with the same length, so the next timed set is one tap away.
    expect(result.current.remaining).toBe(30);
    expect(notifications.cancelWorkTimerNotification).toHaveBeenCalled();
  });

  it('ticks through the last seconds and buzzes at zero, only when haptics are on', () => {
    const { result } = setup();
    act(() => result.current.open());
    act(() => result.current.start());
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    const beats = jest.mocked(playRestBeat).mock.calls.map(([beat]) => beat);
    expect(beats).toEqual(['tick', 'tick', 'tick', 'done']);
  });

  it('is silent with haptics off', () => {
    const { result } = setup(() => false, false);
    act(() => result.current.open());
    act(() => result.current.start());
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(playRestBeat).not.toHaveBeenCalled();
  });

  it('does not call finish, and cancels its alert, when stopped early', () => {
    const onFinish = jest.fn(() => false);
    const { result } = setup(onFinish);
    act(() => result.current.open());
    act(() => result.current.start());
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    act(() => result.current.stop());
    expect(result.current.mode).toBe('ready');
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onFinish).not.toHaveBeenCalled();
    expect(notifications.cancelWorkTimerNotification).toHaveBeenCalled();
  });

  it('cancels a running countdown when closed', () => {
    const { result } = setup();
    act(() => result.current.open());
    act(() => result.current.start());
    act(() => result.current.close());
    expect(result.current.mode).toBe('closed');
    expect(notifications.cancelWorkTimerNotification).toHaveBeenCalled();
  });

  describe('rest handoff', () => {
    const runOut = (onFinish: () => boolean) => {
      const hook = setup(onFinish);
      act(() => hook.result.current.open());
      act(() => hook.result.current.start());
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      return hook.result;
    };

    it('remembers a rest it started, so logging the set does not start a second one', () => {
      const result = runOut(() => true);
      expect(result.current.consumeRestHandoff(true)).toBe(true);
    });

    it('covers one set only: the mark is cleared once read', () => {
      const result = runOut(() => true);
      result.current.consumeRestHandoff(true);
      expect(result.current.consumeRestHandoff(true)).toBe(false);
    });

    it('does not suppress the rest after a set once that rest has ended', () => {
      const result = runOut(() => true);
      expect(result.current.consumeRestHandoff(false)).toBe(false);
    });

    it('does not claim a rest it did not start', () => {
      const result = runOut(() => false);
      expect(result.current.consumeRestHandoff(true)).toBe(false);
    });
  });
});
