/* eslint-disable simple-import-sort/imports -- Install the shared database mocks before importing services. */
import { cycleTestDay as day } from '@/database/services/__tests__/cycleTestSetup';
import { livePeriods, newCycle } from '@/database/services/__tests__/cycleRecordHelpers';

import { CycleHealthImportService } from '@/database/services/CycleHealthImportService';
import { CycleTransferService } from '@/database/services/CycleTransferService';
import { serializeCycleTransfer } from '@/utils/cycle/cycleTransfer';
import { blankDayLog, patchDayLog, toggleSymptom } from '@/utils/cycle/dayLog';
import { encryptNumber } from '@/database/encryptionHelpers';
import { database } from '@/database/database-instance';
import { dumpDatabase } from '@/database/exportDb.web';
import { restoreDatabase } from '@/database/importDb';
import type CycleDayLog from '@/database/models/CycleDayLog';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import UserMetric from '@/database/models/UserMetric';
import {
  CycleRepository,
  readCycleConfig,
  readDayLogs,
} from '@/database/repositories/CycleRepository';
import { CycleDayLogService } from '@/database/services/CycleDayLogService';
import { CyclePeriodService } from '@/database/services/CyclePeriodService';
import { CycleTrackingService } from '@/database/services/CycleTrackingService';

import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

const D = MS_PER_SOLAR_DAY;

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
