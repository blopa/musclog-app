import { localDayStartFromUtcMs } from '../calendarDate';
import { calculateEmpiricalTDEEWindow, MetricPoint } from '../progress';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const START_DATE = new Date('2026-01-01').getTime();

/** Local calendar day key for synthetic "day i" timestamps (matches calculateEmpiricalTDEEWindow bucketing). */
const dayKey = (i: number) => localDayStartFromUtcMs(START_DATE + i * MS_PER_DAY);

const avgDayKeys = (indices: number[]) =>
  indices.reduce((sum, i) => sum + dayKey(i), 0) / indices.length;

describe('calculateEmpiricalTDEEWindow', () => {
  it('returns fallback window when weight data is insufficient', () => {
    const weightPoints: MetricPoint[] = [{ date: START_DATE, value: 100 }];
    const fatPoints: MetricPoint[] = [];
    const startDate = START_DATE - 10 * MS_PER_DAY;
    const endDate = START_DATE + 10 * MS_PER_DAY;

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, startDate, endDate);

    expect(result.empiricalStart).toBe(startDate);
    expect(result.empiricalEnd).toBe(endDate);
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(100);
  });

  it('uses first and last weight measurements as fallback if at least 2 exist but no matched BF', () => {
    const weightPoints: MetricPoint[] = [
      { date: START_DATE, value: 100 },
      { date: START_DATE + 10 * MS_PER_DAY, value: 95 },
    ];
    const fatPoints: MetricPoint[] = [];

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(START_DATE);
    expect(result.empiricalEnd).toBe(START_DATE + 10 * MS_PER_DAY);
    expect(result.empiricalDays).toBe(10);
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(95);
  });

  it('picks exactly 2 matched data points', () => {
    const weightPoints: MetricPoint[] = [
      { date: START_DATE, value: 100 },
      { date: START_DATE + 5 * MS_PER_DAY, value: 98 },
      { date: START_DATE + 10 * MS_PER_DAY, value: 95 },
    ];
    const fatPoints: MetricPoint[] = [
      { date: START_DATE, value: 20 },
      { date: START_DATE + 10 * MS_PER_DAY, value: 18 },
    ];

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(dayKey(0));
    expect(result.empiricalEnd).toBe(dayKey(10));
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(95);
    expect(result.initialFat).toBe(20);
    expect(result.finalFat).toBe(18);
    expect(result.empiricalDays).toBe(
      Math.max(0, Math.ceil((dayKey(10) - dayKey(0)) / MS_PER_DAY))
    );
  });

  it('correctly identifies Matched Data Window when measurements are sparse', () => {
    const weightPoints: MetricPoint[] = [
      { date: START_DATE, value: 100 },
      { date: START_DATE + 1 * MS_PER_DAY, value: 99 },
      { date: START_DATE + 2 * MS_PER_DAY, value: 98 },
      { date: START_DATE + 3 * MS_PER_DAY, value: 97 },
    ];
    const fatPoints: MetricPoint[] = [
      { date: START_DATE, value: 20 },
      { date: START_DATE + 1 * MS_PER_DAY, value: 19.5 },
      { date: START_DATE + 3 * MS_PER_DAY, value: 19 },
      { date: START_DATE + 4 * MS_PER_DAY, value: 18.5 },
    ];

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(dayKey(0));
    expect(result.empiricalEnd).toBe(dayKey(3));
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(97);
    expect(result.initialFat).toBe(20);
    expect(result.finalFat).toBe(19);
    expect(result.empiricalDays).toBe(Math.max(0, Math.ceil((dayKey(3) - dayKey(0)) / MS_PER_DAY)));
  });

  it('does NOT use weekly averaging for exactly 14 points', () => {
    const weightPoints: MetricPoint[] = [];
    const fatPoints: MetricPoint[] = [];
    for (let i = 0; i < 14; i++) {
      weightPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 100 - i });
      fatPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 20 - i * 0.1 });
    }

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(dayKey(0));
    expect(result.empiricalEnd).toBe(dayKey(13));
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(87);
    expect(result.empiricalDays).toBe(
      Math.max(0, Math.ceil((dayKey(13) - dayKey(0)) / MS_PER_DAY))
    );
  });

  it('uses weekly averaging for 15 points', () => {
    const weightPoints: MetricPoint[] = [];
    const fatPoints: MetricPoint[] = [];
    for (let i = 0; i < 15; i++) {
      weightPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 100 - i });
      fatPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 20 - i * 0.1 });
    }

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(avgDayKeys([0, 1, 2, 3, 4, 5, 6]));
    expect(result.empiricalEnd).toBe(avgDayKeys([8, 9, 10, 11, 12, 13, 14]));
    expect(result.initialWeight).toBeCloseTo(97, 1);
    expect(result.finalWeight).toBeCloseTo(89, 1);
    expect(result.empiricalDays).toBe(8);
  });

  it('handles large dataset (70 points) correctly with averaging', () => {
    const weightPoints: MetricPoint[] = [];
    const fatPoints: MetricPoint[] = [];
    for (let i = 0; i < 70; i++) {
      weightPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 100 - i });
      fatPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 20 - i * 0.1 });
    }

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(avgDayKeys([0, 1, 2, 3, 4, 5, 6]));
    expect(result.empiricalEnd).toBe(avgDayKeys([63, 64, 65, 66, 67, 68, 69]));
    expect(result.initialWeight).toBeCloseTo(97, 1);
    expect(result.finalWeight).toBeCloseTo(34, 1);
    expect(result.empiricalDays).toBe(63);
  });

  it('handles mismatched sparse data with averaging', () => {
    const matchedDays = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17];
    const weightPoints: MetricPoint[] = matchedDays.map((d) => ({
      date: START_DATE + d * MS_PER_DAY,
      value: 100 - d,
    }));
    const fatPoints: MetricPoint[] = matchedDays.map((d) => ({
      date: START_DATE + d * MS_PER_DAY,
      value: 20 - d * 0.1,
    }));

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(avgDayKeys([0, 1, 2, 3, 4, 5, 6]));
    expect(result.empiricalEnd).toBe(avgDayKeys([11, 12, 13, 14, 15, 16, 17]));
    expect(result.empiricalDays).toBe(11);
  });
});
