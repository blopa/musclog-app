import type { Locale } from 'date-fns';
import { format } from 'date-fns';

import type { LineChartDataPoint } from '@/components/charts/LineChart';

import { getXAxisLabels, type XAxisLabel } from './chartUtils';

export type VolumeTrend = {
  percentage: number;
  data: LineChartDataPoint[];
  labels: XAxisLabel[];
};

export type VolumeTrendEntry = {
  id: string;
  /** Epoch ms the session started (falls back to completion time). */
  date: number;
  volume: number;
};

export const EMPTY_VOLUME_TREND: VolumeTrend = { percentage: 0, data: [], labels: [] };

const CHART_HEIGHT = 100;

/**
 * Turns per-session volumes into the chart series shared by the workout and the per-exercise
 * trend. The change is measured against the session before `currentId`; fewer than two
 * sessions is no trend at all.
 */
export function buildVolumeTrend(
  entries: VolumeTrendEntry[],
  currentId: string,
  locale: Locale
): VolumeTrend {
  const sorted = entries.filter((entry) => entry.volume > 0).sort((a, b) => a.date - b.date);
  if (sorted.length < 2) {
    return EMPTY_VOLUME_TREND;
  }

  const currentIndex = sorted.findIndex((entry) => entry.id === currentId);
  const currentVolume = currentIndex >= 0 ? sorted[currentIndex].volume : 0;
  const previousVolume = currentIndex > 0 ? sorted[currentIndex - 1].volume : 0;
  const percentage =
    previousVolume > 0 && currentIndex > 0
      ? Math.round(((currentVolume - previousVolume) / previousVolume) * 100)
      : 0;

  const volumes = sorted.map((entry) => entry.volume);
  const minVolume = Math.min(...volumes);
  const range = Math.max(...volumes) - minVolume || 1;

  // The x value is the index so `getXAxisLabels` and the chart domain line up.
  const data: LineChartDataPoint[] = sorted.map((entry, index) => ({
    x: index,
    // The chart's y axis points up, so the highest volume gets the largest y.
    y: ((entry.volume - minVolume) / range) * CHART_HEIGHT,
  }));

  const labels = getXAxisLabels(
    sorted.map((entry, index) => ({ x: index, date: new Date(entry.date) })),
    (x) => format(new Date(sorted[x].date), 'MMM d', { locale }),
    locale
  );

  return { percentage, data, labels };
}
