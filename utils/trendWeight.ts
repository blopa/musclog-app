import { MS_PER_SOLAR_DAY } from './calendarDate';

export interface WeightPoint {
  date: number;
  value: number;
}

export const TREND_WEIGHT_ALPHA = 0.1;
export const TREND_WEIGHT_WARMUP_DAYS = 28;

/**
 * Collapses every reading that shares a day key into one point at that day's mean, ascending.
 *
 * Someone who weighs in morning and evening has two readings for one day, and every consumer of a
 * daily series — the trend filter, the chart's scatter dots, the weekly check-in — needs them to
 * be one. This was implemented separately in each of those places (and a fourth time, as
 * last-wins rather than mean, in the empirical-TDEE window), so "what is my weight on day X" had
 * more than one answer depending on which screen asked.
 *
 * `skipNonPositive` drops zero/negative and non-finite readings, which only the trend filter wants:
 * a 0 kg reading is corrupt data that would drag the whole exponential filter down for weeks,
 * whereas a chart series has already been validated upstream and should plot what it was given.
 */
export function averagePointsByDay(
  points: WeightPoint[],
  options: { skipNonPositive?: boolean } = {}
): WeightPoint[] {
  const valuesByDay = new Map<number, number[]>();
  for (const point of points) {
    if (
      options.skipNonPositive &&
      (!Number.isFinite(point.date) || !Number.isFinite(point.value) || point.value <= 0)
    ) {
      continue;
    }
    const values = valuesByDay.get(point.date) ?? [];
    values.push(point.value);
    valuesByDay.set(point.date, values);
  }

  return Array.from(valuesByDay, ([date, values]) => ({
    date,
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
  })).sort((a, b) => a.date - b.date);
}

export function calculateTrendWeightSeries(
  observedWeightsKg: WeightPoint[],
  options: { alpha?: number } = {}
): WeightPoint[] {
  const alpha = options.alpha ?? TREND_WEIGHT_ALPHA;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new RangeError('Trend weight alpha must be greater than 0 and at most 1');
  }

  const observed = averagePointsByDay(observedWeightsKg, { skipNonPositive: true });

  if (observed.length <= 1) {
    return observed;
  }

  const daily: WeightPoint[] = [];
  for (let index = 0; index < observed.length - 1; index += 1) {
    const current = observed[index];
    const next = observed[index + 1];
    daily.push(current);

    const gapDays = Math.round((next.date - current.date) / MS_PER_SOLAR_DAY);
    for (let day = 1; day < gapDays; day += 1) {
      daily.push({
        date: current.date + day * MS_PER_SOLAR_DAY,
        value: current.value + ((next.value - current.value) * day) / gapDays,
      });
    }
  }
  daily.push(observed[observed.length - 1]);

  let previousTrend = daily[0].value;
  return daily.map((point, index) => {
    if (index > 0) {
      previousTrend = alpha * point.value + (1 - alpha) * previousTrend;
    }
    return { date: point.date, value: previousTrend };
  });
}

export function trendWeightAtOrBefore(trend: WeightPoint[], dayKey: number): WeightPoint | null {
  let low = 0;
  let high = trend.length - 1;
  let match: WeightPoint | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = trend[middle];
    if (point.date <= dayKey) {
      match = point;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return match;
}
