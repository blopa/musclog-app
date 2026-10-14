/* eslint-disable simple-import-sort/imports -- Install the shared database mocks before importing services. */
import { cycleTestDay as day } from '@/database/services/__tests__/cycleTestSetup';

import { type Model, Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { encryptNumber } from '@/database/encryptionHelpers';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import PeriodLog from '@/database/models/PeriodLog';
import UserMetric from '@/database/models/UserMetric';
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
import { CycleHealthImportService } from '@/database/services/CycleHealthImportService';
import { CyclePeriodService } from '@/database/services/CyclePeriodService';
import { CycleTrackingService } from '@/database/services/CycleTrackingService';
import { CycleTransferService } from '@/database/services/CycleTransferService';
import { SettingsService } from '@/database/services/SettingsService';
import { blankDayLog } from '@/utils/cycle/dayLog';
import { serializeCycleTransfer } from '@/utils/cycle/cycleTransfer';
import { DEFAULT_CYCLE_REMINDERS } from '@/utils/cycle/cycleReminders';

async function newCycle() {
  const id = await CycleTrackingService.create({
    config: { fallbackCycleLength: 30, fallbackPeriodDuration: 5 },
    periods: [],
  });
  return database.get<MenstrualCycle>('menstrual_cycles').find(id);
}

/** Reject at the adapter boundary, after WatermelonDB has prepared cached models. */
async function expectRollback(records: Model[], action: () => Promise<unknown>) {
  const before = records.map((r) => ({ ...r._raw }));
  const batch = jest.spyOn(database.adapter, 'batch').mockRejectedValueOnce(new Error('disk full'));
  try {
    await expect(action()).rejects.toThrow('disk full');
  } finally {
    batch.mockRestore();
  }
  records.forEach((record, i) => {
    expect(record._raw).toEqual(before[i]);
    expect(record._preparedState).toBeNull();
  });
  await action();
}

it('merges concurrent config patches, nested reminder edits and list transformations', async () => {
  const cycle = await newCycle();
  await Promise.all([
    CycleTrackingService.updateConfig(cycle, { goals: ['mood'] }),
    CycleTrackingService.updateConfig(cycle, { backupReminderDays: 30 }),
    CycleTrackingService.updateConfig(cycle, { reminders: { hour: 10 } }),
    CycleTrackingService.updateConfig(cycle, { reminders: { minute: 15 } }),
    CycleTrackingService.updateConfig(cycle, (current) => ({
      customSymptoms: [...(current.customSymptoms ?? []), 'First'],
    })),
    CycleTrackingService.updateConfig(cycle, (current) => ({
      customSymptoms: [...(current.customSymptoms ?? []), 'Second'],
    })),
  ]);
  expect(await readCycleConfig(cycle)).toEqual({
    fallbackCycleLength: 30,
    fallbackPeriodDuration: 5,
    goals: ['mood'],
    backupReminderDays: 30,
    reminders: { ...DEFAULT_CYCLE_REMINDERS, hour: 10, minute: 15 },
    customSymptoms: ['First', 'Second'],
  });
  const before = cycle.config;
  await expect(
    CycleTrackingService.updateConfig(cycle, { reminders: { hour: 24 } })
  ).rejects.toThrow();
  expect(cycle.config).toBe(before);
});

it('rolls back a failed config edit and retries without dropping other preferences', async () => {
  const cycle = await newCycle();
  await CycleTrackingService.updateConfig(cycle, { goals: ['mood'] });
  await expectRollback([cycle], () =>
    CycleTrackingService.updateConfig(cycle, { backupReminderDays: 30 })
  );
  expect(await readCycleConfig(cycle)).toMatchObject({ goals: ['mood'], backupReminderDays: 30 });
});

it.each([false, true])('rolls back activation changes to %s', async (isActive) => {
  const cycle = await newCycle();
  await CycleTrackingService.setActive(cycle, !isActive);
  await expectRollback([cycle], () => CycleTrackingService.setActive(cycle, isActive));
  expect(cycle.isActive).toBe(isActive);
});

it('keeps the previous cycle active if replacement creation fails', async () => {
  const cycle = await newCycle();
  await expectRollback([cycle], () =>
    CycleTrackingService.create({
      config: { fallbackCycleLength: 28, fallbackPeriodDuration: 4 },
      periods: [],
    })
  );
  expect(await CycleRepository.cycles().fetch()).toHaveLength(2);
  expect(cycle.isActive).toBe(false);
});

it('rolls back a day and shared mood together on save and clear', async () => {
  const input = { ...blankDayLog(day(2)), note: 'old' };
  await CycleDayLogService.save(input, 0);
  const records = [
    ...(await CycleRepository.dayLogs().fetch()),
    ...(await database.get<UserMetric>('user_metrics').query(Q.where('type', 'mood')).fetch()),
  ];
  await expectRollback(records, () => CycleDayLogService.save({ ...input, note: 'new' }, 4));
  expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0].note).toBe('new');
  await expectRollback(records, () => CycleDayLogService.save(blankDayLog(day(2)), null));
  expect(await CycleRepository.dayLogs().fetch()).toHaveLength(0);
});

it('rolls back context edits and deletion', async () => {
  const cycle = await newCycle();
  const input = {
    effectiveFrom: day(1),
    lifeStage: 'regular' as const,
    contraception: 'none' as const,
  };
  await CycleContextService.set(cycle.id, input);
  const records = await CycleRepository.contexts(cycle.id).fetch();
  await expectRollback(records, () => CycleContextService.set(cycle.id, { ...input, note: 'new' }));
  expect((await readContexts(await CycleRepository.contexts(cycle.id).fetch()))[0].note).toBe(
    'new'
  );
  await expectRollback(records, () => CycleContextService.remove(records[0].id));
});

it('rolls back closing an open period when starting its replacement fails', async () => {
  const cycle = await newCycle();
  await CyclePeriodService.start(cycle.id, day(1));
  const records = await CycleRepository.periods(cycle.id).fetch();
  await expectRollback(records, () => CyclePeriodService.start(cycle.id, day(30)));
  expect(await readPeriods(await CycleRepository.periods(cycle.id).fetch())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ startDate: day(1), endKind: 'unknown' }),
      expect.objectContaining({ startDate: day(30), endKind: 'open' }),
    ])
  );
});

it('rolls back period ending, editing, removal and undo', async () => {
  const cycle = await newCycle();
  const period = await CyclePeriodService.start(cycle.id, day(1));
  const records = await CycleRepository.periods(cycle.id).fetch();
  await expectRollback(records, () => CyclePeriodService.end(cycle.id, day(5)));
  await expectRollback(records, () => CyclePeriodService.update(period.id, { note: 'new' }));
  await expectRollback(records, () => CyclePeriodService.remove(period.id));
  await expectRollback(records, () => CyclePeriodService.restore(period.id));
  expect((await readPeriods(await CycleRepository.periods(cycle.id).fetch()))[0]).toMatchObject({
    endDate: day(5),
    note: 'new',
  });
});

it('rolls back imported health observations', async () => {
  await CycleDayLogService.save({ ...blankDayLog(day(2)), note: 'self report' });
  const records = await CycleRepository.dayLogs().fetch();
  await expectRollback(records, () =>
    CycleHealthImportService.import([
      { date: day(2), id: 'health-id', source: 'health_connect', kind: 'bleeding', value: 'light' },
    ])
  );
  expect((await readDayLogs(await CycleRepository.dayLogs().fetch()))[0]).toMatchObject({
    note: 'self report',
    observations: { health: [expect.objectContaining({ id: 'health-id' })] },
  });
});

it('rolls back config, period, day and mood changes when a cycle import fails', async () => {
  const cycle = await newCycle();
  await CyclePeriodService.create(cycle.id, { startDate: day(1), endDate: day(5) });
  await CycleDayLogService.save({ ...blankDayLog(day(2)), note: 'old' }, 0);
  const periodRows = await CycleRepository.periods(cycle.id).fetch();
  const dayRows = await CycleRepository.dayLogs().fetch();
  const moodRows = await database
    .get<UserMetric>('user_metrics')
    .query(Q.where('type', 'mood'))
    .fetch();
  const periods = (await readPeriods(periodRows)).map((p) => ({ ...p, note: 'imported' }));
  const dayLogs = (await readDayLogs(dayRows)).map((d) => ({ ...d, note: 'imported' }));
  const text = serializeCycleTransfer({
    config: { ...(await readCycleConfig(cycle)), goals: ['mood'] },
    periods,
    dayLogs,
    contexts: [],
    moods: [{ date: day(2), value: 4 }],
  });
  await expectRollback([cycle, ...periodRows, ...dayRows, ...moodRows], () =>
    CycleTransferService.import(cycle, text, 'replace', true)
  );
  expect(await readCycleConfig(cycle)).toMatchObject({ goals: ['mood'] });
});

it('retries full deletion after an adapter failure without leaving partial records', async () => {
  const cycle = await newCycle();
  await CyclePeriodService.start(cycle.id, day(1));
  await CycleDayLogService.save({ ...blankDayLog(day(2)), note: 'old' });
  const records = [
    cycle,
    ...(await CycleRepository.periods(cycle.id).fetch()),
    ...(await CycleRepository.dayLogs().fetch()),
  ];
  await expectRollback(records, () => CycleTrackingService.deleteAll());
  expect(await CycleRepository.cycles().fetch()).toHaveLength(0);
  expect(await CycleRepository.dayLogs().fetch()).toHaveLength(0);
});

async function seedLargeLegacyHistory() {
  const value = await encryptNumber(3);
  return database.write(async () => {
    const cycle = database.get<MenstrualCycle>('menstrual_cycles').prepareCreate((r) => {
      r.avgCycleLength = 30;
      r.avgPeriodDuration = 5;
      r.lastPeriodStartDate = day(1);
      r.isActive = true;
      r.createdAt = day(0);
      r.updatedAt = day(0);
    });
    const period = database.get<PeriodLog>('period_logs').prepareCreate((r) => {
      r.menstrualCycleId = cycle.id;
      r.startDate = day(1);
      r.endDate = day(5);
      r.notes = 'legacy private note';
      r.timezone = '+00:00';
      r.createdAt = day(0);
      r.updatedAt = day(0);
    });
    const metrics = Array.from({ length: 550 }, (_, i) =>
      database.get<UserMetric>('user_metrics').prepareCreate((r) => {
        r.type = 'period_flow';
        r.valueRaw = value;
        r.date = day(i + 2);
        r.timezone = '+00:00';
        r.createdAt = day(0);
        r.updatedAt = day(0);
      })
    );
    await database.batch(cycle, period, ...metrics);
    return { cycle, originals: [period, ...metrics] };
  });
}

it('commits a large migration in one transaction and retries with no duplicate replacements', async () => {
  const { cycle, originals } = await seedLargeLegacyHistory();
  const batch = jest.spyOn(database.adapter, 'batch').mockRejectedValueOnce(new Error('disk full'));
  try {
    await expect(CycleDataEncryptionMigration.run()).rejects.toThrow('disk full');
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0].length).toBeGreaterThan(500);
  } finally {
    batch.mockRestore();
  }
  expect(cycle.config).toBeNull();
  originals.forEach((r) => expect(r._preparedState).toBeNull());
  expect(await database.get('period_logs').query().fetchCount()).toBe(1);
  expect(await database.get('cycle_day_logs').query().fetchCount()).toBe(0);
  expect(SettingsService.setCycleShowFertility).not.toHaveBeenCalled();
  expect(await CycleDataEncryptionMigration.run()).toEqual({
    migratedCycles: 1,
    migratedDays: 550,
  });
  expect(await database.get('period_logs').query().fetchCount()).toBe(0);
  expect(await database.get('user_metrics').query().fetchCount()).toBe(0);
  expect(await database.get('cycle_periods').query().fetchCount()).toBe(1);
  expect(await database.get('cycle_day_logs').query().fetchCount()).toBe(550);
  expect(await CycleDataEncryptionMigration.run()).toEqual({ migratedCycles: 0, migratedDays: 0 });
});

it('serializes concurrent migration passes against fresh data', async () => {
  await seedLargeLegacyHistory();
  const results = await Promise.all([
    CycleDataEncryptionMigration.run(),
    CycleDataEncryptionMigration.run(),
  ]);
  expect(results.reduce((sum, result) => sum + result.migratedDays, 0)).toBe(550);
  expect(await database.get('cycle_day_logs').query().fetchCount()).toBe(550);
});
