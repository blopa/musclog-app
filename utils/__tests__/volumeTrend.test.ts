import { enUS } from 'date-fns/locale';

import { buildVolumeTrend, EMPTY_VOLUME_TREND } from '@/utils/volumeTrend';

const DAY = 86_400_000;
const START = new Date(2026, 0, 1, 9).getTime();

describe('buildVolumeTrend', () => {
  it('is empty with fewer than two sessions that have volume', () => {
    expect(buildVolumeTrend([{ id: 'a', date: START, volume: 100 }], 'a', enUS)).toEqual(
      EMPTY_VOLUME_TREND
    );
    expect(
      buildVolumeTrend(
        [
          { id: 'a', date: START, volume: 100 },
          { id: 'b', date: START + DAY, volume: 0 },
        ],
        'b',
        enUS
      )
    ).toEqual(EMPTY_VOLUME_TREND);
  });

  it('orders by date and measures the change against the session before the current one', () => {
    const trend = buildVolumeTrend(
      [
        { id: 'c', date: START + 2 * DAY, volume: 150 },
        { id: 'a', date: START, volume: 50 },
        { id: 'b', date: START + DAY, volume: 100 },
      ],
      'c',
      enUS
    );

    expect(trend.percentage).toBe(50);
    expect(trend.data.map((p) => p.x)).toEqual([0, 1, 2]);
    // The chart's y axis points up: highest volume at the top (100), lowest at the bottom (0).
    expect(trend.data[0].y).toBe(0);
    expect(trend.data[2].y).toBe(100);
  });

  it('reports no change for the first session', () => {
    const trend = buildVolumeTrend(
      [
        { id: 'a', date: START, volume: 50 },
        { id: 'b', date: START + DAY, volume: 100 },
      ],
      'a',
      enUS
    );

    expect(trend.percentage).toBe(0);
  });
});
