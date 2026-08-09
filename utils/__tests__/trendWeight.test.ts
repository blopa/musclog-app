import { MS_PER_SOLAR_DAY, utcNormalizedDayKey } from '@/utils/calendarDate';
import {
  calculateTrendWeightSeries,
  TREND_WEIGHT_ALPHA,
  TREND_WEIGHT_WARMUP_DAYS,
  trendWeightAtOrBefore,
  WeightPoint,
} from '@/utils/trendWeight';
import { kgToDisplay } from '@/utils/unitConversion';

const DAY = MS_PER_SOLAR_DAY;
const day = (index: number) => Date.UTC(2026, 0, 1) + index * DAY;

describe('calculateTrendWeightSeries', () => {
  it('handles empty and one-point input', () => {
    expect(calculateTrendWeightSeries([])).toEqual([]);
    expect(calculateTrendWeightSeries([{ date: day(2), value: 80 }])).toEqual([
      { date: day(2), value: 80 },
    ]);
  });

  it('sorts without mutating input and averages same-day observations', () => {
    const input: WeightPoint[] = [
      { date: day(2), value: 78 },
      { date: day(0), value: 80 },
      { date: day(0), value: 82 },
    ];
    const snapshot = input.map((point) => ({ ...point }));
    const result = calculateTrendWeightSeries(input);

    expect(input).toEqual(snapshot);
    expect(result[0]).toEqual({ date: day(0), value: 81 });
    expect(result).toHaveLength(3);
  });

  it('linearly interpolates missing days and does not extrapolate', () => {
    const result = calculateTrendWeightSeries(
      [
        { date: day(2), value: 80 },
        { date: day(6), value: 76 },
      ],
      { alpha: 1 }
    );
    expect(result).toEqual([
      { date: day(2), value: 80 },
      { date: day(3), value: 79 },
      { date: day(4), value: 78 },
      { date: day(5), value: 77 },
      { date: day(6), value: 76 },
    ]);
  });

  it('handles a long gap without carrying beyond the last observation', () => {
    const result = calculateTrendWeightSeries(
      [
        { date: day(0), value: 90 },
        { date: day(40), value: 86 },
      ],
      { alpha: 1 }
    );
    expect(result).toHaveLength(41);
    expect(result[20]).toEqual({ date: day(20), value: 88 });
    expect(result[result.length - 1].date).toBe(day(40));
  });

  it('uses a calm EWMA for alternating water-weight noise', () => {
    const observed = Array.from({ length: 15 }, (_, index) => ({
      date: day(index),
      value: index % 2 === 0 ? 81 : 79,
    }));
    const result = calculateTrendWeightSeries(observed);
    expect(TREND_WEIGHT_ALPHA).toBe(0.1);
    expect(result[result.length - 1].value).toBeCloseTo(80.269359, 5);
    expect(Math.max(...result.map((point) => point.value))).toBeLessThanOrEqual(81);
  });

  it.each([
    ['cut', [90, 89, 88], 89.71],
    ['maintenance', [80, 82, 80], 80.18],
    ['bulk', [70, 71, 72], 70.29],
  ])('locks the %s golden fixture', (_name, values, expected) => {
    const result = calculateTrendWeightSeries(
      (values as number[]).map((value, index) => ({ date: day(index), value }))
    );
    expect(result[result.length - 1].value).toBeCloseTo(expected as number, 8);
  });

  it('rejects invalid alpha values', () => {
    for (const alpha of [0, -0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateTrendWeightSeries([], { alpha })).toThrow(RangeError);
    }
  });

  it('produces equivalent imperial display values after boundary conversion', () => {
    const trendKg = calculateTrendWeightSeries([
      { date: day(0), value: 80 },
      { date: day(2), value: 78 },
    ]);
    trendKg.forEach((point) => {
      expect(kgToDisplay(point.value, 'imperial')).toBeCloseTo(point.value * 2.20462, 3);
    });
  });

  it('accepts UTC-normalized keys across DST and mixed stored timezones', () => {
    const points = [
      {
        date: utcNormalizedDayKey(Date.parse('2026-03-28T22:30:00Z'), 'Europe/Amsterdam'),
        value: 80,
      },
      {
        date: utcNormalizedDayKey(Date.parse('2026-03-29T22:30:00Z'), 'America/New_York'),
        value: 79,
      },
    ];
    const trend = calculateTrendWeightSeries(points, { alpha: 1 });
    expect(trend.every((point) => point.date % MS_PER_SOLAR_DAY === 0)).toBe(true);
    expect(trend[0].date).toBeLessThan(trend[trend.length - 1].date);
  });

  it('keeps overlapping range values stable when the warm-up is included', () => {
    const observed = Array.from({ length: 100 }, (_, index) => ({
      date: day(index),
      value: 90 - index * 0.05 + (index % 3 === 0 ? 0.8 : -0.2),
    }));
    const full = calculateTrendWeightSeries(observed);
    const visibleStart = day(70);
    const short = calculateTrendWeightSeries(
      observed.filter((point) => point.date >= visibleStart - TREND_WEIGHT_WARMUP_DAYS * DAY)
    );
    const fullPoint = full.find((point) => point.date === visibleStart)!;
    const shortPoint = short.find((point) => point.date === visibleStart)!;
    expect(Math.abs(shortPoint.value - fullPoint.value)).toBeLessThan(0.02);
  });
});

describe('trendWeightAtOrBefore', () => {
  const trend = [
    { date: day(1), value: 80 },
    { date: day(2), value: 79.9 },
  ];

  expect(trendWeightAtOrBefore(trend, day(0))).toBeNull();
  expect(trendWeightAtOrBefore(trend, day(1))).toEqual(trend[0]);
  expect(trendWeightAtOrBefore(trend, day(3))).toEqual(trend[1]);
});
