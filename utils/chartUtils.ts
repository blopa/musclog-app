import { format } from 'date-fns';

export interface XAxisLabel {
  label: string;
  positionPercent: number;
}

const MAX_X_LABELS = 8;

/**
 * Calculates X-axis labels with precise percentage positions.
 * Subsamples labels if they exceed MAX_X_LABELS.
 *
 * @param data Array of objects with an 'x' numeric property (usually timestamp)
 * @param formatFn Optional function to format the x value into a string label
 * @returns Array of XAxisLabel objects
 */
export function getXAxisLabels<T extends { x: number }>(
  data: T[],
  formatFn?: (x: number) => string
): XAxisLabel[] {
  if (data.length === 0) return [];
  if (data.length === 1) {
    return [
      {
        label: formatFn ? formatFn(data[0].x) : format(new Date(data[0].x), 'MMM d'),
        positionPercent: 50,
      },
    ];
  }

  const formatLabel = formatFn || ((x: number) => format(new Date(x), 'MMM d'));

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
