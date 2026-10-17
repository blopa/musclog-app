/**
 * The work timer counts a set DOWN, where the rest timer counts the recovery after it: a plank, a
 * wall sit, a carry or an interval has a duration to perform, not reps to count. It is a separate
 * primitive on purpose — pushing a 45 s hold through the rest timer meant two meanings for one
 * clock and a stopwatch workaround next to every timed exercise.
 */
export const WORK_TIMER_DEFAULT_SECONDS = 30;
export const WORK_TIMER_MIN_SECONDS = 5;
export const WORK_TIMER_MAX_SECONDS = 600;
export const WORK_TIMER_STEP_SECONDS = 5;

/** A duration the timer may hold: whole seconds within the range, the default for anything else. */
export function clampWorkSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return WORK_TIMER_DEFAULT_SECONDS;
  }

  return Math.min(WORK_TIMER_MAX_SECONDS, Math.max(WORK_TIMER_MIN_SECONDS, Math.round(seconds)));
}

/** Whole seconds left, rounded up so the clock reads 0:01 until the instant it actually ends. */
export function workSecondsRemaining(endAt: number | null, now: number): number {
  return endAt == null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
}

/**
 * The final stretch, in seconds, that gets a haptic tick — the same cue the rest countdown gives,
 * so the lifter learns one pattern. Kept here rather than imported so the two timers can change
 * independently.
 */
export const WORK_TIMER_TICK_SECONDS: readonly number[] = [3, 2, 1];

/**
 * The beat to play when the countdown moves from `previous` to `remaining`, driven by the
 * transition onto a value exactly as `hapticBeat` is for the rest timer (a re-render must not
 * buzz twice, and a jump that skips a second plays only where it lands).
 */
export function workTimerBeat(previous: number | null, remaining: number): 'tick' | 'done' | null {
  if (previous === null || previous === remaining) {
    return null;
  }

  if (remaining === 0) {
    return 'done';
  }

  return WORK_TIMER_TICK_SECONDS.includes(remaining) ? 'tick' : null;
}
