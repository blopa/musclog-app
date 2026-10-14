import { careTopics, CYCLE_EDUCATION } from '../careGuidance';
import { contextGuidance } from '../contraception';
import { buildCycleHistory } from '../cycleHistory';
import { planCycleReminders, DEFAULT_CYCLE_REMINDERS } from '../cycleReminders';
import { computePredictionStats } from '../cycleStats';
import { computeCycleTimeline } from '../cycleTimeline';
import { parseCycleTransfer, serializeCycleTransfer } from '../cycleTransfer';
import { blankDayLog } from '../dayLog';
import { convertExternalCsv, detectImportColumns } from '../externalImport';
import { groupHealthObservations, mergeHealthObservations } from '../healthObservations';
import {
  evaluatePredictions,
  searchCycleLogs,
  summarizeWindow,
  trendPoints,
} from '../historyAnalysis';
import { observationDraft, resolveObservationDraft } from '../observationDraft';
import { cycleConfigSchema, healthObservationSchema } from '../preferences';
import { selectedCycleSharing } from '../selectedSharing';
import type { CycleConfig, CycleDayLogDto, CyclePeriodDto } from '../types';

const day = (n: number) => new Date(2024, 0, 1 + n).getTime();
const config: CycleConfig = { fallbackCycleLength: 28, fallbackPeriodDuration: 5 };
const periods = (starts: number[]): CyclePeriodDto[] =>
  starts.map((n) => ({
    id: String(n),
    cycleId: 'c',
    timezone: '+00:00',
    startDate: day(n),
    endDate: day(n + 4),
    endKind: 'logged',
    excludedFromStats: false,
    note: '',
  }));
const log = (n: number, patch: Partial<CycleDayLogDto> = {}): CycleDayLogDto => ({
  ...blankDayLog(day(n)),
  id: String(n),
  timezone: '+00:00',
  ...patch,
});

describe('cycle corrections and uncertainty', () => {
  it('includes a confirmed genuine long cycle but never bypasses context or user exclusions', () => {
    const records = periods([0, 28, 56, 112, 140]);
    records[2].confirmedLongCycle = true;
    expect(buildCycleHistory(records)[2].status).toBe('used');
    expect(buildCycleHistory(records, () => 'hormonal_context')[2].reason).toBe('hormonal_context');
    records[2].excludedFromStats = true;
    expect(buildCycleHistory(records)[2].reason).toBe('user_excluded');
  });
  it('does not predict an unknown fallback, but keeps counting and learns from later starts', () => {
    const records = periods([0]);
    const stats = computePredictionStats(buildCycleHistory(records), { cycleLengthKnown: false });
    expect(computeCycleTimeline(records, stats, { today: day(10) })).toMatchObject({
      elapsedDay: 11,
      prediction: { state: 'insufficient' },
    });
    const learned = periods([0, 32]);
    expect(
      computeCycleTimeline(
        learned,
        computePredictionStats(buildCycleHistory(learned), { cycleLengthKnown: false }),
        { today: day(35) }
      ).prediction.state
    ).toBe('upcoming');
  });
  it('widens a sparse range and evaluates each historical prediction without future starts', () => {
    const records = periods([0]);
    const prediction = computeCycleTimeline(
      records,
      computePredictionStats(buildCycleHistory(records)),
      { today: day(1) }
    ).prediction;
    expect(prediction).toMatchObject({ earliest: day(21), latest: day(35) });
    const regular = periods([0, 28, 56, 84, 112]);
    expect(evaluatePredictions(regular, buildCycleHistory(regular), config)).toMatchObject({
      checked: 2,
      hits: 2,
      meanErrorDays: 0,
    });
  });
  it.each(['pregnancy', 'pregnancy_loss', 'menopause', 'hysterectomy'] as const)(
    'suppresses estimates in %s while retaining unexpected bleeding',
    (lifeStage) => {
      const guidance = contextGuidance({ lifeStage, contraception: 'none' });
      expect(guidance.suppressedReason).not.toBeNull();
      expect(guidance.fertilityMeaningful).toBe(false);
      expect(guidance.hidePeriodActions).toBe(true);
      expect(guidance.excludesCycles).toBe('life_context');
    }
  );
});
describe('journal and record ownership', () => {
  const health = {
    id: 'temperature',
    source: 'healthkit' as const,
    kind: 'temperatureC' as const,
    value: 36.4,
  };
  it('keeps imported data separate, updates by source ID, and rejects impossible values', () => {
    expect(mergeHealthObservations([health], [{ ...health, value: 36.6 }])).toEqual([
      { ...health, value: 36.6 },
    ]);
    expect(healthObservationSchema.safeParse({ ...health, value: '36.4' }).success).toBe(false);
    expect(
      groupHealthObservations([{ ...health, date: day(1) + 3600000 }], day(4)).get(day(1))
    ).toEqual([health]);
    expect(() => groupHealthObservations([{ ...health, date: day(10) }], day(4))).toThrow();
    const original = { sex: false, health: [health] };
    expect(resolveObservationDraft(observationDraft(original), config, original)).toEqual(original);
  });
  it('enforces custom rating bounds, including zero, and rejects reversed bounds', () => {
    const bounded: CycleConfig = {
      ...config,
      customFields: [{ id: 'a', label: 'Function', kind: 'rating', min: 0, max: 3 }],
    };
    expect(resolveObservationDraft({ 'custom:a': '0' }, bounded).custom?.a).toBe(0);
    expect(() => resolveObservationDraft({ 'custom:a': '4' }, bounded)).toThrow();
    expect(() => resolveObservationDraft({ 'custom:a': '1.5' }, bounded)).toThrow();
    expect(
      cycleConfigSchema.safeParse({
        ...bounded,
        customFields: [{ ...bounded.customFields![0], min: 4 }],
      }).success
    ).toBe(false);
  });
  it('supports trends and search without any period dates, preserving missing and zero values', () => {
    const logs = [
      log(1, { pain: 0 }),
      log(2, {
        note: 'Migraine after travel',
        observations: { medication: 'Aspirin', sex: false },
        symptoms: [{ key: 'migraine', severity: 3 }],
      }),
      log(3, { pain: 7, observations: { impact: 2 }, bleeding: 'heavy' }),
    ];
    expect(trendPoints(logs, [], 'pain')).toEqual([
      { date: day(1), value: 0 },
      { date: day(3), value: 7 },
    ]);
    expect(searchCycleLogs(logs, 'migraine aspirin').map((d) => d.date)).toEqual([day(2)]);
    expect(searchCycleLogs(logs, 'migraine missing')).toEqual([]);
    expect(summarizeWindow(logs, day(2), day(3))).toMatchObject({
      loggedDays: 2,
      heavyDays: 1,
      impactDays: 1,
      painDays: 1,
    });
  });
  it('shares only explicitly selected fields and omits sex, notes, medication and imported observations', () => {
    const logs = [
      log(1, {
        pain: 0,
        note: 'private',
        observations: { medication: 'private', sex: true, health: [health] },
      }),
      log(3, { pain: 9 }),
    ];
    const shared = JSON.parse(
      selectedCycleSharing(logs, [{ date: day(2), value: 0 }], ['pain', 'mood'], day(0), day(2))
    );
    expect(shared.days).toEqual([
      { date: '2024-01-02', pain: 0 },
      { date: '2024-01-03', mood: 0 },
    ]);
    expect(JSON.stringify(shared)).not.toContain('private');
    expect(() => selectedCycleSharing(logs, [], [], day(0), day(2))).toThrow();
  });
  it('round-trips new preferences, confirmed cycles, contexts and observations', () => {
    const records = periods([0]);
    records[0].confirmedLongCycle = true;
    const file = serializeCycleTransfer({
      config: {
        ...config,
        cycleLengthKnown: false,
        reminders: DEFAULT_CYCLE_REMINDERS,
        backupReminderDays: 30,
      },
      periods: records,
      dayLogs: [
        log(1, {
          observations: {
            impact: 0,
            lhTest: 'positive',
            pregnancyTest: 'negative',
            health: [health],
          },
        }),
      ],
      contexts: [
        {
          id: 'cx',
          cycleId: 'c',
          effectiveFrom: day(0),
          timezone: '+00:00',
          lifeStage: 'pregnancy_loss',
          contraception: 'none',
          note: '',
        },
      ],
      moods: [],
    });
    const imported = parseCycleTransfer(file);
    expect(imported.config?.cycleLengthKnown).toBe(false);
    expect(imported.periods[0].confirmedLongCycle).toBe(true);
    expect(imported.dayLogs[0].observations?.health).toEqual([health]);
    expect(imported.contexts[0].lifeStage).toBe('pregnancy_loss');
  });
});
describe('external CSV wizard', () => {
  it('maps user-selected columns and day-first dates without inventing end dates', () => {
    const text = 'period start,notes,bbt\n01/02/2024,old history,36.4\n';
    const detected = detectImportColumns(text);
    expect(detected.mapping.periods).toBe(true);
    const result = parseCycleTransfer(
      convertExternalCsv(text, { ...detected.mapping, dateOrder: 'dmy' })
    );
    expect(result.periods[0]).toMatchObject({
      startDate: new Date(2024, 1, 1).getTime(),
      endKind: 'unknown',
      endDate: null,
    });
    expect(result.dayLogs[0].observations?.temperatureC).toBe(36.4);
  });
  it('rejects unknown flow labels and duplicate starts before any database write', () => {
    const bad = 'date,flow\n2024-01-02,flooding\n';
    expect(() => convertExternalCsv(bad, detectImportColumns(bad).mapping)).toThrow();
    const duplicate = 'start_date\n2024-01-02\n2024-01-02\n';
    expect(() => convertExternalCsv(duplicate, detectImportColumns(duplicate).mapping)).toThrow();
  });
});
describe('reminder personalization and education', () => {
  it('schedules daily and recovery reminders even with no predictions, using the selected time', () => {
    const timeline = computeCycleTimeline([], computePredictionStats([]), { today: day(1) });
    const preferences = {
      ...DEFAULT_CYCLE_REMINDERS,
      hour: 18,
      minute: 30,
      daily: true,
      period: false,
    };
    const reminders = planCycleReminders(timeline, day(1), { preferences, backupDays: 30 });
    // One repeating reminder, not 28 one-shots: iOS keeps at most 64 pending notifications for
    // the whole app, so a month of check-ins crowded out workout and weekly-review reminders.
    const daily = reminders.filter((r) => r.kind === 'daily-log');
    expect(daily).toHaveLength(1);
    expect(daily[0].repeatsDaily).toBe(true);
    expect(reminders.some((r) => r.kind === 'backup')).toBe(true);
    expect(reminders.every((r) => r.date.getHours() === 18 && r.date.getMinutes() === 30)).toBe(
      true
    );
  });
  it('keeps fertile reminder opt-in and adds an optional forgotten-end check', () => {
    const records = periods([0]);
    records[0].endDate = null;
    records[0].endKind = 'open';
    const timeline = computeCycleTimeline(
      records,
      computePredictionStats(buildCycleHistory(records)),
      { today: day(3), showFertility: false }
    );
    const reminders = planCycleReminders(timeline, day(3), {
      preferences: { ...DEFAULT_CYCLE_REMINDERS, endCheck: true },
      activePeriod: records[0],
    });
    expect(reminders.map((r) => r.kind)).toEqual(['period-start', 'end-check']);
  });
  it('provides authoritative educational links without diagnosing from observations', () => {
    expect(careTopics(log(1, { pain: 7, bleeding: 'very_heavy' }), 'regular')).toEqual([
      'pms',
      'bleeding',
      'pain',
    ]);
    expect(careTopics(log(1, { bleeding: 'spotting' }), 'menopause')).toContain('unexpected');
    expect(
      Object.values(CYCLE_EDUCATION).every((url) =>
        /^https:\/\/www\.(nhs\.uk|rcog\.org\.uk)\//.test(url)
      )
    ).toBe(true);
  });
});

it('shows a quiet context rather than asking for period history when no periods exist', () => {
  const timeline = computeCycleTimeline([], computePredictionStats([]), {
    today: day(1),
    suppressed: true,
  });
  expect(timeline.prediction.state).toBe('suppressed');
  expect(timeline.elapsedDay).toBeNull();
});

it('plots imported temperatures separately and never overwrites the self-reported series', () => {
  const logs = [
    log(1, {
      observations: {
        temperatureC: 36.2,
        health: [{ source: 'healthkit', id: 't', kind: 'temperatureC', value: 36.6 }],
      },
    }),
  ];
  expect(trendPoints(logs, [], 'temperatureC')).toEqual([{ date: day(1), value: 36.2 }]);
  expect(trendPoints(logs, [], 'importedTemperatureC')).toEqual([
    { date: day(1), value: 36.6, source: 'healthkit' },
  ]);
});
