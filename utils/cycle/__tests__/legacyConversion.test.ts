import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import { convertLegacyCycleData } from '../legacyConversion';

const NOW = new Date(2024, 5, 20, 12).getTime();
const day = (n: number) => new Date(2024, 5, n).getTime();
const cycle = {
  id: 'c1',
  avgCycleLength: 30,
  avgPeriodDuration: 5,
  birthControlType: null,
  lifeStage: null,
  createdAt: day(1),
};

const run = (over: Partial<Parameters<typeof convertLegacyCycleData>[0]> = {}) =>
  convertLegacyCycleData({
    cycles: [cycle],
    periods: [],
    metrics: [],
    fallbackTimezone: '+00:00',
    now: NOW,
    ...over,
  });

describe('convertLegacyCycleData', () => {
  it('keeps the configured fallback averages', () => {
    expect(run().cycles.get('c1')!.config).toEqual({
      fallbackCycleLength: 30,
      fallbackPeriodDuration: 5,
    });
  });

  it('flags an end that equals the invented average as estimated, and a different one as logged', () => {
    const periods = [
      { cycleId: 'c1', startDate: day(1), endDate: day(5), notes: null, timezone: null },
      { cycleId: 'c1', startDate: day(8), endDate: day(10), notes: 'heavy', timezone: null },
    ];
    const out = run({ periods }).cycles.get('c1')!.periods;
    expect(out.map((p) => p.endKind)).toEqual(['estimated', 'logged']);
    expect(out[1].note).toBe('heavy');
  });

  it('keeps a recent open period open and a forgotten one unknown', () => {
    const periods = [
      { cycleId: 'c1', startDate: day(1), endDate: null, notes: null, timezone: null },
      { cycleId: 'c1', startDate: day(19), endDate: null, notes: null, timezone: null },
    ];
    const out = run({ periods }).cycles.get('c1')!.periods;
    expect(out.map((p) => p.endKind)).toEqual(['unknown', 'open']);
    expect(MS_PER_SOLAR_DAY).toBeGreaterThan(0);
  });

  it('turns birth control and life stage into a context, and none into no context', () => {
    expect(run().cycles.get('c1')!.context).toBeNull();
    const ctx = run({
      cycles: [{ ...cycle, birthControlType: 'iud', lifeStage: 'pcos' }],
    }).cycles.get('c1')!.context;
    expect(ctx).toMatchObject({ contraception: 'iud_unspecified', lifeStage: 'pcos' });
  });

  it('merges flow and symptom metrics into one log per day, without inventing severity', () => {
    const metrics = [
      { type: 'period_flow' as const, date: day(3), value: 3, note: null, timezone: null },
      {
        type: 'period_symptoms' as const,
        date: day(3),
        value: 2,
        note: 'cramps, headache',
        timezone: null,
      },
      { type: 'period_symptoms' as const, date: day(4), value: 1, note: 'acne', timezone: null },
    ];
    const logs = run({ metrics }).dayLogs;
    expect(logs).toHaveLength(2);
    const first = logs.find((l) => l.date === day(3))!;
    expect(first.bleeding).toBe('medium');
    expect(first.symptoms).toEqual([
      { key: 'cramps', severity: null },
      { key: 'headache', severity: null },
    ]);
    expect(logs.find((l) => l.date === day(4))!.bleeding).toBeNull();
  });

  it('drops a metric that carried nothing', () => {
    const metrics = [
      { type: 'period_symptoms' as const, date: day(3), value: 0, note: '', timezone: null },
    ];
    expect(run({ metrics }).dayLogs).toEqual([]);
  });
});
