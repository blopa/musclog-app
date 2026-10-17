import {
  DEFAULT_REST_SECONDS,
  GET_READY_SECONDS,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
} from '@/constants/restTimer';

/**
 * How long to rest after a set: the set's own rest when it names one, otherwise the user's default.
 * Three screens used to each hard-code their own fallback (60 in two places, 90 in a third), so a
 * timer would show one length while its ring was drawn against another.
 */
export function resolveRestSeconds(
  setRestSeconds: number | null | undefined,
  defaultRestSeconds: number = DEFAULT_REST_SECONDS
): number {
  return setRestSeconds != null && setRestSeconds > 0 ? setRestSeconds : defaultRestSeconds;
}

/** A default rest the settings UI may store: a whole number of seconds within the sensible range. */
export function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_REST_SECONDS;
  }

  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}

export type RestPhase = 'resting' | 'getReady' | 'done';

/**
 * Which state the countdown is in. The "get ready" window is a short, distinct state so the user can
 * read the change from across a gym without looking at the digits — it is announced in words as
 * well as colour. A rest no longer than the window has nothing to get ready for: it just rests.
 */
export function restPhase(
  remainingSeconds: number,
  totalSeconds: number,
  headsUpSeconds: number = GET_READY_SECONDS
): RestPhase {
  if (remainingSeconds <= 0) {
    return 'done';
  }

  return headsUpSeconds > 0 && totalSeconds > headsUpSeconds && remainingSeconds <= headsUpSeconds
    ? 'getReady'
    : 'resting';
}

export type HapticBeat = 'headsUp' | 'tick' | 'done';

/** The last seconds that get a tick before the final buzz. */
export const HAPTIC_TICK_SECONDS: readonly number[] = [3, 2, 1];

/**
 * The haptic to fire when the countdown moves from `previous` to `remaining`, or null.
 *
 * Driven by the TRANSITION onto a value, not the value itself: the screen re-renders for reasons
 * that have nothing to do with the clock (a +5 s tap, the app coming back to the foreground), and a
 * value-only rule would buzz again on each of them. A jump that skips a beat (backgrounded, then
 * resumed at 1 s) fires only for where it lands.
 *
 * `headsUpSeconds` is the moment the timer turns to "get ready" (0 or omitted: none). It buzzes
 * once, as the countdown crosses onto it, so the lifter who is not looking at the screen still
 * learns the rest is nearly over. Pass it only for a rest longer than the window, as `restPhase`
 * does, or a 20 s rest would announce itself the instant it starts.
 */
export function hapticBeat(
  previous: number | null,
  remaining: number,
  headsUpSeconds = 0
): HapticBeat | null {
  if (previous === null || previous === remaining) {
    return null;
  }

  if (remaining === 0) {
    return 'done';
  }

  if (HAPTIC_TICK_SECONDS.includes(remaining)) {
    return 'tick';
  }

  return headsUpSeconds > 0 && remaining === headsUpSeconds && previous > remaining
    ? 'headsUp'
    : null;
}
