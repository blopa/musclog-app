import { summarizeOneRepMaxTrend } from '@/utils/oneRepMaxTrend';

const point = (x: number, y: number) => ({ x, y });

describe('summarizeOneRepMaxTrend', () => {
  it('reports nothing for an empty series', () => {
    expect(summarizeOneRepMaxTrend([], 'metric')).toEqual({ kind: 'none' });
  });

  it('reports nothing for a single session, which is a dot rather than a trend', () => {
    expect(summarizeOneRepMaxTrend([point(1, 100)], 'metric')).toEqual({ kind: 'none' });
  });

  it('reports a rise from the first to the last session', () => {
    const summary = summarizeOneRepMaxTrend([point(1, 100), point(2, 90), point(3, 110)], 'metric');

    expect(summary).toEqual({ kind: 'up', sessions: 3, changeKg: 10 });
  });

  it('reports a fall as a positive magnitude', () => {
    const summary = summarizeOneRepMaxTrend([point(1, 110), point(2, 100)], 'metric');

    expect(summary).toEqual({ kind: 'down', sessions: 2, changeKg: 10 });
  });

  it('calls a change too small to display "steady" rather than a zero change', () => {
    const summary = summarizeOneRepMaxTrend([point(1, 100), point(2, 100.04)], 'metric');

    expect(summary).toEqual({ kind: 'steady', sessions: 2 });
  });

  it('decides steadiness in the unit the user actually sees', () => {
    // 0.03 kg disappears at one decimal place, but the same change is 0.1 lb and does not.
    const data = [point(1, 100), point(2, 100.03)];

    expect(summarizeOneRepMaxTrend(data, 'metric').kind).toBe('steady');
    expect(summarizeOneRepMaxTrend(data, 'imperial').kind).toBe('up');
  });
});
