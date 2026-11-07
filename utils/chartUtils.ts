import type { Locale } from 'date-fns';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Dimensions } from 'react-native';

import i18n from '@/lang/lang';

import { formatAppDecimal } from './formatAppNumber';
import { roundToDecimalPlaces } from './roundDecimal';

export interface XAxisLabel {
  label: string;
  positionPercent: number;
}

export interface YAxisLabel {
  label: string;
  yDomainValue: number;
}

/**
 * Most x labels a chart prints. A phone-width plot is about 300px once the gutters and the y axis
 * are out of the way, so eight labels sat ~43px apart against a 40px label box and dates such as
 * "10/12 10/13" ran into each other; six leaves ~60px between neighbours.
 */
export const MAX_X_LABELS = 6;
export const X_AXIS_LABEL_WIDTH = 40;
export const X_AXIS_LABEL_OFFSET = 20;
/** The least gap between two printed labels: the label box plus a few pixels of air. */
const X_AXIS_LABEL_MIN_GAP = X_AXIS_LABEL_WIDTH + 4;
/** What a plot loses to the page padding, the card padding and the y axis, off the window width. */
const X_AXIS_GUTTERS = 150;

/**
 * How many x labels fit a window `windowWidth` wide: `MAX_X_LABELS` on a normal phone, fewer on a
 * narrow one or at large text, where the layout width shrinks and six 40px labels ran into each
 * other ("10/25 10/28 10/30"). N labels need N - 1 gaps of `X_AXIS_LABEL_MIN_GAP` across the plot.
 */
export function maxXLabelsForWidth(windowWidth: number): number {
  const plotWidth = windowWidth - X_AXIS_GUTTERS;
  const fitting = Math.floor(plotWidth / X_AXIS_LABEL_MIN_GAP) + 1;
  return Math.max(2, Math.min(MAX_X_LABELS, fitting));
}

/**
 * The edge offset the web charts pass to `getXAxisLabelEdgeMargin`. A margin on a centred label
 * moves it by HALF of itself, so 10 only moved the last label 5px and its right end ("11/7") was
 * cut by the chart's edge; 20 moves it 10px, which leaves a five-character date a few pixels past the plot edge (a note, not
 * a cut) without crowding its neighbour.
 */
export const X_AXIS_LABEL_EDGE_MARGIN_WEB = 20;

export function getXAxisLabelEdgeMargin(positionPercent: number, edgeOffset: number): number {
  if (positionPercent === 0) {
    return edgeOffset;
  }

  if (positionPercent === 100) {
    return -edgeOffset;
  }

  return 0;
}

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
  const maxLabels = maxXLabelsForWidth(Dimensions.get('window').width);

  // If we have few enough points, show all of them
  if (data.length <= maxLabels) {
    return data.map((d, i) => ({
      label: formatLabel(d.x),
      positionPercent: (i / (data.length - 1)) * 100,
    }));
  }

  // Otherwise, subsample, keeping the gaps between printed labels even
  const lastIndex = data.length - 1;

  return pickEvenLabelIndices(data.length, maxLabels).map((index) => ({
    label: formatLabel(data[index].x),
    positionPercent: (index / lastIndex) * 100,
  }));
}

/** The widest a gap between printed labels may be, relative to the narrowest. */
const MAX_LABEL_GAP_RATIO = 1.5;

/**
 * Indices of the points to label out of `count` (> `maxLabels`), always including both ends.
 *
 * Stepping by `(count - 1) / (MAX_X_LABELS - 1)` and rounding leaves some gaps a point wider than
 * others — with 7 points it printed indices 0, 1, 2, 4, 5, 6, so one gap was double the rest and
 * read as a label missing from the axis. This takes the most labels (up to `maxLabels`) whose
 * widest gap is within MAX_LABEL_GAP_RATIO of the narrowest.
 */
function pickEvenLabelIndices(count: number, maxLabels: number): number[] {
  const lastIndex = count - 1;

  for (let labelCount = maxLabels; labelCount > 2; labelCount--) {
    const step = lastIndex / (labelCount - 1);
    const indices = Array.from({ length: labelCount }, (_, i) => Math.round(i * step));
    const gaps = indices.slice(1).map((index, i) => index - indices[i]);
    if (Math.max(...gaps) / Math.min(...gaps) <= MAX_LABEL_GAP_RATIO) {
      return indices;
    }
  }

  // Two labels have a single gap, which is always even.
  return [0, lastIndex];
}

/** One day in ms — the padding a single-point time series gets so it still has a domain. */
const SINGLE_POINT_X_PADDING_MS = 86400000;

/**
 * X domain for a time series, assuming `data` is sorted ascending.
 *
 * A single point has no span, so it is widened by a day either side; charting it as
 * `[x, x]` collapses the domain and the line disappears.
 */
export function getTimeSeriesXDomain<T extends { x: number }>(data: T[]): [number, number] {
  if (data.length === 0) {
    return [0, 1];
  }

  const first = data[0].x;
  const last = data[data.length - 1].x;
  if (first === last) {
    return [first - SINGLE_POINT_X_PADDING_MS, last + SINGLE_POINT_X_PADDING_MS];
  }

  return [first, last];
}

/**
 * Y domain padded by 15% of the series' own spread, so a trend fills the plot instead of
 * hugging a zero baseline. Falls back to 10% of the value for a flat series, then to a
 * fixed band when even that is zero. Never returns a negative floor.
 */
export function getPaddedYDomain<T extends { y: number }>(
  data: T[],
  emptyDomain: [number, number] = [0, 100]
): [number, number] {
  if (data.length === 0) {
    return emptyDomain;
  }

  const values = data.map((d) => d.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.15 || max * 0.1 || 10;

  return [Math.max(0, min - padding), max + padding];
}

/**
 * Generates Y-axis labels for a given range.
 *
 * **Locale:** Prefer passing `formatFn` from `useFormatAppNumber()` for full control (units, rounding).
 * When `formatFn` is omitted, labels use {@link formatAppDecimal} with the current i18n locale (comma/dot).
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
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formatValue =
    formatFn ||
    ((v: number) => {
      const rounded = roundToDecimalPlaces(v, 1);
      return formatAppDecimal(locale, rounded, 1);
    });

  for (let i = 0; i < count; i++) {
    const value = min + i * step;
    labels.push({
      label: formatValue(value),
      yDomainValue: value,
    });
  }

  return labels.reverse(); // Return from top to bottom
}
