import type { Units } from '@/constants/settings';

import { displayWeightKgNumeric } from './formatDisplayWeight';

/** A single point is a dot, not a trend — a chart only earns its space once there are two. */
export const MIN_ONE_REP_MAX_TREND_POINTS = 2;

export type OneRepMaxTrendPoint = { x: number; y: number };

export type OneRepMaxTrendSummary =
  /** Too little history to say anything. */
  | { kind: 'none' }
  /** Moved by less than the displayed unit can show. */
  | { kind: 'steady'; sessions: number }
  | { kind: 'up' | 'down'; sessions: number; changeKg: number };

/**
 * Describes a per-exercise estimated-1RM series in the terms the UI states it in.
 *
 * The up/down/steady call is made on the value *rounded to the user's display unit*, so the
 * sentence can never claim a change the chart's own numbers do not show — a 40 g drift across
 * a month reads as "holding steady", not "down 0 kg".
 */
export function summarizeOneRepMaxTrend(
  data: OneRepMaxTrendPoint[],
  units: Units
): OneRepMaxTrendSummary {
  if (data.length < MIN_ONE_REP_MAX_TREND_POINTS) {
    return { kind: 'none' };
  }

  const changeKg = data[data.length - 1].y - data[0].y;
  const sessions = data.length;

  if (displayWeightKgNumeric(Math.abs(changeKg), units) === 0) {
    return { kind: 'steady', sessions };
  }

  return { kind: changeKg > 0 ? 'up' : 'down', sessions, changeKg: Math.abs(changeKg) };
}
