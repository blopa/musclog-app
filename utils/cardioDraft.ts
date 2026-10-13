import type { Units } from '@/constants/settings';

import { displayDistanceToMeters } from './unitConversion';

export interface CardioDraftInput {
  /** Distance as typed, in the user's unit (km or mi). */
  distance: number;
  hours: number;
  minutes: number;
  seconds: number;
  units: Units;
}

export interface CardioDraft {
  distanceM: number;
  durationS: number;
  /** Both are above zero and the session is no longer than a day. */
  isValid: boolean;
}

const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Turns what the log-a-walk form holds (display units, three duration fields) into what the
 * service stores (metres, seconds). Anything non-finite or negative counts as zero, so a half-typed
 * field can never produce a NaN that reaches the estimate or the database.
 */
export function buildCardioDraft({
  distance,
  hours,
  minutes,
  seconds,
  units,
}: CardioDraftInput): CardioDraft {
  const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  const durationS = Math.round(clean(hours) * 3600 + clean(minutes) * 60 + clean(seconds));
  const distanceM = displayDistanceToMeters(clean(distance), units);
  return {
    distanceM,
    durationS,
    isValid: distanceM > 0 && durationS > 0 && durationS <= SECONDS_PER_DAY,
  };
}
