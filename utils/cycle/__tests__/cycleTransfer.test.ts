import { contextsCsv, dayLogsCsv, periodsCsv } from '../cycleCsv';
import { buildCycleHistory } from '../cycleHistory';
import { planCycleMerge } from '../cycleMerge';
import {
  parseCycleCsv,
  parseCycleDate,
  parseCycleTransfer,
  serializeCycleTransfer,
} from '../cycleTransfer';
import { blankDayLog } from '../dayLog';
import type { CycleConfig, CycleContextDto, CycleDayLogDto, CyclePeriodDto } from '../types';

const date = (day: number) => new Date(2024, 0, day).getTime();
const config: CycleConfig = {
  fallbackCycleLength: 30,
  fallbackPeriodDuration: 5,
  goals: ['symptoms'],
  quickLog: ['custom:Headache; left'],
  pinSuggested: ['cramps'],
  customSymptoms: ['Headache; left'],
  enabledFields: ['sleepHours'],
  customFields: [{ id: 'a', label: 'Sleep quality', kind: 'number' }],
};
const period: CyclePeriodDto = {
  id: 'p',
  cycleId: 'c',
  timezone: '+01:00',
  startDate: date(1),
  endDate: date(5),
  endKind: 'logged',
  excludedFromStats: true,
  note: '=private, "note"\nline',
};
const log: CycleDayLogDto = {
  ...blankDayLog(date(2)),
  id: 'd',
  timezone: '+01:00',
  symptoms: [{ key: 'custom:Headache; left', severity: 2 }],
  observations: {
    sleepHours: 0,
    sex: false,
    custom: { a: 0 },
    customLabels: { a: 'Sleep quality' },
  },
  note: '@private',
};
const context: CycleContextDto = {
  id: 'x',
  cycleId: 'c',
  effectiveFrom: date(1),
  timezone: '+01:00',
  lifeStage: 'no_bleeding',
  contraception: 'hormonal_iud',
  note: 'context',
};
const input = {
  config,
  periods: [period],
  dayLogs: [log],
  contexts: [context],
  moods: [{ date: date(2), value: 0 }],
};
const transfer = () => parseCycleTransfer(serializeCycleTransfer(input));

describe('cycle portability', () => {
  it('round-trips a complete cycle file, including zero, false, labels, notes and preferences', () => {
    const parsed = transfer();
    expect(parsed.config).toEqual(config);
    expect(parsed.dayLogs[0]).toMatchObject({
      observations: log.observations,
      note: '@private',
      symptoms: log.symptoms,
    });
    expect(parsed.periods[0]).toMatchObject({
      startDate: date(1),
      endKind: 'logged',
      excludedFromStats: true,
      note: period.note,
    });
    expect(parsed.contexts[0]).toMatchObject({
      lifeStage: 'no_bleeding',
      contraception: 'hormonal_iud',
    });
    expect(parsed.moods).toEqual(input.moods);
  });
  it.each(['2024-02-30', '2024-13-01', '01/02/2024', '2024-1-01', '0099-01-01'])(
    'rejects invalid date %s',
    (value) => expect(() => parseCycleDate(value)).toThrow()
  );
  it('accepts leap dates as calendar days', () =>
    expect(parseCycleDate('2024-02-29')).toBe(new Date(2024, 1, 29).getTime()));
  it('rejects duplicates, contradictory logs, future dates and overlapping periods before writing', () => {
    const raw = JSON.parse(serializeCycleTransfer(input));
    expect(() =>
      parseCycleTransfer(JSON.stringify({ ...raw, dayLogs: [...raw.dayLogs, ...raw.dayLogs] }))
    ).toThrow();
    expect(() =>
      parseCycleTransfer(
        JSON.stringify({ ...raw, dayLogs: [{ ...raw.dayLogs[0], noSymptoms: true }] })
      )
    ).toThrow();
    expect(() =>
      parseCycleTransfer(
        JSON.stringify({
          ...raw,
          periods: [{ ...raw.periods[0], startDate: '2999-01-01', endDate: '2999-01-05' }],
        })
      )
    ).toThrow();
    expect(() =>
      parseCycleTransfer(
        JSON.stringify({
          ...raw,
          periods: [...raw.periods, { ...raw.periods[0], startDate: '2024-01-03' }],
        })
      )
    ).toThrow();
  });
  it('rejects invalid end semantics, unsupported versions, numbers and oversized input', () => {
    const raw = JSON.parse(serializeCycleTransfer(input));
    expect(() => parseCycleTransfer(JSON.stringify({ ...raw, version: 2 }))).toThrow();
    expect(() =>
      parseCycleTransfer(
        JSON.stringify({ ...raw, periods: [{ ...raw.periods[0], endKind: 'unknown' }] })
      )
    ).toThrow();
    expect(() =>
      parseCycleTransfer(JSON.stringify({ ...raw, moods: [{ date: '2024-01-01', value: 8 }] }))
    ).toThrow();
    expect(() => parseCycleTransfer(' '.repeat(5_000_001))).toThrow();
  });
  it('reads exported CSVs with quoted notes, custom punctuation, mood zero and context', () => {
    expect(
      parseCycleTransfer(periodsCsv([period], buildCycleHistory([period]))).periods[0].note
    ).toBe(period.note);
    expect(parseCycleTransfer(dayLogsCsv([log], input.moods)).dayLogs[0]).toMatchObject({
      observations: log.observations,
      symptoms: log.symptoms,
      note: log.note,
    });
    expect(parseCycleTransfer(dayLogsCsv([log], input.moods)).moods).toEqual(input.moods);
    expect(parseCycleTransfer(contextsCsv([context])).contexts[0]).toMatchObject({
      effectiveFrom: date(1),
      lifeStage: 'no_bleeding',
    });
  });
  it('supports the previous daily CSV format without inventing mood or fields', () => {
    const file =
      'date,bleeding,pain_0_10,energy_1_5,no_symptoms_logged,symptoms,note\r\n2024-01-02,light,0,2,false,cramps:2,"hello, world"\r\n';
    expect(parseCycleTransfer(file)).toMatchObject({
      dayLogs: [{ pain: 0, observations: undefined, note: 'hello, world' }],
      moods: [],
    });
  });
  it.each(['a,a\n1,2', 'a,b\n"unclosed', 'a,b\n"closed"oops,2', 'a,b\n1'])(
    'rejects malformed CSV',
    (csv) => expect(() => parseCycleCsv(csv)).toThrow()
  );
  it('keeps existing observations by default and previews replacements explicitly', () => {
    const existing = {
      ...input,
      dayLogs: [{ ...log, note: 'existing' }],
      moods: [{ ...input.moods[0], id: 'm' }],
    };
    const keep = planCycleMerge(transfer(), existing, 'keep', false);
    expect(keep.counts).toEqual({ added: 0, updated: 0, skipped: 4, overlaps: 0 });
    const replace = planCycleMerge(transfer(), existing, 'replace', false);
    expect(replace.counts.updated).toBe(4);
    expect(replace.dayLogs.update[0].value.note).toBe('@private');
  });
  it('skips overlap with existing periods and keeps user preferences unless selected', () => {
    const existing = {
      config: { fallbackCycleLength: 35, fallbackPeriodDuration: 6 },
      periods: [{ ...period, id: 'other', startDate: date(3), endDate: date(7) }],
      dayLogs: [],
      contexts: [],
      moods: [],
    };
    expect(planCycleMerge(transfer(), existing, 'keep', false)).toMatchObject({
      counts: { overlaps: 1 },
      config: { fallbackCycleLength: 35 },
    });
    expect(planCycleMerge(transfer(), existing, 'keep', true).config.fallbackCycleLength).toBe(30);
  });
});

it('preserves future journal entries that existing versions allowed, without inventing period starts', () => {
  const raw = JSON.parse(serializeCycleTransfer(input));
  const result = parseCycleTransfer(
    JSON.stringify({
      ...raw,
      dayLogs: [{ ...raw.dayLogs[0], date: '2999-01-01' }],
      moods: [{ date: '2999-01-01', value: 2 }],
    })
  );
  expect(result.dayLogs[0].date).toBe(new Date(2999, 0, 1).getTime());
  expect(result.periods).toHaveLength(1);
});
