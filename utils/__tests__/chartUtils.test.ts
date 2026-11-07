import { Dimensions } from 'react-native';

import {
  getPaddedYDomain,
  getXAxisLabelEdgeMargin,
  getTimeSeriesXDomain,
  getXAxisLabels,
  MAX_X_LABELS,
  maxXLabelsForWidth,
  X_AXIS_LABEL_EDGE_MARGIN_WEB,
  X_AXIS_LABEL_WIDTH,
} from '@/utils/chartUtils';

describe('getXAxisLabels', () => {
  it('returns empty array for empty data', () => {
    expect(getXAxisLabels([])).toEqual([]);
  });

  it('returns single label for single data point at 50%', () => {
    const data = [{ x: 1000 }];
    const labels = getXAxisLabels(data);
    expect(labels).toHaveLength(1);
    expect(labels[0].positionPercent).toBe(50);
  });

  it('returns all labels when data length <= MAX_X_LABELS', () => {
    const data = [{ x: 100 }, { x: 200 }, { x: 300 }];
    const labels = getXAxisLabels(data);
    expect(labels).toHaveLength(3);
    expect(labels[0].positionPercent).toBe(0);
    expect(labels[1].positionPercent).toBe(50);
    expect(labels[2].positionPercent).toBe(100);
  });

  it('subsamples to MAX_X_LABELS when data is large', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ x: i * 100 }));
    const labels = getXAxisLabels(data);
    expect(labels).toHaveLength(MAX_X_LABELS);
    expect(labels[0].positionPercent).toBe(0);
    expect(labels[labels.length - 1].positionPercent).toBe(100);
  });

  it('keeps neighbouring labels at least one label box apart on a phone-width plot', () => {
    const plotWidth = 300;
    const labels = getXAxisLabels(Array.from({ length: 40 }, (_, i) => ({ x: i * 100 })));
    for (let i = 1; i < labels.length; i++) {
      const gapPx = ((labels[i].positionPercent - labels[i - 1].positionPercent) / 100) * plotWidth;
      expect(gapPx).toBeGreaterThan(X_AXIS_LABEL_WIDTH);
    }
  });

  it('keeps the gaps between subsampled labels even', () => {
    // Seven points used to print indices 0, 1, 2, 4, 5, 6: one gap twice the others.
    const labels = getXAxisLabels(Array.from({ length: 7 }, (_, i) => ({ x: i })));
    const gaps = labels.slice(1).map((l, i) => l.positionPercent - labels[i].positionPercent);
    expect(labels[0].positionPercent).toBe(0);
    expect(labels[labels.length - 1].positionPercent).toBe(100);
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThanOrEqual(1.5);
  });

  it('never leaves a gap more than 1.5x another, whatever the point count', () => {
    for (let n = MAX_X_LABELS + 1; n <= 60; n++) {
      const labels = getXAxisLabels(Array.from({ length: n }, (_, i) => ({ x: i })));
      const gaps = labels.slice(1).map((l, i) => l.positionPercent - labels[i].positionPercent);
      expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThanOrEqual(1.5 + 1e-9);
    }
  });

  it('uses custom format function', () => {
    const data = [{ x: 100 }, { x: 200 }];
    const formatFn = (x: number) => `Val:${x}`;
    const labels = getXAxisLabels(data, formatFn);
    expect(labels[0].label).toBe('Val:100');
    expect(labels[1].label).toBe('Val:200');
  });
});

describe('getTimeSeriesXDomain', () => {
  it('returns a placeholder domain for empty data', () => {
    expect(getTimeSeriesXDomain([])).toEqual([0, 1]);
  });

  it('spans the first and last points', () => {
    expect(getTimeSeriesXDomain([{ x: 100 }, { x: 200 }, { x: 500 }])).toEqual([100, 500]);
  });

  it('widens a single point by a day either side so the domain does not collapse', () => {
    const day = 86400000;
    expect(getTimeSeriesXDomain([{ x: 1000 }])).toEqual([1000 - day, 1000 + day]);
  });

  it('widens a series whose points all share one timestamp', () => {
    const day = 86400000;
    expect(getTimeSeriesXDomain([{ x: 1000 }, { x: 1000 }])).toEqual([1000 - day, 1000 + day]);
  });
});

describe('getPaddedYDomain', () => {
  it('returns the default empty domain for empty data', () => {
    expect(getPaddedYDomain([])).toEqual([0, 100]);
  });

  it('honours a caller-supplied empty domain', () => {
    expect(getPaddedYDomain([], [10, 20])).toEqual([10, 20]);
  });

  it('pads by 15% of the spread', () => {
    expect(getPaddedYDomain([{ y: 100 }, { y: 200 }])).toEqual([85, 215]);
  });

  it('falls back to 10% of the value when the series is flat', () => {
    expect(getPaddedYDomain([{ y: 100 }, { y: 100 }])).toEqual([90, 110]);
  });

  it('falls back to a fixed band when the series is flat at zero', () => {
    expect(getPaddedYDomain([{ y: 0 }, { y: 0 }])).toEqual([0, 10]);
  });

  it('never returns a negative floor', () => {
    expect(getPaddedYDomain([{ y: 1 }, { y: 100 }])[0]).toBe(0);
  });
});

describe('maxXLabelsForWidth', () => {
  it('keeps the full cap on a large phone and wider', () => {
    // The plot loses about 150px to the page, the card and two y axes, so six 44px slots need a
    // window of about 370px; the narrowest phones print five.
    expect(maxXLabelsForWidth(390)).toBe(MAX_X_LABELS);
    expect(maxXLabelsForWidth(1280)).toBe(MAX_X_LABELS);
    expect(maxXLabelsForWidth(344)).toBe(MAX_X_LABELS - 1);
  });

  it('prints fewer labels as the layout narrows, never fewer than the two ends', () => {
    // A 344px phone at 1.3x text lays out in 264px.
    expect(maxXLabelsForWidth(264)).toBeLessThan(MAX_X_LABELS);
    expect(maxXLabelsForWidth(264)).toBeGreaterThanOrEqual(2);
    expect(maxXLabelsForWidth(100)).toBe(2);
  });

  it('leaves a label box of room between neighbours at the width it picked', () => {
    for (let width = 160; width <= 360; width += 8) {
      const labels = maxXLabelsForWidth(width);
      if (labels > 2) {
        const plot = width - 150;
        expect(plot / (labels - 1)).toBeGreaterThanOrEqual(X_AXIS_LABEL_WIDTH);
      }
    }
  });
});

describe('getXAxisLabels on a narrow window', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ x: i * 1000 }));
  let spy: jest.SpyInstance;

  afterEach(() => spy?.mockRestore());

  it('subsamples to the labels that fit, still keeping both ends', () => {
    spy = jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 264,
      height: 600,
      scale: 1,
      fontScale: 1,
    });
    const labels = getXAxisLabels(data);
    expect(labels.length).toBe(maxXLabelsForWidth(264));
    expect(labels[0].positionPercent).toBe(0);
    expect(labels[labels.length - 1].positionPercent).toBe(100);
  });
});

describe('getXAxisLabelEdgeMargin', () => {
  it('pushes the first label right and the last one left, and leaves the others centred', () => {
    expect(getXAxisLabelEdgeMargin(0, 20)).toBe(20);
    expect(getXAxisLabelEdgeMargin(100, 20)).toBe(-20);
    expect(getXAxisLabelEdgeMargin(40, 20)).toBe(0);
  });

  it('moves a centred label by half the margin, so the web offset must clear half the text', () => {
    // A margin on a centred item shifts it by margin / 2, so the old web offset of 10 moved the
    // last label only 5px. The label's right end sits half its width (about 14px for "07/11" at
    // 10px) past the plot edge; the web offset must pull most of that back (a few pixels past the
    // edge is a warning, 20% of the ink cut is an error) without crowding the neighbouring label.
    const shift = Math.abs(getXAxisLabelEdgeMargin(100, X_AXIS_LABEL_EDGE_MARGIN_WEB)) / 2;
    const overhang = (5 * 10 * 0.56) / 2 - shift;
    expect(shift).toBeGreaterThan(5);
    expect(overhang / (5 * 10 * 0.56)).toBeLessThan(0.2);
    expect(shift).toBeLessThanOrEqual(10);
  });
});
