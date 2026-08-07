import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { prepareProgressWeightHistory } from '@/utils/progressWeightHistory';

const start = Date.UTC(2026, 0, 1);
const day = (index: number) => start + index * MS_PER_SOLAR_DAY;

it('preserves visible raw observations while slicing the derived daily trend', () => {
  const result = prepareProgressWeightHistory(
    [
      { date: day(0), value: 82 },
      { date: day(1), value: 80 },
      { date: day(1), value: 82 },
      { date: day(3), value: 79 },
    ],
    day(1),
    day(3),
    'metric'
  );

  expect(result.raw).toEqual([
    { date: day(1), value: 80 },
    { date: day(1), value: 82 },
    { date: day(3), value: 79 },
  ]);
  expect(result.trend.map((point) => point.date)).toEqual([day(1), day(2), day(3)]);
  expect(result.trend[0].value).toBeCloseTo(81.9, 8);
});

it('converts raw and trend series only at the display boundary', () => {
  const metric = prepareProgressWeightHistory(
    [
      { date: day(0), value: 80 },
      { date: day(1), value: 79 },
    ],
    day(0),
    day(1),
    'metric'
  );
  const imperial = prepareProgressWeightHistory(
    [
      { date: day(0), value: 80 },
      { date: day(1), value: 79 },
    ],
    day(0),
    day(1),
    'imperial'
  );

  expect(imperial.trend[1].value / metric.trend[1].value).toBeCloseTo(2.20462, 3);
  expect(imperial.raw[0].value / metric.raw[0].value).toBeCloseTo(2.20462, 3);
});
