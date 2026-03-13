import { getXAxisLabels } from '../chartUtils';

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
    const data = [
      { x: 100 },
      { x: 200 },
      { x: 300 }
    ];
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
