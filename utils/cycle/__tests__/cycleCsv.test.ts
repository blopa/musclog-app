import { buildCycleHistory } from '../cycleHistory';
import { csvCell, dayLogsCsv, periodsCsv } from '../cycleCsv';
import type { CycleDayLogDto, CyclePeriodDto } from '../types';

const day = (n: number) => new Date(2024, 0, n).getTime();

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell('plain')).toBe('plain');
  });

  it('defuses spreadsheet formulas in text but not in numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-3 cramps')).toBe("'-3 cramps");
    expect(csvCell(-3)).toBe('-3');
  });

  it('writes empty for null and undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('periodsCsv', () => {
  const periods: CyclePeriodDto[] = [
    {
      id: 'a',
      cycleId: 'c',
      startDate: day(1),
      endDate: day(5),
      endKind: 'logged',
      timezone: '+00:00',
      excludedFromStats: false,
      note: 'heavy, clots',
    },
    {
      id: 'b',
      cycleId: 'c',
      startDate: day(29),
      endDate: null,
      endKind: 'open',
      timezone: '+00:00',
      excludedFromStats: false,
      note: '',
    },
  ];

  it('writes a header, ISO dates, cycle length and the quoted note', () => {
    const lines = periodsCsv(periods, buildCycleHistory(periods)).trim().split('\r\n');
    expect(lines[0]).toBe(
      'start_date,end_date,end_kind,duration_days,cycle_length_days,used_for_predictions,not_used_reason,note'
    );
    expect(lines[1]).toBe('2024-01-01,2024-01-05,logged,5,28,true,,"heavy, clots"');
    expect(lines[2].startsWith('2024-01-29,,open,')).toBe(true);
  });

  it('labels a period that was not used for predictions with its reason', () => {
    const excluded = periods.map((p, i) => (i === 0 ? { ...p, excludedFromStats: true } : p));
    expect(periodsCsv(excluded, buildCycleHistory(excluded))).toContain(',false,user_excluded,');
  });
});

describe('dayLogsCsv', () => {
  it('writes severity pairs and keeps "no symptoms" distinct from an unlogged day', () => {
    const logs: CycleDayLogDto[] = [
      {
        id: '1',
        date: day(2),
        timezone: '+00:00',
        bleeding: 'light',
        symptoms: [
          { key: 'cramps', severity: 3 },
          { key: 'acne', severity: null },
        ],
        noSymptoms: false,
        pain: 7,
        energy: 2,
        note: '',
      },
      {
        id: '2',
        date: day(3),
        timezone: '+00:00',
        bleeding: null,
        symptoms: [],
        noSymptoms: true,
        pain: null,
        energy: null,
        note: '',
      },
    ];
    const lines = dayLogsCsv(logs).trim().split('\r\n');
    expect(lines[1]).toBe('2024-01-02,light,7,2,false,cramps:3;acne:,');
    expect(lines[2]).toBe('2024-01-03,,,,true,,');
  });
});
