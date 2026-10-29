import { activityLevel, buildActivityHeatmap } from '@/utils/activityHeatmap';

// Wednesday, 14 October 2026 (local), the day the grid ends on in most cases below.
const WEDNESDAY = new Date(2026, 9, 14);

const isoOf = (cell: { iso: string } | null) => cell?.iso ?? null;

describe('activityLevel', () => {
  it('is 0 only for no activity', () => {
    expect(activityLevel(0, 10)).toBe(0);
    expect(activityLevel(-3, 10)).toBe(0);
    expect(activityLevel(Number.NaN, 10)).toBe(0);
    expect(activityLevel(5, 0)).toBe(0);
  });

  it('never rounds a quiet day down to empty', () => {
    expect(activityLevel(0.01, 1000)).toBe(1);
    expect(activityLevel(1, 100)).toBe(1);
  });

  it('reaches the top level exactly at the maximum', () => {
    expect(activityLevel(10, 10)).toBe(4);
    expect(activityLevel(7.5, 10)).toBe(3);
    expect(activityLevel(5, 10)).toBe(2);
    expect(activityLevel(2.5, 10)).toBe(1);
  });

  it('caps a value above the maximum at the top level', () => {
    expect(activityLevel(50, 10)).toBe(4);
  });
});

describe('buildActivityHeatmap', () => {
  it('draws one column of seven rows per week', () => {
    const model = buildActivityHeatmap({ days: [], endDate: WEDNESDAY, weeks: 12 });

    expect(model.columns).toHaveLength(12);
    model.columns.forEach((column) => expect(column).toHaveLength(7));
  });

  it('clamps the week count to a sensible range', () => {
    expect(buildActivityHeatmap({ days: [], endDate: WEDNESDAY, weeks: 0 }).columns).toHaveLength(
      1
    );
    expect(buildActivityHeatmap({ days: [], endDate: WEDNESDAY, weeks: 500 }).columns).toHaveLength(
      53
    );
    expect(
      buildActivityHeatmap({ days: [], endDate: WEDNESDAY, weeks: Number.NaN }).columns
    ).toHaveLength(26);
  });

  it('starts each column on the chosen weekday', () => {
    const sunday = buildActivityHeatmap({
      days: [],
      endDate: WEDNESDAY,
      weeks: 3,
      weekStartsOn: 0,
    });
    const monday = buildActivityHeatmap({
      days: [],
      endDate: WEDNESDAY,
      weeks: 3,
      weekStartsOn: 1,
    });

    sunday.columns.forEach((column) => expect(column[0]?.date.getDay()).toBe(0));
    monday.columns.forEach((column) => expect(column[0]?.date.getDay()).toBe(1));
  });

  it('leaves the days after the end date empty and keeps the others in place', () => {
    const model = buildActivityHeatmap({ days: [], endDate: WEDNESDAY, weeks: 2, weekStartsOn: 0 });
    const lastColumn = model.columns[1];

    // Sunday to Wednesday exist; Thursday to Saturday are in the future.
    expect(lastColumn.map(isoOf)).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      null,
      null,
      null,
    ]);
    expect(model.columns[0].every((cell) => cell != null)).toBe(true);
  });

  it('is continuous across a month and year boundary, one calendar day per row', () => {
    const model = buildActivityHeatmap({
      days: [],
      endDate: new Date(2027, 0, 6),
      weeks: 3,
      weekStartsOn: 0,
    });
    const flat = model.columns.flat().map(isoOf);

    expect(flat.slice(0, 8)).toEqual([
      '2026-12-20',
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
      '2026-12-27',
    ]);
    expect(flat).toContain('2026-12-31');
    expect(flat).toContain('2027-01-01');
  });

  it('places values on their day and reports the totals', () => {
    const model = buildActivityHeatmap({
      days: [
        { date: '2026-10-12', value: 2 },
        { date: '2026-10-14', value: 4 },
        { date: '2020-01-01', value: 99 },
      ],
      endDate: WEDNESDAY,
      weeks: 2,
      weekStartsOn: 0,
    });
    const byIso = new Map(model.columns.flat().flatMap((c) => (c ? [[c.iso, c] as const] : [])));

    expect(byIso.get('2026-10-12')?.value).toBe(2);
    expect(byIso.get('2026-10-12')?.level).toBe(2);
    expect(byIso.get('2026-10-14')?.level).toBe(4);
    expect(byIso.get('2026-10-13')?.level).toBe(0);
    // A day outside the window neither draws nor moves the scale.
    expect(model.max).toBe(4);
    expect(model.total).toBe(6);
    expect(model.activeDays).toBe(2);
  });

  it('sums repeated days and ignores malformed or non-positive entries', () => {
    const model = buildActivityHeatmap({
      days: [
        { date: '2026-10-13', value: 1 },
        { date: '2026-10-13', value: 2 },
        { date: '13/10/2026', value: 50 },
        { date: '2026-10-12', value: -4 },
        { date: '2026-10-11', value: Number.NaN },
      ],
      endDate: WEDNESDAY,
      weeks: 1,
      weekStartsOn: 0,
    });

    expect(model.total).toBe(3);
    expect(model.activeDays).toBe(1);
    expect(model.max).toBe(3);
  });

  it('lets maxValue set the scale, so one outlier does not flatten the rest', () => {
    const days = [
      { date: '2026-10-12', value: 2 },
      { date: '2026-10-13', value: 100 },
    ];
    const auto = buildActivityHeatmap({ days, endDate: WEDNESDAY, weeks: 1, weekStartsOn: 0 });
    const capped = buildActivityHeatmap({
      days,
      endDate: WEDNESDAY,
      weeks: 1,
      weekStartsOn: 0,
      maxValue: 4,
    });
    const level = (model: typeof auto, iso: string) =>
      model.columns.flat().find((cell) => cell?.iso === iso)?.level;

    expect(level(auto, '2026-10-12')).toBe(1);
    expect(level(capped, '2026-10-12')).toBe(2);
    expect(level(capped, '2026-10-13')).toBe(4);
  });

  it('labels each month once, at the column where it starts', () => {
    const model = buildActivityHeatmap({
      days: [],
      endDate: new Date(2026, 9, 31),
      weeks: 14,
      weekStartsOn: 0,
    });

    const months = model.monthLabels.map((label) => label.date.getMonth());
    expect(months).toEqual([...new Set(months)]);
    expect(months[months.length - 1]).toBe(9);
    for (let i = 1; i < model.monthLabels.length; i++) {
      expect(model.monthLabels[i].column - model.monthLabels[i - 1].column).toBeGreaterThanOrEqual(
        3
      );
    }
  });

  it('drops the first month label when the second would overprint it', () => {
    // The first column is the end of September; October starts two columns later.
    const model = buildActivityHeatmap({
      days: [],
      endDate: new Date(2026, 9, 14),
      weeks: 3,
      weekStartsOn: 0,
    });

    expect(model.monthLabels).toHaveLength(1);
    expect(model.monthLabels[0].date.getMonth()).toBe(9);
  });

  it('returns the seven weekdays in row order', () => {
    const sunday = buildActivityHeatmap({
      days: [],
      endDate: WEDNESDAY,
      weeks: 1,
      weekStartsOn: 0,
    });
    const monday = buildActivityHeatmap({
      days: [],
      endDate: WEDNESDAY,
      weeks: 1,
      weekStartsOn: 1,
    });

    expect(sunday.weekdays.map((d) => d.getDay())).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(monday.weekdays.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
