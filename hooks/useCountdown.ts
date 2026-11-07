import { useEffect, useRef, useState } from 'react';

/** How often the deadline is re-read. Short, so a throttled background tab catches up promptly. */
const TICK_MS = 250;

/**
 * Counts whole seconds down from `seconds` to 0 and calls `onElapsed` exactly once when it gets
 * there. Nothing runs while `enabled` is false.
 *
 * It measures against a deadline instead of counting ticks: a page in an in-app browser can be
 * throttled or paused in the background, and counting `setInterval` calls would then stop short
 * of the real time. Returns the seconds still to go, rounded up (5, 4, 3, 2, 1, 0).
 */
export function useCountdown(seconds: number, enabled: boolean, onElapsed: () => void): number {
  const [remaining, setRemaining] = useState(seconds);
  const onElapsedRef = useRef(onElapsed);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (left === 0) {
        clearInterval(timer);
        onElapsedRef.current();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [enabled, seconds]);

  return remaining;
}
