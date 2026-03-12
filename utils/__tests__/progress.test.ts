
import { calculateEmpiricalTDEEWindow, MetricPoint } from '../progress';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const START_DATE = new Date('2026-01-01').getTime();

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

    expect(result.empiricalStart).toBe(START_DATE);
    expect(result.empiricalEnd).toBe(START_DATE + 10 * MS_PER_DAY);
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(95);
    expect(result.initialFat).toBe(20);
    expect(result.finalFat).toBe(18);
    expect(result.empiricalDays).toBe(10);
  });

  it('correctly identifies Matched Data Window when measurements are sparse', () => {
    // 01/01/2026: Weight & BF -> Matched Start
    // 02/01/2026: Weight & BF
    // 03/01/2026: Only Weight (should be ignored for anchors)
    // 04/01/2026: Weight & BF -> Matched End
    // 05/01/2026: Only BF (should be ignored for anchors)

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

    // Common days are day 0, 1, 3
    expect(result.empiricalStart).toBe(START_DATE);
    expect(result.empiricalEnd).toBe(START_DATE + 3 * MS_PER_DAY);
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(97);
    expect(result.initialFat).toBe(20);
    expect(result.finalFat).toBe(19);
    expect(result.empiricalDays).toBe(3);
  });

  it('does NOT use weekly averaging for exactly 14 points', () => {
    const weightPoints: MetricPoint[] = [];
    const fatPoints: MetricPoint[] = [];
    for (let i = 0; i < 14; i++) {
      weightPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 100 - i });
      fatPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 20 - i * 0.1 });
    }

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    expect(result.empiricalStart).toBe(START_DATE);
    expect(result.empiricalEnd).toBe(START_DATE + 13 * MS_PER_DAY);
    expect(result.initialWeight).toBe(100);
    expect(result.finalWeight).toBe(87);
    expect(result.empiricalDays).toBe(13);
  });

  it('uses weekly averaging for 15 points', () => {
    const weightPoints: MetricPoint[] = [];
    const fatPoints: MetricPoint[] = [];
    for (let i = 0; i < 15; i++) {
      weightPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 100 - i });
      fatPoints.push({ date: START_DATE + i * MS_PER_DAY, value: 20 - i * 0.1 });
    }

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    // startPoints: day 0-6. Avg date: (0+1+2+3+4+5+6)/7 = 3.
    // Start average weight: (100+99+98+97+96+95+94)/7 = 97
    // endPoints: day 8-14. Avg date: (8+9+10+11+12+13+14)/7 = 11.
    // End average weight: (92+91+90+89+88+87+86)/7 = 89

    expect(result.empiricalStart).toBe(START_DATE + 3 * MS_PER_DAY);
    expect(result.empiricalEnd).toBe(START_DATE + 11 * MS_PER_DAY);
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

    // startPoints: day 0-6. Avg date: 3. Start Avg Weight: 97
    // endPoints: day 63-69. Avg date: (63+64+65+66+67+68+69)/7 = 66.
    // End Avg Weight: (100-63 + 100-64 + 100-65 + 100-66 + 100-67 + 100-68 + 100-69)/7 = (37+36+35+34+33+32+31)/7 = 34

    expect(result.empiricalStart).toBe(START_DATE + 3 * MS_PER_DAY);
    expect(result.empiricalEnd).toBe(START_DATE + 66 * MS_PER_DAY);
    expect(result.initialWeight).toBeCloseTo(97, 1);
    expect(result.finalWeight).toBeCloseTo(34, 1);
    expect(result.empiricalDays).toBe(63);
  });

  it('handles mismatched sparse data with averaging', () => {
    // Only matching days: 0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17
    // count = 15
    const matchedDays = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17];
    const weightPoints: MetricPoint[] = matchedDays.map(d => ({ date: START_DATE + d * MS_PER_DAY, value: 100 - d }));
    const fatPoints: MetricPoint[] = matchedDays.map(d => ({ date: START_DATE + d * MS_PER_DAY, value: 20 - d * 0.1 }));

    const result = calculateEmpiricalTDEEWindow(weightPoints, fatPoints, 0, 0);

    // startPoints: first 7 matches (0,1,2,3,4,5,6). Avg date: 3.
    // endPoints: last 7 matches (11,12,13,14,15,16,17). Avg date: 14.

    expect(result.empiricalStart).toBe(START_DATE + 3 * MS_PER_DAY);
    expect(result.empiricalEnd).toBe(START_DATE + 14 * MS_PER_DAY);
    expect(result.empiricalDays).toBe(11);
  });
});
