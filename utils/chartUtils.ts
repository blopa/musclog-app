import type { Locale } from 'date-fns';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

export interface XAxisLabel {
  label: string;
  positionPercent: number;
}

export interface YAxisLabel {
  label: string;
  yDomainValue: number;
}

export const MAX_X_LABELS = 8;
export const X_AXIS_LABEL_WIDTH = 40;
export const X_AXIS_LABEL_OFFSET = 20;

/**
 * Calculates X-axis labels with precise percentage positions.
 * Subsamples labels if they exceed MAX_X_LABELS.
 *
 * @param data Array of objects with an 'x' numeric property (usually timestamp)
 * @param formatFn Optional function to format the x value into a string label
 * @param locale date-fns locale for default `MMM d` labels (when `formatFn` is omitted)
 * @returns Array of XAxisLabel objects
 */
export function getXAxisLabels<T extends { x: number }>(
  data: T[],
  formatFn?: (x: number) => string,
  locale: Locale = enUS
): XAxisLabel[] {
  if (data.length === 0) {
    return [];
  }
  if (data.length === 1) {
    return [
      {
        label: formatFn ? formatFn(data[0].x) : format(new Date(data[0].x), 'MMM d', { locale }),
        positionPercent: 50,
      },
    ];
  }

  const formatLabel = formatFn || ((x: number) => format(new Date(x), 'MMM d', { locale }));

  // If we have few enough points, show all of them
  if (data.length <= MAX_X_LABELS) {
    return data.map((d, i) => ({
      label: formatLabel(d.x),
      positionPercent: (i / (data.length - 1)) * 100,
    }));
  }

  // Otherwise, subsample to MAX_X_LABELS
  const labels: XAxisLabel[] = [];
  const step = (data.length - 1) / (MAX_X_LABELS - 1);

  for (let i = 0; i < MAX_X_LABELS; i++) {
    const index = Math.min(Math.round(i * step), data.length - 1);
    labels.push({
      label: formatLabel(data[index].x),
      positionPercent: (index / (data.length - 1)) * 100,
    });
  }

  return labels;
}

/**
 * Generates Y-axis labels for a given range
 */
export function getYAxisLabels(
  min: number,
  max: number,
  count: number = 3,
  formatFn?: (v: number) => string
): YAxisLabel[] {
  if (count <= 0) {
    return [];
  }
  const labels: YAxisLabel[] = [];
  const range = max - min;
  const step = count > 1 ? range / (count - 1) : 0;
  const formatValue = formatFn || ((v: number) => String(Math.round(v * 10) / 10));

  for (let i = 0; i < count; i++) {
    const value = min + i * step;
    labels.push({
      label: formatValue(value),
      yDomainValue: value,
    });
  }

  return labels.reverse(); // Return from top to bottom
}
