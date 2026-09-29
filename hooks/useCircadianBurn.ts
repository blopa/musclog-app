import { useCallback, useSyncExternalStore } from 'react';

import type { BlockKey } from '@/constants/circadian';
import {
  circadianBurnedKcal,
  currentCircadianBlockKey,
  MINUTES_PER_DAY,
  minutesSinceLocalMidnight,
} from '@/utils/circadianBurn';

export type UseCircadianBurnOptions = {
  /**
   * Stops the ticker while false — for a surface that stays mounted while hidden, such as
   * a modal. The reading still refreshes on the next render, so re-arming cannot leave the
   * clock where it stood when the surface closed.
   */
  enabled?: boolean;
  /** How often the clock is re-read. A per-minute readout does not need a per-second tick. */
  tickMs?: number;
};

export type UseCircadianBurnResult = {
  /** The circadian phase the clock is in, for its label. */
  blockKey: BlockKey;
  /** Energy expended so far today, in kcal. Fractional — round or floor at the call site. */
  burned: number;
  /** How far through the day we are, 0–1. */
  dayProgress: number;
  minutesSinceMidnight: number;
};

/**
 * Today's expenditure so far, ticking.
 *
 * Every surface that shows "burned today" reads it from here, so none of them can show a
 * whole-day TDEE as if it had already happened.
 *
 * The clock is an external store rather than state driven from an effect: the reading is
 * derived from `Date.now()` on every render, so there is no stale copy to resynchronise and
 * no `setState` inside an effect. The snapshot is quantised to the tick because an
 * unquantised clock reading would differ on every render and re-render forever.
 */
export function useCircadianBurn(
  tdee: number,
  { enabled = true, tickMs = 60_000 }: UseCircadianBurnOptions = {}
): UseCircadianBurnResult {
  const subscribe = useCallback(
    (onTick: () => void) => {
      if (!enabled) {
        return () => {};
      }

      const id = setInterval(onTick, tickMs);

      return () => clearInterval(id);
    },
    [enabled, tickMs]
  );

  const getSnapshot = useCallback(() => Math.floor(Date.now() / tickMs) * tickMs, [tickMs]);

  const tickAtMs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const minutesSinceMidnight = minutesSinceLocalMidnight(new Date(tickAtMs));

  return {
    blockKey: currentCircadianBlockKey(minutesSinceMidnight),
    burned: circadianBurnedKcal(tdee, minutesSinceMidnight),
    dayProgress: Math.min(minutesSinceMidnight / MINUTES_PER_DAY, 1),
    minutesSinceMidnight,
  };
}
