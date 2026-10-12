import type { Units } from '@/constants/settings';

import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import {
  getDistanceUnitLabel,
  metersToDisplayDistance,
  paceSecondsPerDisplayUnit,
} from './unitConversion';

/** "5.2 km" / "3.23 mi": up to two decimals, no trailing zeros, in the app's number format. */
export function formatDistance(locale: string, distanceM: number, units: Units): string {
  const value = formatAppDecimal(locale, metersToDisplayDistance(distanceM, units), 2);
  return `${value} ${getDistanceUnitLabel(units)}`;
}

/** A clock-style "m:ss" for a pace or a duration under an hour, with locale digits. */
export function formatMinutesSeconds(locale: string, totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${formatAppInteger(locale, minutes)}:${formatAppInteger(locale, seconds, {
    minimumIntegerDigits: 2,
  })}`;
}

/** "5:00 /km" for a session's average pace, or `null` when it has none to show. */
export function formatPace(
  locale: string,
  distanceM: number,
  durationS: number,
  units: Units
): string | null {
  const seconds = paceSecondsPerDisplayUnit(distanceM, durationS, units);
  if (seconds === null) {
    return null;
  }
  return `${formatMinutesSeconds(locale, seconds)} /${getDistanceUnitLabel(units)}`;
}
