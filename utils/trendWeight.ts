import { MS_PER_SOLAR_DAY } from './calendarDate';

export interface WeightPoint {
  date: number;
  value: number;
}

export const TREND_WEIGHT_ALPHA = 0.1;
export const TREND_WEIGHT_WARMUP_DAYS = 28;

export function calculateTrendWeightSeries(
  observedWeightsKg: WeightPoint[],
  options: { alpha?: number } = {}
): WeightPoint[] {
  const alpha = options.alpha ?? TREND_WEIGHT_ALPHA;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
    throw new RangeError('Trend weight alpha must be greater than 0 and at most 1');
  }

  const valuesByDay = new Map<number, number[]>();
  for (const point of observedWeightsKg) {
    if (!Number.isFinite(point.date) || !Number.isFinite(point.value) || point.value <= 0) {
      continue;
    }
    const values = valuesByDay.get(point.date) ?? [];
    values.push(point.value);
    valuesByDay.set(point.date, values);
  }

  const observed = Array.from(valuesByDay, ([date, values]) => ({
    date,
    value: values.reduce((sum, value) => sum + value, 0) / values.length,
  })).sort((a, b) => a.date - b.date);

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
