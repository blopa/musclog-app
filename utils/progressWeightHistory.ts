import type { Units } from '@/constants/settings';

import { calculateTrendWeightSeries, type WeightPoint } from './trendWeight';
import { kgToDisplay } from './unitConversion';

export interface ProgressWeightHistory {
  raw: WeightPoint[];
  trend: WeightPoint[];
}

/** Builds visible display data from an expanded, UTC-day-normalized kilogram history. */
export function prepareProgressWeightHistory(
  expandedObservedKg: WeightPoint[],
  visibleStartDayKey: number,
  visibleEndDayKey: number,
  units: Units
): ProgressWeightHistory {
  const inVisibleRange = (point: WeightPoint) =>
    point.date >= visibleStartDayKey && point.date <= visibleEndDayKey;
  const toDisplay = (point: WeightPoint): WeightPoint => ({
    date: point.date,
    value: kgToDisplay(point.value, units),
  });

  return {
    raw: expandedObservedKg.filter(inVisibleRange).map(toDisplay),
    trend: calculateTrendWeightSeries(expandedObservedKg).filter(inVisibleRange).map(toDisplay),
  };
}
