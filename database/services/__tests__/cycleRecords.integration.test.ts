/* eslint-disable simple-import-sort/imports -- Install the shared database mocks before importing services. */
import { cycleTestDay as day } from '@/database/services/__tests__/cycleTestSetup';

import { CycleHealthImportService } from '@/database/services/CycleHealthImportService';
import { CycleTransferService } from '@/database/services/CycleTransferService';
import { serializeCycleTransfer } from '@/utils/cycle/cycleTransfer';
import { blankDayLog, patchDayLog, toggleSymptom } from '@/utils/cycle/dayLog';
import { Q } from '@nozbe/watermelondb';

import { encryptNumber } from '@/database/encryptionHelpers';
import { database } from '@/database/database-instance';
import { dumpDatabase } from '@/database/exportDb.web';
import { decryptCyclePayloadsInDump } from '@/database/exportDbCore';
import { restoreDatabase } from '@/database/importDb';
import type CycleContext from '@/database/models/CycleContext';
import type CycleDayLog from '@/database/models/CycleDayLog';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import PeriodLog from '@/database/models/PeriodLog';
import UserMetric from '@/database/models/UserMetric';
import UserMetricsNote from '@/database/models/UserMetricsNote';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readDayLogs,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { CycleContextService } from '@/database/services/CycleContextService';
import { CycleDataEncryptionMigration } from '@/database/services/CycleDataEncryptionMigration';
import { CycleDayLogService } from '@/database/services/CycleDayLogService';
import { CycleRecordPurge } from '@/database/services/CycleRecordPurge';
import { CyclePeriodService } from '@/database/services/CyclePeriodService';
import { CycleTrackingService } from '@/database/services/CycleTrackingService';
import { SettingsService } from '@/database/services/SettingsService';
import { localDayStartMs, MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { PeriodRuleViolation } from '@/utils/cycle/periodRules';

const D = MS_PER_SOLAR_DAY;

async function newCycle(periods: { startDate: number; endDate?: number | null }[] = []) {
  return CycleTrackingService.create({
    config: { fallbackCycleLength: 30, fallbackPeriodDuration: 5 },
    periods,
    context: null,
  });
}

const livePeriods = async (cycleId: string) =>
  readPeriods(await CycleRepository.periods(cycleId).fetch());

describe('encrypted storage', () => {
  it('keeps dates, notes and config out of the plaintext columns', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    await CyclePeriodService.update((await livePeriods(cycleId))[0].id, { note: 'secret note' });
    const [raw] = await database.get<CyclePeriod>('cycle_periods').query().fetch();
    expect(raw.payload).not.toContain('secret note');
    expect(raw.payload).not.toContain('startDate');
    expect(raw.payload.length).toBeGreaterThan(20);

    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(cycleId);
    expect(cycle.config).not.toContain('30');
    expect(await readCycleConfig(cycle)).toEqual({
      fallbackCycleLength: 30,
      fallbackPeriodDuration: 5,
    });
    expect(cycle.lastPeriodStartDate).toBe(0);
  });
});

describe('CyclePeriodService', () => {
  it('starts a period and closes the previous open one without inventing its end', async () => {
    const cycleId = await newCycle();
    await CyclePeriodService.start(cycleId, day(1));
    await CyclePeriodService.start(cycleId, day(30));
    const periods = (await livePeriods(cycleId)).sort((a, b) => a.startDate - b.startDate);
    expect(periods[0]).toMatchObject({ endDate: null, endKind: 'unknown' });
    expect(periods[1]).toMatchObject({ endDate: null, endKind: 'open' });
  });

  it('returns the existing period for a repeated start instead of duplicating it', async () => {
    const cycleId = await newCycle();
    const first = await CyclePeriodService.start(cycleId, day(1));
    const again = await CyclePeriodService.start(cycleId, day(1));
    expect(again.id).toBe(first.id);
    expect(await livePeriods(cycleId)).toHaveLength(1);
  });

  it('ends the open period and records the end as logged', async () => {
    const cycleId = await newCycle();
    await CyclePeriodService.start(cycleId, day(1));
    await CyclePeriodService.end(cycleId, day(5));
    expect((await livePeriods(cycleId))[0]).toMatchObject({ endDate: day(5), endKind: 'logged' });
  });

  it('refuses overlaps, future starts and an end before the start', async () => {
    const cycleId = await newCycle([{ startDate: day(10), endDate: day(14) }]);
    await expect(
      CyclePeriodService.create(cycleId, { startDate: day(12), endDate: day(16) })
    ).rejects.toMatchObject({ code: 'period_log_overlaps_existing' });
    await expect(
      CyclePeriodService.create(cycleId, { startDate: Date.now() + 5 * D })
    ).rejects.toBeInstanceOf(PeriodRuleViolation);
    await expect(
      CyclePeriodService.create(cycleId, {
        startDate: day(40),
        endDate: day(38),
        endKind: 'logged',
      })
    ).rejects.toMatchObject({ code: 'period_end_before_start' });
  });

  it('lets a new period start after one whose end is unknown', async () => {
    const cycleId = await newCycle();
    await CyclePeriodService.create(cycleId, {
      startDate: day(1),
      endDate: null,
      endKind: 'unknown',
    });
    await expect(
      CyclePeriodService.create(cycleId, { startDate: day(30), endDate: day(34) })
    ).resolves.toBeDefined();
  });

  it('edits a period, and deleting then undoing restores it', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const [period] = await livePeriods(cycleId);
    const updated = await CyclePeriodService.update(period.id, {
      endDate: day(6),
      endKind: 'logged',
    });
    expect(updated.endDate).toBe(day(6));

    await CyclePeriodService.remove(period.id);
    expect(await livePeriods(cycleId)).toHaveLength(0);
    await CyclePeriodService.restore(period.id);
    expect(await livePeriods(cycleId)).toHaveLength(1);
  });

  it('refuses to restore a period that now overlaps one logged in its place', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const [period] = await livePeriods(cycleId);
    await CyclePeriodService.remove(period.id);
    await CyclePeriodService.create(cycleId, { startDate: day(3), endDate: day(7) });
    await expect(CyclePeriodService.restore(period.id)).rejects.toMatchObject({
      code: 'period_log_overlaps_existing',
    });
  });

  it('excluding a cycle is stored on the period', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const [period] = await livePeriods(cycleId);
    await CyclePeriodService.setExcluded(period.id, true);
    expect((await livePeriods(cycleId))[0].excludedFromStats).toBe(true);
  });
});

describe('CycleDayLogService', () => {
  const base = {
    bleeding: null,
    symptoms: [],
    noSymptoms: false,
    pain: null,
    energy: null,
    note: '',
  };
  const liveLogs = async () => readDayLogs(await CycleRepository.dayLogs().fetch());

  it('keeps one record per day and updates it in place', async () => {
    await CycleDayLogService.save({ ...base, date: day(2), bleeding: 'light' });
    await CycleDayLogService.save({ ...base, date: day(2), bleeding: 'heavy', pain: 7 });
    const logs = await liveLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ bleeding: 'heavy', pain: 7 });
  });

  it('removes the record when the form is emptied instead of leaving the old one', async () => {
    await CycleDayLogService.save({
      ...base,
      date: day(2),
      symptoms: [{ key: 'cramps', severity: 2 }],
    });
    await CycleDayLogService.save({ ...base, date: day(2) });
    expect(await liveLogs()).toHaveLength(0);
  });

  it('keeps "no symptoms today" as a real record, distinct from an unlogged day', async () => {
    await CycleDayLogService.save({ ...base, date: day(2), noSymptoms: true });
    expect((await liveLogs())[0].noSymptoms).toBe(true);
  });

  it('normalizes the day so a time of day cannot create a second record', async () => {
    await CycleDayLogService.save({ ...base, date: day(2), pain: 1 });
    await CycleDayLogService.save({ ...base, date: day(2) + 5 * 3600_000, pain: 2 });
    expect(await liveLogs()).toHaveLength(1);
  });
});

describe('CycleContextService and CycleTrackingService', () => {
  it('appends contexts, replacing one for the same day', async () => {
    const cycleId = await newCycle();
    await CycleContextService.set(cycleId, {
      effectiveFrom: day(1),
      lifeStage: 'regular',
      contraception: 'ring',
    });
    await CycleContextService.set(cycleId, {
      effectiveFrom: day(1),
      lifeStage: 'pcos',
      contraception: 'none',
    });
    await CycleContextService.set(cycleId, {
      effectiveFrom: day(40),
      lifeStage: 'regular',
      contraception: 'copper_iud',
    });
    const contexts = await readContexts(await CycleRepository.contexts(cycleId).fetch());
    expect(contexts).toHaveLength(2);
    expect(contexts.find((c) => c.effectiveFrom === day(1))?.lifeStage).toBe('pcos');
  });

  it('starting again deactivates, not deletes, the previous cycle', async () => {
    const first = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const second = await newCycle();
    const cycles = await CycleRepository.cycles().fetch();
    expect(cycles.find((c) => c.id === first)?.isActive).toBe(false);
    expect(cycles.find((c) => c.id === second)?.isActive).toBe(true);
    expect(await livePeriods(first)).toHaveLength(1);
  });

  it('rejects overlapping initial periods atomically', async () => {
    await expect(
      newCycle([
        { startDate: day(1), endDate: day(8) },
        { startDate: day(5), endDate: day(9) },
      ])
    ).rejects.toBeInstanceOf(PeriodRuleViolation);
    expect(await database.get('menstrual_cycles').query().fetchCount()).toBe(0);
  });

  it('pauses and resumes without touching records', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    await CycleTrackingService.setActive(cycle, false);
    expect((await database.get<MenstrualCycle>('menstrual_cycles').find(id)).isActive).toBe(false);
    expect(await livePeriods(id)).toHaveLength(1);
  });

  it('deleteAll permanently destroys every cycle record, legacy ones included', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    await CycleDayLogService.save({
      date: day(2),
      bleeding: 'light',
      symptoms: [],
      noSymptoms: false,
      pain: null,
      energy: null,
      note: '',
    });
    await CycleContextService.set(id, {
      effectiveFrom: day(1),
      lifeStage: 'pcos',
      contraception: 'none',
    });
    await CycleTrackingService.deleteAll();
    for (const table of [
      'menstrual_cycles',
      'cycle_periods',
      'cycle_day_logs',
      'cycle_contexts',
      'period_logs',
    ]) {
      expect(await database.get(table).query().fetchCount()).toBe(0);
    }

    expect(SettingsService.resetCycleSettings).toHaveBeenCalled();
  });
});

async function seedLegacy() {
  const metricNote = async (metric: UserMetric, text: string) =>
    database.get<UserMetricsNote>('user_metrics_notes').prepareCreate((n) => {
      n.userMetricId = metric.id;
      n.note = text;
      n.createdAt = Date.now();
      n.updatedAt = Date.now();
    });

  const flowValue = await encryptNumber(3);
  const symptomValue = await encryptNumber(2);

  return database.write(async () => {
    const cycle = database.get<MenstrualCycle>('menstrual_cycles').prepareCreate((c) => {
      c.avgCycleLength = 30;
      c.avgPeriodDuration = 5;
      c.useHormonalBirthControl = true;
      c.birthControlType = 'iud';
      c.lastPeriodStartDate = day(30);
      c.timezone = '+00:00';
      c.syncGoal = 'performance';
      c.lifeStage = 'pcos';
      c.isActive = true;
      c.createdAt = day(0);
      c.updatedAt = day(0);
    });
    const periods = [
      { s: day(1), e: day(5) }, // equals the invented average: estimated
      { s: day(30), e: day(32) }, // differs: logged
    ].map(({ s, e }) =>
      database.get<PeriodLog>('period_logs').prepareCreate((p) => {
        p.menstrualCycleId = cycle.id;
        p.startDate = s;
        p.endDate = e;
        p.notes = 'legacy note';
        p.timezone = '+00:00';
        p.createdAt = Date.now();
        p.updatedAt = Date.now();
      })
    );
    const flow = database.get<UserMetric>('user_metrics').prepareCreate((m) => {
      m.type = 'period_flow';
      m.valueRaw = flowValue;
      m.date = day(2);
      m.timezone = '+00:00';
      m.createdAt = Date.now();
      m.updatedAt = Date.now();
    });
    const symptoms = database.get<UserMetric>('user_metrics').prepareCreate((m) => {
      m.type = 'period_symptoms';
      m.valueRaw = symptomValue;
      m.date = day(2);
      m.timezone = '+00:00';
      m.createdAt = Date.now();
      m.updatedAt = Date.now();
    });
    await database.batch(
      cycle,
      ...periods,
      flow,
      symptoms,
      await metricNote(symptoms, 'cramps, headache')
    );

    return cycle.id;
  });
}

describe('CycleDataEncryptionMigration', () => {
  it('converts plaintext cycle data into encrypted records and destroys the originals', async () => {
    const cycleId = await seedLegacy();
    const result = await CycleDataEncryptionMigration.run();
    expect(result).toEqual({ migratedCycles: 1, migratedDays: 1 });

    const periods = (await livePeriods(cycleId)).sort((a, b) => a.startDate - b.startDate);
    expect(periods.map((p) => p.endKind)).toEqual(['estimated', 'logged']);
    expect(periods[0].note).toBe('legacy note');

    const [log] = await readDayLogs(await CycleRepository.dayLogs().fetch());
    expect(log).toMatchObject({ date: day(2), bleeding: 'medium' });
    expect(log.symptoms).toEqual([
      { key: 'cramps', severity: null },
      { key: 'headache', severity: null },
    ]);

    const [context] = await readContexts(await CycleRepository.contexts(cycleId).fetch());
    expect(context).toMatchObject({ lifeStage: 'pcos', contraception: 'iud_unspecified' });

    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(cycleId);
    expect(await readCycleConfig(cycle)).toEqual({
      fallbackCycleLength: 30,
      fallbackPeriodDuration: 5,
    });
    expect(cycle).toMatchObject({
      birthControlType: null,
      lifeStage: null,
      lastPeriodStartDate: 0,
      useHormonalBirthControl: false,
    });

    // The plaintext originals must be gone, not merely hidden.
    expect(await database.get('period_logs').query().fetchCount()).toBe(0);
    expect(
      await database
        .get('user_metrics')
        .query(Q.where('type', Q.oneOf(['period_flow', 'period_symptoms'])))
        .fetchCount()
    ).toBe(0);
    expect(await database.get('user_metrics_notes').query().fetchCount()).toBe(0);
    expect(SettingsService.setCycleShowFertility).toHaveBeenCalledWith(true);
  });

  it('is idempotent: a second run finds nothing to do', async () => {
    await seedLegacy();
    await CycleDataEncryptionMigration.run();
    expect(await CycleDataEncryptionMigration.run()).toEqual({
      migratedCycles: 0,
      migratedDays: 0,
    });
    expect(await database.get('cycle_periods').query().fetchCount()).toBe(2);
  });

  it('touches nothing when the recovery backup cannot be made', async () => {
    const { createPreCycleEncryptionBackup } = jest.requireMock('@/database/preMigrationBackup');
    createPreCycleEncryptionBackup.mockRejectedValueOnce(new Error('disk full'));
    await seedLegacy();
    await expect(CycleDataEncryptionMigration.run()).rejects.toThrow('disk full');
    expect(await database.get('period_logs').query().fetchCount()).toBe(2);
    expect(await database.get('cycle_periods').query().fetchCount()).toBe(0);
  });

  it('does nothing for a database with no legacy cycle data', async () => {
    expect(await CycleDataEncryptionMigration.run()).toEqual({
      migratedCycles: 0,
      migratedDays: 0,
    });
  });
});

describe('backup round trip', () => {
  it('exports readable payloads and restores them re-encrypted', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    await CycleDayLogService.save({
      date: day(2),
      bleeding: 'heavy',
      symptoms: [{ key: 'cramps', severity: 3 }],
      noSymptoms: false,
      pain: 8,
      energy: null,
      note: 'ouch',
    });
    await CycleContextService.set(id, {
      effectiveFrom: day(1),
      lifeStage: 'perimenopause',
      contraception: 'copper_iud',
    });

    const dump = await dumpDatabase();
    const parsed = JSON.parse(dump);
    expect(parsed.cycle_day_logs[0]._decrypted).toBe(true);
    expect(JSON.parse(parsed.cycle_day_logs[0].payload)).toMatchObject({ pain: 8, note: 'ouch' });
    expect(JSON.parse(parsed.menstrual_cycles[0].config)).toEqual({
      fallbackCycleLength: 30,
      fallbackPeriodDuration: 5,
    });

    await restoreDatabase(dump);

    const [rawLog] = await database.get<CycleDayLog>('cycle_day_logs').query().fetch();
    expect(rawLog.payload).not.toContain('ouch');
    const [log] = await readDayLogs([rawLog]);
    expect(log).toMatchObject({ bleeding: 'heavy', pain: 8, note: 'ouch' });
    expect((await livePeriods(id))[0]).toMatchObject({ endDate: day(5), endKind: 'logged' });
    const [context] = await readContexts(
      await database.get<CycleContext>('cycle_contexts').query().fetch()
    );
    expect(context.contraception).toBe('copper_iud');
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    expect((await readCycleConfig(cycle)).fallbackCycleLength).toBe(30);
  });

  it('translates a pre-v36 backup into encrypted records and drops the plaintext ones', async () => {
    const legacy = {
      _exportVersion: 35,
      _exportPlatform: 'web',
      menstrual_cycles: [
        {
          id: 'cyc1',
          avg_cycle_length: 31,
          avg_period_duration: 5,
          use_hormonal_birth_control: true,
          birth_control_type: 'pill',
          last_period_start_date: day(40),
          timezone: '+00:00',
          sync_goal: 'energy',
          life_stage: null,
          is_active: true,
          created_at: day(0),
          updated_at: day(0),
          deleted_at: null,
        },
      ],
      period_logs: [
        {
          id: 'p1',
          menstrual_cycle_id: 'cyc1',
          start_date: day(1),
          end_date: day(4),
          notes: null,
          timezone: '+00:00',
          created_at: day(1),
          updated_at: day(1),
          deleted_at: null,
        },
        {
          id: 'p2',
          menstrual_cycle_id: 'cyc1',
          start_date: day(40),
          end_date: null,
          notes: null,
          timezone: '+00:00',
          created_at: day(40),
          updated_at: day(40),
          deleted_at: null,
        },
      ],
      user_metrics: [
        {
          id: 'm1',
          type: 'period_symptoms',
          value: 1,
          unit: 'count',
          date: day(2),
          timezone: '+00:00',
          created_at: day(2),
          updated_at: day(2),
          deleted_at: null,
          _decrypted: true,
        },
      ],
      user_metrics_notes: [
        {
          id: 'n1',
          user_metric_id: 'm1',
          note: 'acne',
          created_at: day(2),
          updated_at: day(2),
          deleted_at: null,
        },
      ],
    };
    await restoreDatabase(JSON.stringify(legacy));

    expect(await database.get('period_logs').query().fetchCount()).toBe(0);
    expect(await database.get('user_metrics').query().fetchCount()).toBe(0);
    const periods = (await livePeriods('cyc1')).sort((a, b) => a.startDate - b.startDate);
    // The second period was left open more than two weeks before the restore: a forgotten end.
    expect(periods.map((p) => p.endKind)).toEqual(['logged', 'unknown']);
    const [log] = await readDayLogs(await CycleRepository.dayLogs().fetch());
    expect(log.symptoms).toEqual([{ key: 'acne', severity: null }]);
    const [context] = await readContexts(await CycleRepository.contexts('cyc1').fetch());
    expect(context.contraception).toBe('pill_unspecified');
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find('cyc1');
    expect(await readCycleConfig(cycle)).toEqual({
      fallbackCycleLength: 31,
      fallbackPeriodDuration: 5,
    });
    expect(cycle.birthControlType).toBeNull();
  });
});

// The new journal fields remain in the same encrypted payload and survive old-format defaults.
describe('cycle journal and shared mood', () => {
  const blank = (date: number) => ({
    date,
    bleeding: null,
    symptoms: [],
    noSymptoms: false,
    pain: null,
    energy: null,
    note: '',
  });
  it('commits mood and custom observations together, preserves them on a quick edit, and clears both', async () => {
    await newCycle();
    const observations = {
      sleepHours: 0,
      sex: false,
      custom: { field: 0 },
      customLabels: { field: 'Personal field' },
    };
    await CycleDayLogService.save({ ...blank(day(1)), observations }, 0);
    let logs = await readDayLogs(await CycleRepository.dayLogs().fetch());
    expect(logs[0].observations).toEqual(observations);
    const mood = await database
      .get<UserMetric>('user_metrics')
      .query(Q.where('type', 'mood'))
      .fetch();
    expect(await mood[0].getDecrypted()).toMatchObject({ value: 0 });
    await CycleDayLogService.save({ ...logs[0], bleeding: 'spotting' });
    logs = await readDayLogs(await CycleRepository.dayLogs().fetch());
    expect(logs[0].observations).toEqual(observations);
    expect(await mood[0].getDecrypted()).toMatchObject({ value: 0 });
    await CycleDayLogService.save(blank(day(1)), null);
    expect(await CycleRepository.dayLogs().fetch()).toHaveLength(0);
    expect(
      await database
        .get<UserMetric>('user_metrics')
        .query(Q.where('type', 'mood'), Q.where('deleted_at', Q.eq(null)))
        .fetch()
    ).toHaveLength(0);
  });
  it('rejects invalid observations before committing a mood or day', async () => {
    await expect(
      CycleDayLogService.save({ ...blank(day(1)), observations: { sleepHours: 25 } }, 3)
    ).rejects.toThrow();
    expect(await database.get('cycle_day_logs').query().fetch()).toHaveLength(0);
    expect(await database.get('user_metrics').query().fetch()).toHaveLength(0);
  });
  it('keeps shared moods when cycle records are permanently deleted', async () => {
    await newCycle();
    await CycleDayLogService.save({ ...blank(day(1)), pain: 5 }, 3);
    await CycleTrackingService.deleteAll();
    expect(
      await database.get<UserMetric>('user_metrics').query(Q.where('type', 'mood')).fetch()
    ).toHaveLength(1);
    expect(await database.get('cycle_day_logs').query().fetch()).toHaveLength(0);
  });
});

describe('cycle-only merge', () => {
  it('previews, merges and deduplicates without resetting other data, with encrypted fields and mood', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    const config = {
      fallbackCycleLength: 30,
      fallbackPeriodDuration: 5,
      goals: ['mood' as const],
      customFields: [{ id: 'field', label: 'Recovery', kind: 'number' as const }],
    };
    const periods = [{ ...(await livePeriods(id))[0], note: 'imported note' }];
    const dayLogs = [
      {
        ...blankDayLog(day(2)),
        id: 'export-id',
        timezone: '+01:00',
        observations: { custom: { field: 3 }, customLabels: { field: 'Recovery' } },
      },
    ];
    const file = serializeCycleTransfer({
      config,
      periods,
      dayLogs,
      contexts: [],
      moods: [{ date: day(2), value: 0 }],
    });
    const unrelated = await database.write(() =>
      database.get<UserMetric>('user_metrics').create((m) => {
        m.type = 'weight';
        m.valueRaw = '80';
        m.date = day(2);
        m.timezone = '+00:00';
        m.createdAt = Date.now();
        m.updatedAt = Date.now();
      })
    );
    expect(await CycleTransferService.preview(cycle, file, 'keep', false)).toMatchObject({
      added: 2,
      skipped: 1,
      updated: 0,
    });
    await CycleTransferService.import(cycle, file, 'keep', false);
    expect(await CycleTransferService.preview(cycle, file, 'keep', false)).toMatchObject({
      added: 0,
      skipped: 3,
    });
    expect((await livePeriods(id))[0].note).toBe('');
    await CycleTransferService.import(cycle, file, 'replace', true);
    expect((await livePeriods(id))[0].note).toBe('imported note');
    expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0].observations).toEqual(
      dayLogs[0].observations
    );
    expect(await readCycleConfig(cycle)).toMatchObject(config);
    expect(
      (await database.get<CycleDayLog>('cycle_day_logs').query().fetch())[0].payload
    ).not.toContain('Recovery');
    expect(await database.get<UserMetric>('user_metrics').find(unrelated.id)).toBe(unrelated);
  });
  it('leaves existing records intact when any part of a file is invalid', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    const before = await livePeriods(id);
    const file = JSON.stringify({
      format: 'musclog-cycle',
      version: 1,
      periods: [],
      dayLogs: [],
      contexts: [],
      moods: [{ date: 'bad date', value: 3 }],
    });
    await expect(CycleTransferService.import(cycle, file, 'replace', true)).rejects.toThrow();
    expect(await livePeriods(id)).toEqual(before);
    expect(await database.get('user_metrics').query().fetch()).toHaveLength(0);
  });
  it('backs up and restores optional preferences and observations through full-app exports', async () => {
    const id = await newCycle();
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    await CycleTrackingService.updateConfig(cycle, {
      fallbackCycleLength: 35,
      fallbackPeriodDuration: 6,
      goals: ['record'],
      customSymptoms: ['My symptom'],
      enabledFields: ['medication'],
    });
    await CycleDayLogService.save(
      { ...blankDayLog(day(1)), observations: { medication: 'Recorded dose' } },
      2
    );
    const exported = await dumpDatabase();
    await restoreDatabase(exported);
    const restored = await database.get<MenstrualCycle>('menstrual_cycles').find(id);
    expect(await readCycleConfig(restored)).toMatchObject({
      goals: ['record'],
      customSymptoms: ['My symptom'],
      enabledFields: ['medication'],
    });
    expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0].observations).toEqual({
      medication: 'Recorded dose',
    });
  });
});

it('shows the latest decrypted day after edits with the same millisecond timestamp', async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    await CycleDayLogService.save({ ...blankDayLog(day(1)), note: 'first edit' });
    expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0].note).toBe('first edit');
    await CycleDayLogService.save({ ...blankDayLog(day(1)), note: 'second edit' });
    expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0].note).toBe(
      'second edit'
    );
  } finally {
    clock.mockRestore();
  }
});

it('clears shared mood on its recorded calendar day even when its timezone differs', async () => {
  const date = day(2);
  const local = new Date(date);
  const instant = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - 14 * 3600_000;
  const cipher = await encryptNumber(3);
  const mood = await database.write(() =>
    database.get<UserMetric>('user_metrics').create((m) => {
      m.type = 'mood';
      m.date = instant;
      m.timezone = '+14:00';
      m.valueRaw = cipher;
      m.createdAt = Date.now();
      m.updatedAt = Date.now();
    })
  );
  await CycleDayLogService.save(blankDayLog(date), null);
  expect(mood.deletedAt).toBeGreaterThan(0);
});

it('merges rapid quick actions without losing another symptom or optional observations', async () => {
  await CycleDayLogService.save({
    ...blankDayLog(day(1)),
    observations: { medication: 'Recorded dose' },
  });
  await Promise.all(
    ['cramps', 'headache'].map((key) =>
      CycleDayLogService.patch(day(1), (current) =>
        patchDayLog(current, day(1), {
          symptoms: toggleSymptom(current?.symptoms ?? [], key),
          noSymptoms: false,
        })
      )
    )
  );
  const [log] = await readDayLogs(await CycleRepository.dayLogs().fetch());
  expect(log.symptoms.map((s) => s.key).sort()).toEqual(['cramps', 'headache']);
  expect(log.observations).toEqual({ medication: 'Recorded dose' });
});

describe('complete cycle recovery and imported provenance', () => {
  it('restores a cycle onto a fresh installation in one commit without placeholder setup', async () => {
    const incoming = serializeCycleTransfer({
      config: {
        fallbackCycleLength: 31,
        fallbackPeriodDuration: 5,
        cycleLengthKnown: false,
        backupReminderDays: 30,
      },
      periods: [
        {
          id: 'old',
          cycleId: 'old',
          timezone: '+00:00',
          startDate: day(1),
          endDate: day(5),
          endKind: 'logged',
          excludedFromStats: false,
          confirmedLongCycle: true,
          note: '',
        },
      ],
      contexts: [],
      moods: [],
      dayLogs: [],
    });
    const preview = await CycleTransferService.preview(null, incoming, 'keep', true);
    expect(preview.added).toBe(1);
    await CycleTransferService.import(null, incoming, 'keep', true);
    const cycles = await CycleRepository.cycles().fetch();
    expect(cycles).toHaveLength(1);
    expect(cycles[0].isActive).toBe(true);
    expect(await readCycleConfig(cycles[0])).toMatchObject({
      cycleLengthKnown: false,
      backupReminderDays: 30,
    });
    expect((await livePeriods(cycles[0].id))[0].confirmedLongCycle).toBe(true);
  });
  it('does not create an empty cycle when the recovery file is invalid', async () => {
    await expect(CycleTransferService.import(null, '{"bad":true}', 'keep', true)).rejects.toThrow();
    expect(await CycleRepository.cycles().fetch()).toHaveLength(0);
  });
  it('preserves a confirmed long cycle when editing its note', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const [period] = await livePeriods(cycleId);
    await CyclePeriodService.update(period.id, { confirmedLongCycle: true });
    await CyclePeriodService.update(period.id, { note: 'correct history' });
    expect((await livePeriods(cycleId))[0].confirmedLongCycle).toBe(true);
  });
});

it('imports health provenance atomically without replacing manual fields, including across re-imports', async () => {
  await newCycle();
  await CycleDayLogService.save({
    ...blankDayLog(day(2)),
    pain: 0,
    note: 'manual',
    observations: { temperatureC: 36.2 },
  });
  await CycleHealthImportService.import([
    { date: day(2), id: 'h', source: 'healthkit', kind: 'temperatureC', value: 36.5 },
  ]);
  await CycleHealthImportService.import([
    { date: day(2), id: 'h', source: 'healthkit', kind: 'temperatureC', value: 36.6 },
  ]);
  const logs = await readDayLogs(await CycleRepository.dayLogs().fetch());
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    pain: 0,
    note: 'manual',
    observations: { temperatureC: 36.2, health: [{ id: 'h', value: 36.6 }] },
  });
  expect(await CycleRepository.allPeriods().fetch()).toHaveLength(0);
});

it('retains newly imported observations when a stale manual day form is saved', async () => {
  await newCycle();
  const stale = { ...blankDayLog(day(2)), pain: 2 };
  await CycleDayLogService.save(stale);
  await CycleHealthImportService.import([
    { date: day(2), id: 'h', source: 'healthkit', kind: 'temperatureC', value: 36.6 },
  ]);
  await CycleDayLogService.save({ ...stale, pain: 4 });
  const [log] = await readDayLogs(await CycleRepository.dayLogs().fetch());
  expect(log.observations?.health?.[0].value).toBe(36.6);
  await CycleDayLogService.save(blankDayLog(day(2)));
  expect(await readDayLogs(await CycleRepository.dayLogs().fetch())).toHaveLength(0);
});

describe('tracking mode settings', () => {
  it('pauses and resumes the same cycle without losing periods, logs, config or contraception', async () => {
    const cycleId = await newCycle([{ startDate: day(1), endDate: day(5) }]);
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(cycleId);
    await CycleContextService.set(cycleId, {
      effectiveFrom: day(0),
      lifeStage: 'pcos',
      contraception: 'combined_pill',
    });
    await CycleDayLogService.save({ ...blankDayLog(day(2)), note: 'Keep this' });
    const before = await livePeriods(cycleId);
    await CycleTrackingService.setTrackingMode(cycle, 'skip');
    expect(cycle.isActive).toBe(false);
    await CycleTrackingService.setTrackingMode(cycle, 'symptoms');
    expect(cycle.isActive).toBe(true);
    const contexts = await readContexts(await CycleRepository.contexts(cycleId).fetch());
    expect(contexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lifeStage: 'no_bleeding', contraception: 'combined_pill' }),
      ])
    );
    await CycleTrackingService.setTrackingMode(cycle, 'bleeding');
    expect(
      (await readContexts(await CycleRepository.contexts(cycleId).fetch())).filter(
        (c) => c.effectiveFrom === localDayStartMs(new Date())
      )
    ).toEqual([expect.objectContaining({ lifeStage: 'regular', contraception: 'combined_pill' })]);
    expect(await livePeriods(cycleId)).toEqual(before);
    expect(await readDayLogs(await CycleRepository.dayLogs().fetch())).toEqual(
      expect.arrayContaining([expect.objectContaining({ note: 'Keep this' })])
    );
    expect((await readCycleConfig(cycle)).fallbackCycleLength).toBe(30);
    expect(await CycleRepository.cycles().fetch()).toHaveLength(1);
  });

  it('keeps an existing bleeding life stage when enabling bleeding tracking', async () => {
    const cycleId = await newCycle();
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(cycleId);
    await CycleContextService.set(cycleId, {
      effectiveFrom: day(0),
      lifeStage: 'pcos',
      contraception: 'none',
    });
    await CycleTrackingService.setTrackingMode(cycle, 'skip');
    await CycleTrackingService.setTrackingMode(cycle, 'bleeding');
    expect(cycle.isActive).toBe(true);
    expect(await readContexts(await CycleRepository.contexts(cycleId).fetch())).toEqual([
      expect.objectContaining({ lifeStage: 'pcos' }),
    ]);
  });

  it('restores cached activation state if changing modes fails to commit', async () => {
    const cycleId = await newCycle();
    const cycle = await database.get<MenstrualCycle>('menstrual_cycles').find(cycleId);
    await CycleTrackingService.setTrackingMode(cycle, 'skip');
    const batch = jest.spyOn(database, 'batch').mockRejectedValueOnce(new Error('write failed'));
    await expect(CycleTrackingService.setTrackingMode(cycle, 'symptoms')).rejects.toThrow(
      'write failed'
    );
    batch.mockRestore();
    expect(cycle.isActive).toBe(false);
    expect(await CycleRepository.contexts(cycleId).fetch()).toHaveLength(0);
    await CycleTrackingService.setTrackingMode(cycle, 'symptoms');
    expect(cycle.isActive).toBe(true);
  });
});

describe('deleted cycle text does not linger', () => {
  const allRows = (table: string) => database.get(table).query().fetch();

  it('destroys a cleared day instead of leaving a decryptable tombstone', async () => {
    await newCycle();
    await CycleDayLogService.save({ ...blankDayLog(day(3)), note: 'private' });
    expect(await allRows('cycle_day_logs')).toHaveLength(1);
    await CycleDayLogService.clear(day(3));
    expect(await allRows('cycle_day_logs')).toHaveLength(0);
  });

  it('destroys a removed context outright', async () => {
    const id = await newCycle();
    await CycleContextService.set(id, {
      effectiveFrom: day(1),
      lifeStage: 'pregnancy_loss',
      contraception: 'none',
      note: 'private',
    });
    const [context] = await readContexts(await CycleRepository.contexts(id).fetch());
    await CycleContextService.remove(context.id);
    expect(await allRows('cycle_contexts')).toHaveLength(0);
  });

  it('keeps a removed period for undo, leaves it out of exports, and purges it at boot', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(4) }]);
    const [period] = await livePeriods(id);
    await CyclePeriodService.remove(period.id);
    // Undo still works within the session.
    await CyclePeriodService.restore(period.id);
    expect(await livePeriods(id)).toHaveLength(1);

    await CyclePeriodService.remove(period.id);
    const exported = JSON.parse(await dumpDatabase());
    expect(exported.cycle_periods).toHaveLength(0);

    expect(await CycleRecordPurge.purgeDeleted()).toBe(1);
    expect(await allRows('cycle_periods')).toHaveLength(0);
    expect(await CycleRecordPurge.purgeDeleted()).toBe(0);
  });

  it('keeps cycle payloads encrypted in an on-device recovery point, readable once downloaded', async () => {
    await newCycle([{ startDate: day(1), endDate: day(4) }]);
    await CycleDayLogService.save({ ...blankDayLog(day(2)), note: 'only mine' });

    const recoveryPoint = await dumpDatabase(undefined, { keepCycleCiphertext: true });
    expect(recoveryPoint).not.toContain('only mine');
    const atRest = JSON.parse(recoveryPoint);
    expect(atRest.cycle_day_logs[0]._decrypted).toBeUndefined();

    const portable = JSON.parse(await decryptCyclePayloadsInDump(recoveryPoint));
    expect(portable.cycle_day_logs[0]._decrypted).toBe(true);
    expect(JSON.parse(portable.cycle_day_logs[0].payload)).toMatchObject({ note: 'only mine' });

    // Restoring the at-rest copy on the same device brings the records back.
    await restoreDatabase(recoveryPoint);
    const [log] = await readDayLogs(await CycleRepository.dayLogs().fetch());
    expect(log.note).toBe('only mine');
  });

  it('reports a period that no longer exists as not found, not as an end-before-start error', async () => {
    const id = await newCycle([{ startDate: day(1), endDate: day(4) }]);
    const [period] = await livePeriods(id);
    await CyclePeriodService.remove(period.id);
    await expect(CyclePeriodService.update(period.id, { note: 'x' })).rejects.toMatchObject({
      code: 'period_not_found',
    });
  });
});

describe('the pre-conversion safety backup', () => {
  it('is deleted once every converted record reads back, and only that backup', async () => {
    const { deleteBackup } = jest.requireMock('@/database/preMigrationBackup');
    await seedLegacy();
    await CycleDataEncryptionMigration.run();
    expect(deleteBackup).toHaveBeenCalledTimes(1);
    expect(deleteBackup).toHaveBeenCalledWith('backup-uri');
  });

  it('is kept when nothing was converted', async () => {
    const { deleteBackup } = jest.requireMock('@/database/preMigrationBackup');
    await CycleDataEncryptionMigration.run();
    expect(deleteBackup).not.toHaveBeenCalled();
  });
});
