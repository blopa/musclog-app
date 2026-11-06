import {
  monthlyLoggedDays,
  monthlySessions,
  yearCalendarMonths,
  yearWeekStrip,
} from '@/utils/yearInReview/yearCharts';

const day = (key: string, value = 1) => ({ day: key, value });

describe('monthlySessions', () => {
  it('sums sessions per month, January first', () => {
    const counts = monthlySessions([day('2026-01-05'), day('2026-01-06', 2), day('2026-12-31')]);

    expect(counts).toHaveLength(12);
    expect(counts[0]).toBe(3);
    expect(counts[11]).toBe(1);
    expect(counts.slice(1, 11).every((count) => count === 0)).toBe(true);
  });
});

describe('monthlyLoggedDays', () => {
  it('counts days, not meals, per month', () => {
    const counts = monthlyLoggedDays([
      day('2026-02-01', 5),
      day('2026-02-02', 1),
      day('2026-12-31'),
    ]);

    expect(counts[1]).toBe(2);
    expect(counts[11]).toBe(1);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
});

describe('yearWeekStrip', () => {
  it('has one cell per Monday-first week touching the year', () => {
    // 2026 starts on a Thursday and ends on a Thursday: 53 weeks touch it.
    expect(yearWeekStrip(2026, [])).toHaveLength(53);
    // 2024 starts on a Monday and ends on a Tuesday, also 53.
    expect(yearWeekStrip(2024, [])).toHaveLength(53);
    // 2018 starts on a Monday and ends on a Monday.
    expect(yearWeekStrip(2018, [])).toHaveLength(53);
    // 2021 starts on a Friday and ends on a Friday.
    expect(yearWeekStrip(2021, [])).toHaveLength(53);
    expect(yearWeekStrip(2023, [])).toHaveLength(53);
  });

  it('marks the longest run and leaves shorter ones as trained', () => {
    const cells = yearWeekStrip(2026, [
      // A single week, then three in a row.
      day('2026-01-07'),
      day('2026-02-02'),
      day('2026-02-09'),
      day('2026-02-16'),
    ]);

    expect(cells.filter((cell) => cell === 'longestRun')).toHaveLength(3);
    expect(cells.filter((cell) => cell === 'trained')).toHaveLength(1);
  });

  it('agrees with the streak on two sessions in one week being one week', () => {
    const cells = yearWeekStrip(2026, [day('2026-03-02'), day('2026-03-08')]);

    expect(cells.filter((cell) => cell === 'longestRun')).toHaveLength(1);
  });

  it('marks the earlier of two equally long runs', () => {
    const cells = yearWeekStrip(2026, [day('2026-02-02'), day('2026-06-01')]);
    const first = cells.indexOf('longestRun');

    expect(cells.lastIndexOf('longestRun')).toBe(first);
    expect(cells.indexOf('trained')).toBeGreaterThan(first);
  });

  it('marks a run that reaches the last week of the year', () => {
    const cells = yearWeekStrip(2026, [day('2026-12-21'), day('2026-12-28')]);

    expect(cells.filter((cell) => cell === 'longestRun')).toHaveLength(2);
    expect(cells[cells.length - 1]).toBe('longestRun');
  });

  it('is all empty for a year with nothing in it', () => {
    expect(yearWeekStrip(2026, []).every((cell) => cell === 'empty')).toBe(true);
  });
});

describe('yearCalendarMonths', () => {
  it('lays out twelve months with their real lengths, leap years included', () => {
    const lengths = (year: number) =>
      yearCalendarMonths(year, []).map(({ levels }) => levels.length);

    expect(lengths(2026)).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
    expect(lengths(2024)[1]).toBe(29);
  });

  it('starts each month on its Monday-first weekday', () => {
    const months = yearCalendarMonths(2026, []);

    // 1 January 2026 is a Thursday, 1 June 2026 a Monday, 1 March 2026 a Sunday.
    expect(months[0].leadingBlanks).toBe(3);
    expect(months[5].leadingBlanks).toBe(0);
    expect(months[2].leadingBlanks).toBe(6);
  });

  it('colours a trained day and never an untrained one, on the Home heatmap scale', () => {
    const months = yearCalendarMonths(2026, [day('2026-03-15'), day('2026-03-16', 2)]);
    const march = months[2].levels;

    expect(march[14]).toBeGreaterThan(0);
    expect(march[15]).toBe(4);
    expect(march.filter((level) => level > 0)).toHaveLength(2);
  });
});
