import { buildCycleComparison, comparisonValue } from '../cycleComparison';
import { blankDayLog, isEmptyDayLog, patchDayLog } from '../dayLog';
import { observationDraft, resolveObservationDraft } from '../observationDraft';
import type { CycleDayLogDto } from '../types';

const date = (day: number) => new Date(2024, 2, day).getTime();
const log = (day: number, extra: Partial<CycleDayLogDto> = {}): CycleDayLogDto => ({
  ...blankDayLog(date(day)),
  id: String(day),
  timezone: '+01:00',
  ...extra,
});
const config = { fallbackCycleLength: 28, fallbackPeriodDuration: 5 };

describe('observations', () => {
  it('preserves hidden custom values, labels, zero and false through draft editing', () => {
    const original = {
      sleepHours: 0,
      sex: false,
      custom: { old: 0 },
      customLabels: { old: 'Retired field' },
    };
    expect(resolveObservationDraft(observationDraft(original), config, original)).toEqual(original);
    expect(isEmptyDayLog({ ...blankDayLog(date(1)), observations: { sex: false } })).toBe(false);
    expect(isEmptyDayLog({ ...blankDayLog(date(1)), observations: { sleepHours: 0 } })).toBe(false);
    expect(
      patchDayLog(log(1, { observations: original }), date(1), { bleeding: 'light' }).observations
    ).toEqual(original);
  });
  it('accepts decimal commas from localized keyboards', () => {
    expect(resolveObservationDraft({ temperatureC: '36,5', sleepHours: '7,5' }, config)).toEqual({
      temperatureC: 36.5,
      sleepHours: 7.5,
    });
  });

  it('rejects invalid numbers and out-of-range observations', () => {
    expect(() => resolveObservationDraft({ sleepHours: '25' }, config)).toThrow();
    expect(() => resolveObservationDraft({ temperatureC: 'abc' }, config)).toThrow();
    expect(() => resolveObservationDraft({ sleepHours: '  ' }, config)).toThrow();
    expect(() =>
      resolveObservationDraft(
        { 'custom:a': 'NaN' },
        { ...config, customFields: [{ id: 'a', label: 'a', kind: 'number' }] }
      )
    ).toThrow();
  });
});

describe('cycle comparison', () => {
  it('distinguishes missing observations, explicit none, numeric zero and unrated presence', () => {
    expect(comparisonValue(undefined, undefined, 'pain')).toBeNull();
    expect(comparisonValue(log(1, { pain: 0 }), undefined, 'pain')).toBe(0);
    expect(comparisonValue(log(1, { noSymptoms: true }), undefined, 'symptom:cramps')).toBe(0);
    expect(comparisonValue(log(1), undefined, 'symptom:cramps')).toBeNull();
    expect(
      comparisonValue(
        log(1, { symptoms: [{ key: 'cramps', severity: null }] }),
        undefined,
        'symptom:cramps'
      )
    ).toBe(-1);
  });
  it('aligns the full cycle and the fortnight before the next actual start', () => {
    const periods = [
      { startDate: date(1), endDate: null },
      { startDate: date(29), endDate: null },
    ];
    const logs = [log(24, { pain: 8 })];
    const before = buildCycleComparison(periods, logs, [], 'pain', 'before', date(30));
    expect(before).toHaveLength(1);
    expect(before[0].cells.find((c) => c.date === date(24))).toMatchObject({ day: -5, value: 8 });
    const start = buildCycleComparison(periods, logs, [], 'pain', 'start', date(30));
    expect(start[0].cells).toHaveLength(28);
    expect(start[0].cells[23]).toMatchObject({ day: 24, value: 8 });
    expect(start[1]).toMatchObject({ complete: false });
    expect(start[1].cells).toHaveLength(2);
  });
  it('uses calendar dates across DST and does not invent a next start for an unfinished cycle', () => {
    const rows = buildCycleComparison(
      [{ startDate: date(9), endDate: null }],
      [],
      [{ date: date(11), value: 0 }],
      'mood',
      'start',
      date(12)
    );
    expect(rows[0].cells.map((c) => c.date)).toEqual([date(9), date(10), date(11), date(12)]);
    expect(rows[0].cells[2].value).toBe(0);
    expect(
      buildCycleComparison(
        [{ startDate: date(1), endDate: null }],
        [],
        [],
        'bleeding',
        'before',
        date(30)
      )
    ).toEqual([]);
  });
});
