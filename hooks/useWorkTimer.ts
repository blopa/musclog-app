import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { RestHapticStrength } from '@/constants/settings';
import { NotificationService } from '@/services/NotificationService';
import { playRestBeat } from '@/utils/restTimerHaptics';
import {
  clampWorkSeconds,
  WORK_TIMER_DEFAULT_SECONDS,
  WORK_TIMER_STEP_SECONDS,
  workSecondsRemaining,
  workTimerBeat,
} from '@/utils/workTimer';

type Mode = 'closed' | 'ready' | 'running';

/**
 * A countdown for a timed set. `ready` lets the lifter set the length, `running` counts it down,
 * and reaching zero returns to `ready` (so the next set is one tap away) after calling `onFinish`.
 *
 * The length is remembered for the life of the screen: a lifter doing three planks wants the same
 * 45 s each time without setting it again.
 */
export function useWorkTimer({
  hapticsEnabled,
  hapticStrength,
  onFinish,
}: {
  hapticsEnabled: boolean;
  hapticStrength: RestHapticStrength;
  /**
   * Called once when a countdown runs out (not when it is stopped). Returns whether it started a
   * rest, so the hook can remember that logging the set must not start another.
   */
  onFinish: () => boolean;
}) {
  const [mode, setMode] = useState<Mode>('closed');
  const [seconds, setSeconds] = useState(WORK_TIMER_DEFAULT_SECONDS);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // A rest the timer started on its own, so logging the set a moment later does not restart it.
  const restHandoff = useRef(false);
  const lastRemaining = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const hapticsRef = useRef({ enabled: hapticsEnabled, strength: hapticStrength });
  useEffect(() => {
    finishRef.current = onFinish;
    hapticsRef.current = { enabled: hapticsEnabled, strength: hapticStrength };
  });

  useEffect(() => {
    if (endAt == null) {
      return;
    }

    const tick = () => {
      const current = Date.now();
      setNow(current);
      const remaining = workSecondsRemaining(endAt, current);
      const beat = workTimerBeat(lastRemaining.current, remaining);
      lastRemaining.current = remaining;
      if (beat && hapticsRef.current.enabled) {
        void playRestBeat(beat, hapticsRef.current.strength);
      }

      if (remaining <= 0) {
        clearInterval(timer);
        setEndAt(null);
        setMode('ready');
        void NotificationService.cancelWorkTimerNotification();
        if (finishRef.current()) {
          restHandoff.current = true;
        }
      }
    };

    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener('change', tick);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [endAt]);

  const start = () => {
    const current = Date.now();
    lastRemaining.current = seconds;
    setNow(current);
    setEndAt(current + seconds * 1000);
    setMode('running');
    void NotificationService.scheduleWorkTimerNotification(seconds);
  };

  const stop = () => {
    setEndAt(null);
    setMode('ready');
    void NotificationService.cancelWorkTimerNotification();
  };

  const close = () => {
    if (mode === 'running') {
      void NotificationService.cancelWorkTimerNotification();
    }

    setEndAt(null);
    setMode('closed');
  };

  return {
    mode,
    seconds,
    remaining: mode === 'running' ? workSecondsRemaining(endAt, now) : seconds,
    open: () => setMode((current) => (current === 'closed' ? 'ready' : current)),
    close,
    start,
    stop,
    adjust: (direction: 1 | -1) =>
      setSeconds((current) => clampWorkSeconds(current + direction * WORK_TIMER_STEP_SECONDS)),
    /**
     * True when the timer already started the rest that is still running, so the caller logging the
     * set should not start it again. Always clears the mark: it covers one set, not the session.
     */
    consumeRestHandoff: (restRunning: boolean) => {
      const handoff = restHandoff.current && restRunning;
      restHandoff.current = false;
      return handoff;
    },
  };
}
