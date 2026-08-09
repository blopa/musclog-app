import {
  selectWeightTrendPoint,
  trailingSevenDayTrendChange,
} from '@/components/progress/weightTrendChartModel';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { averagePointsByDay } from '@/utils/trendWeight';

const start = Date.UTC(2026, 0, 1);
const day = (index: number) => start + index * MS_PER_SOLAR_DAY;

it('averages same-day scale readings for the raw dot series', () => {
  // The chart's dot series now uses the same canonical collapse as the trend filter and the
  // weekly check-in, rather than its own copy of it.
  expect(
    averagePointsByDay([
      { date: day(1), value: 81 },
      { date: day(0), value: 80 },
      { date: day(1), value: 79 },
    ])
  ).toEqual([
    { date: day(0), value: 80 },
    { date: day(1), value: 80 },
  ]);
});

it('selects the trend and the already-averaged scale weight for that day', () => {
  // Takes the averaged series, not the raw one: this runs on every pointer move, so re-grouping
  // the whole history inside it made the tooltip cost grow with the length of the chart.
  expect(
    selectWeightTrendPoint(
      [
        { date: day(0), value: 80 },
        { date: day(1), value: 79.9 },
      ],
      averagePointsByDay([
        { date: day(1), value: 79 },
        { date: day(1), value: 81 },
      ]),
      day(1)
    )
  ).toEqual({ date: day(1), trendWeight: 79.9, scaleWeight: 80 });
});

it('omits scale weight on interpolated days', () => {
  expect(
    selectWeightTrendPoint([{ date: day(1), value: 79.9 }], [{ date: day(0), value: 80 }], day(1))
  ).toEqual({ date: day(1), trendWeight: 79.9, scaleWeight: null });
});

it('withholds the seven-day change until seven calendar days are covered', () => {
  const trend = Array.from({ length: 8 }, (_, index) => ({ date: day(index), value: 80 - index }));
  expect(trailingSevenDayTrendChange(trend, [{ date: day(1), value: 79 }])).toBeNull();
  expect(
    trailingSevenDayTrendChange(trend, [
      { date: day(0), value: 80 },
      { date: day(7), value: 73 },
    ])
  ).toBe(-7);
});
