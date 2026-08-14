import { getPaddedYDomain, getTimeSeriesXDomain, getXAxisLabels } from '@/utils/chartUtils';

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
    expect(labels).toHaveLength(8);
    expect(labels[0].positionPercent).toBe(0);
    expect(labels[labels.length - 1].positionPercent).toBe(100);
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
