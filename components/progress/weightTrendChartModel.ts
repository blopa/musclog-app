import type { MetricPoint } from '@/database/services/ProgressService';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { trendWeightAtOrBefore } from '@/utils/trendWeight';

export interface WeightTrendSelection {
  date: number;
  trendWeight: number;
  scaleWeight: number | null;
}

/**
 * The tooltip's reading for a touched date.
 *
 * Takes the already-averaged scale series rather than the raw one: this runs on every pointer
 * move, and rebuilding the by-day map inside it meant re-grouping and re-sorting the entire
 * history for a single `find`. The chart computes that series once per render anyway.
 */
export function selectWeightTrendPoint(
  trend: MetricPoint[],
  scaleWeightsByDay: MetricPoint[],
  requestedDate: number
): WeightTrendSelection | null {
  const trendPoint = trendWeightAtOrBefore(trend, requestedDate);
  if (!trendPoint) {
    return null;
  }

  const scaleWeight =
    scaleWeightsByDay.find((point) => point.date === trendPoint.date)?.value ?? null;
  return { date: trendPoint.date, trendWeight: trendPoint.value, scaleWeight };
}

export function trailingSevenDayTrendChange(
  trend: MetricPoint[],
  raw: MetricPoint[]
): number | null {
  if (trend.length === 0 || raw.length === 0) {
    return null;
  }
  const latest = trend[trend.length - 1];
  // `raw` arrives ascending from ProgressService, so the first entry is the earliest observation.
  // Reading it directly avoids spreading the whole history through `Math.min`.
  const earliestObservation = raw[0].date;
  if (latest.date - earliestObservation < 7 * MS_PER_SOLAR_DAY) {
    return null;
  }
  const previous = trendWeightAtOrBefore(trend, latest.date - 7 * MS_PER_SOLAR_DAY);
  return previous ? latest.value - previous.value : null;
}
