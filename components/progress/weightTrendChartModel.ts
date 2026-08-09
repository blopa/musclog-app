import type { MetricPoint } from '@/database/services/ProgressService';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { trendWeightAtOrBefore } from '@/utils/trendWeight';

export interface WeightTrendSelection {
  date: number;
  trendWeight: number;
  scaleWeight: number | null;
}

export function averageScaleWeightsByDay(raw: MetricPoint[]): MetricPoint[] {
  const byDay = new Map<number, number[]>();
  for (const point of raw) {
    const values = byDay.get(point.date) ?? [];
    values.push(point.value);
    byDay.set(point.date, values);
  }
  return Array.from(byDay, ([date, values]) => ({
    date,
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
  })).sort((a, b) => a.date - b.date);
}

export function selectWeightTrendPoint(
  trend: MetricPoint[],
  raw: MetricPoint[],
  requestedDate: number
): WeightTrendSelection | null {
  const trendPoint = trendWeightAtOrBefore(trend, requestedDate);
  if (!trendPoint) {
    return null;
  }
  const scaleWeight =
    averageScaleWeightsByDay(raw).find((point) => point.date === trendPoint.date)?.value ?? null;
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
  const earliestObservation = Math.min(...raw.map((point) => point.date));
  if (latest.date - earliestObservation < 7 * MS_PER_SOLAR_DAY) {
    return null;
  }
  const previous = trendWeightAtOrBefore(trend, latest.date - 7 * MS_PER_SOLAR_DAY);
  return previous ? latest.value - previous.value : null;
}
