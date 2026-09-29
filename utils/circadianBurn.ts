import { BLOCK_DURATION, BLOCK_FRACTIONS, type BlockKey } from '@/constants/circadian';
import { localDayStartMs } from '@/utils/calendarDate';

export const MINUTES_PER_DAY = 1440;

/**
 * The circadian day, in minutes-since-midnight order.
 *
 * `earlySlеep` appears twice because its 240-minute block straddles midnight: the last
 * hour of the day and the first three of the next one are the same phase. That is why the
 * segment list is not simply the six blocks in order, and why the two halves must keep the
 * same `blockKey` — the phase label and the per-minute rate both come from it.
 *
 * (The Cyrillic `е` in `earlySlеep` is a typo frozen into `BLOCK_FRACTIONS` and into the
 * `progress.circadianPhase.*` / `progress.circadianModal.*` translation keys in every locale.
 * Renaming it here alone would silently lose both the rate and the label.)
 */
export const CIRCADIAN_SEGMENTS = [
  { start: 0, end: 180, blockKey: 'earlySlеep' },
  { start: 180, end: 420, blockKey: 'nadir' },
  { start: 420, end: 660, blockKey: 'morning' },
  { start: 660, end: 900, blockKey: 'midday' },
  { start: 900, end: 1140, blockKey: 'peak' },
  { start: 1140, end: 1380, blockKey: 'evening' },
  { start: 1380, end: MINUTES_PER_DAY, blockKey: 'earlySlеep' },
] as const satisfies readonly { blockKey: BlockKey; end: number; start: number }[];

/** Fraction of TDEE burned per minute while the clock is inside `blockKey`. */
export function circadianRatePerMinute(blockKey: BlockKey): number {
  return BLOCK_FRACTIONS[blockKey] / BLOCK_DURATION;
}

/**
 * Energy expended **so far today**, in kcal: the user's whole-day TDEE distributed across
 * the day by the circadian model rather than credited all at once.
 *
 * Deliberately fractional — a live counter floors it, a stat cell rounds it. Returns 0 at
 * midnight and exactly `tdee` at the end of the day, so it is a strict partition of TDEE
 * and never overstates the day.
 */
export function circadianBurnedKcal(tdee: number, minutesSinceMidnight: number): number {
  let burned = 0;

  for (const segment of CIRCADIAN_SEGMENTS) {
    if (minutesSinceMidnight <= segment.start) {
      break;
    }

    const elapsed = Math.min(minutesSinceMidnight, segment.end) - segment.start;
    burned += elapsed * circadianRatePerMinute(segment.blockKey) * tdee;
  }

  return burned;
}

/** The circadian phase the clock is in. */
export function currentCircadianBlockKey(minutesSinceMidnight: number): BlockKey {
  for (const segment of CIRCADIAN_SEGMENTS) {
    if (minutesSinceMidnight < segment.end) {
      return segment.blockKey;
    }
  }

  return CIRCADIAN_SEGMENTS[CIRCADIAN_SEGMENTS.length - 1].blockKey;
}

/** The current burn rate, for a live readout. */
export function circadianInstantRate(tdee: number, blockKey: BlockKey) {
  const perMinute = circadianRatePerMinute(blockKey) * tdee;

  return { perHour: perMinute * 60, perMinute, perSecond: perMinute / 60 };
}

/**
 * Minutes elapsed since **local** midnight. Anchored on `localDayStartMs` rather than
 * `getHours() * 60 + getMinutes()` so a DST transition shifts the day the same way the rest
 * of the app's calendar-day math does.
 */
export function minutesSinceLocalMidnight(now: Date = new Date()): number {
  return (now.getTime() - localDayStartMs(now)) / 60_000;
}
