import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { MigrationService } from '@/database/services/MigrationService';
import { loadWorkoutEnergyProfile } from '@/database/services/workoutEnergyProfile';
import { WorkoutService } from '@/database/services/WorkoutService';
import { decryptDatabaseValue } from '@/utils/encryption';
import {
  legacyCreateTableSql,
  legacyInsertSql,
  type LegacyV1Dump,
  planLegacyV1Tables,
} from '@/utils/legacyV1Backup';

const mockCreated: { table: string; record: Record<string, unknown> }[] = [];
const mockUpdated: Record<string, Record<string, unknown>> = {};

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
jest.mock('@/database/models', () => ({}));
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { estimateWorkoutKcal: jest.fn() },
}));
jest.mock('@/database/services/workoutEnergyProfile', () => ({
  loadWorkoutEnergyProfile: jest.fn(),
}));
jest.mock('@/database/commitPrepared', () => ({
  commitPrepared: async (_db: unknown, _existing: unknown[], prepare: () => unknown[]) => {
    prepare();
  },
}));
jest.mock('@/database/queryByIds', () => ({
  ...jest.requireActual('@/database/queryByIds'),
  fetchByIds: async (_table: string, _column: string, ids: string[]) =>
    ids.map((id) => ({
      id,
      prepareUpdate: (apply: (record: Record<string, unknown>) => void) => {
        mockUpdated[id] = { table: 'workout_logs' };
        apply(mockUpdated[id]);
      },
    })),
}));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/utils/app', () => ({ isProduction: () => true }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/encryption', () => ({ decryptDatabaseValue: jest.fn(async () => '') }));
jest.mock('@/database/encryptionHelpers', () => ({
  encryptNutritionLogSnapshot: jest.fn(async (snapshot: unknown) => snapshot),
  encryptUserMetricFields: jest.fn(async (fields: { value: number; unit: string }) => ({
    unit: fields.unit,
    value: String(fields.value),
  })),
}));
jest.mock('@/database/database-instance', () => ({
  database: {
    get: (table: string) => ({
      find: async (id: string) => ({
        update: async (apply: (record: Record<string, unknown>) => void) => {
          mockUpdated[id] = { table };
          apply(mockUpdated[id]);
        },
      }),
      create: async (build: (record: Record<string, unknown>) => void) => {
        const record: Record<string, unknown> = { id: `new-${mockCreated.length}` };
        build(record);
        mockCreated.push({ record, table });
        return record;
      },
    }),
    write: async <T>(work: () => Promise<T>) => work(),
  },
}));

/**
 * The real SQL the 1.x import runs, executed by Node's SQLite behind the slice of the
 * expo-sqlite API `MigrationService` uses.
 */
function loadLegacyDump(dump: LegacyV1Dump): SQLiteDatabase {
  const sqlite = new DatabaseSync(':memory:');
  for (const plan of planLegacyV1Tables(dump)) {
    sqlite.exec(legacyCreateTableSql(plan));
    const insert = sqlite.prepare(legacyInsertSql(plan));
    for (const row of plan.rows) {
      insert.run(...row);
    }
  }

  return {
    getAllAsync: async (sql: string, params: (string | number | null)[] = []) =>
      sqlite.prepare(sql).all(...params),
  } as unknown as SQLiteDatabase;
}

// A 1.x native export: `UserMetrics` values were decrypted and parseFloat'ed before
// writing, so they are plain numbers (an unset one became NaN, i.e. null).
const DUMP: LegacyV1Dump = {
  UserMetrics: [
    {
      createdAt: '2024-03-01T08:00:00.000Z',
      dataId: 'a',
      date: '2024-03-01T08:00:00.000Z',
      deletedAt: null,
      fatPercentage: null,
      height: 1.8,
      id: 1,
      weight: 80.5,
    },
    {
      createdAt: '2024-02-01T08:00:00.000Z',
      date: '2024-02-01T08:00:00.000Z',
      deletedAt: '2024-02-02T08:00:00.000Z',
      id: 2,
      weight: 99,
    },
  ],
  Versioning: [{ id: 1, version: '1.8.5' }],
  Workout: [{ deletedAt: null, id: 7, title: 'Push' }],
  WorkoutEvent: [{ deletedAt: null, id: 9, workoutId: 7 }],
  Set: [
    { deletedAt: null, exerciseId: 1, id: 1, setOrder: 0, workoutId: 7 },
    { deletedAt: '', exerciseId: 1, id: 2, setOrder: 1, workoutId: 7 },
  ],
};

describe('MigrationService over a 1.x JSON backup', () => {
  beforeEach(() => {
    mockCreated.length = 0;
    jest.clearAllMocks();
  });

  // The import creates every table, so the summary's count and JOIN queries run even
  // when the backup lacks a table (no FitnessGoals, Food, Exercise... here).
  it('runs every summary query against the rebuilt tables', async () => {
    const service = new MigrationService({
      database: loadLegacyDump(DUMP),
      valuesEncrypted: false,
    });

    expect(await service.checkOldDatabaseExists()).toBe(true);

    const summary = await service.getMigrationSummary();
    expect(summary.userMetricsCount).toBe(1);
    expect(summary.usersCount).toBe(0);
    expect(summary.workoutsCount).toBe(1);
    expect(summary.templateSetsCount).toBe(2);
  });

  // AES over a plaintext "80.5" yields garbage, so a backup must never reach decryption.
  it('reads plaintext values without decrypting them', async () => {
    const service = new MigrationService({
      database: loadLegacyDump(DUMP),
      valuesEncrypted: false,
    });

    const migrated = await (
      service as unknown as { migrateUserMetrics: () => Promise<number> }
    ).migrateUserMetrics();

    expect(decryptDatabaseValue).not.toHaveBeenCalled();
    expect(migrated).toBe(2);
    expect(mockCreated.map(({ record }) => [record.type, record.valueRaw])).toEqual([
      ['weight', '80.5'],
      ['height', '180'],
    ]);
  });

  it('still decrypts the 1.x database an upgrade leaves on the device', async () => {
    jest.mocked(decryptDatabaseValue).mockResolvedValue('70');
    const service = new MigrationService({
      database: loadLegacyDump({ UserMetrics: [{ id: 1, weight: 'U2FsdGVkX1...' }] }),
      valuesEncrypted: true,
    });

    await (
      service as unknown as { migrateUserMetrics: () => Promise<number> }
    ).migrateUserMetrics();

    expect(decryptDatabaseValue).toHaveBeenCalledWith('U2FsdGVkX1...');
    expect(mockCreated.map(({ record }) => record.valueRaw)).toEqual(['70']);
  });
});

type SessionSteps = {
  migrateWorkoutLogs: () => Promise<number>;
  migrateWorkoutLogSets: (total: number) => Promise<number>;
  migrateChatMessages: () => Promise<number>;
  exerciseIdMap: Map<number, string>;
  workoutIdToTemplateId: Map<number, string>;
};

const session = (sets: object[]) => JSON.stringify([{ exerciseId: 4, sets }]);

// A 1.x session keeps what was performed in `WorkoutEvent.exerciseData`; `Set.workoutId`
// points at the `Workout` template, which only coincides with an event id by accident.
const SESSIONS_DUMP: LegacyV1Dump = {
  Workout: [{ deletedAt: null, id: 1, title: 'Chest Day' }],
  Set: [{ deletedAt: null, exerciseId: 4, id: 1, reps: 5, setOrder: 1, weight: 20, workoutId: 1 }],
  WorkoutEvent: [
    {
      date: '2024-07-27T19:00:00.000Z',
      deletedAt: '',
      duration: 60,
      exerciseData: session([
        { reps: 8, restTime: 90, setOrder: 1, unitSystem: 'metric', weight: 100 },
        { reps: 6, restTime: 90, setOrder: 2, unitSystem: 'imperial', weight: 220 },
      ]),
      id: 1,
      status: 'completed',
      title: 'Chest Day',
      workoutId: 1,
    },
    { date: '2024-08-01T19:00:00.000Z', exerciseData: '[]', id: 2, status: 'scheduled' },
    { date: '2024-08-02T19:00:00.000Z', exerciseData: '[]', id: 3, status: 'upcoming' },
  ],
  Chat: [
    {
      createdAt: '2024-07-24T22:34:36.247Z',
      deletedAt: '',
      id: 1,
      message: 'Hi',
      sender: 'assistant',
      type: 'text',
    },
    {
      createdAt: '2024-07-25T22:34:36.247Z',
      deletedAt: '',
      id: 2,
      message: 'Hey',
      sender: 'user',
      type: 'text',
    },
    {
      createdAt: '2024-07-26T22:34:36.247Z',
      deletedAt: '',
      id: 3,
      message: '',
      misc: '{}',
      sender: 'assistant',
      type: 'recentWorkout',
    },
  ],
};

describe('MigrationService 1.x workout history', () => {
  beforeEach(() => {
    mockCreated.length = 0;
  });

  const run = async () => {
    const service = new MigrationService({
      database: loadLegacyDump(SESSIONS_DUMP),
      valuesEncrypted: false,
    });
    const steps = service as unknown as SessionSteps;
    steps.exerciseIdMap.set(4, 'ex-4');
    const logs = await steps.migrateWorkoutLogs();
    const sets = await steps.migrateWorkoutLogSets(0);

    return { logs, service, sets };
  };

  it('imports performed sessions only, not scheduled or upcoming placeholders', async () => {
    const { logs } = await run();

    expect(logs).toBe(1);
    expect(mockCreated.filter(({ table }) => table === 'workout_logs')).toHaveLength(1);
  });

  it('links each log to the template its 1.x workout became, not the old numeric id', async () => {
    const service = new MigrationService({
      database: loadLegacyDump(SESSIONS_DUMP),
      valuesEncrypted: false,
    });
    const steps = service as unknown as SessionSteps;
    steps.workoutIdToTemplateId.set(1, 'tpl-new-id');
    await steps.migrateWorkoutLogs();

    const log = mockCreated.find(({ table }) => table === 'workout_logs')!.record;
    expect(log.templateId).toBe('tpl-new-id');
  });

  describe('calories burned', () => {
    const profile = { weightKg: 80, heightCm: 180, gender: 'male' as const };

    beforeEach(() => {
      for (const id of Object.keys(mockUpdated)) {
        delete mockUpdated[id];
      }
    });

    function serviceWithLogs() {
      const service = new MigrationService({
        database: loadLegacyDump(SESSIONS_DUMP),
        valuesEncrypted: false,
      });
      const internals = service as unknown as {
        estimateMigratedWorkoutCalories: () => Promise<number>;
        workoutEventIdToLogId: Map<number, string>;
      };
      internals.workoutEventIdToLogId.set(1, 'log-a').set(2, 'log-b');
      return internals;
    }

    it('estimates each migrated workout from one shared profile, leaving unestimable ones at 0', async () => {
      (loadWorkoutEnergyProfile as jest.Mock).mockReset().mockResolvedValue(profile);
      const estimate = WorkoutService.estimateWorkoutKcal as jest.Mock;
      estimate.mockReset().mockResolvedValueOnce(310).mockResolvedValueOnce(0);

      expect(await serviceWithLogs().estimateMigratedWorkoutCalories()).toBe(1);

      expect(loadWorkoutEnergyProfile).toHaveBeenCalledTimes(1);
      expect(estimate).toHaveBeenCalledWith('log-a', profile);
      expect(estimate).toHaveBeenCalledWith('log-b', profile);
      expect(mockUpdated['log-a']?.caloriesBurned).toBe(310);
      expect(mockUpdated['log-b']).toBeUndefined();
    });

    it('estimates nothing when there is no body to estimate for', async () => {
      (loadWorkoutEnergyProfile as jest.Mock).mockReset().mockResolvedValue(null);
      const estimate = WorkoutService.estimateWorkoutKcal as jest.Mock;
      estimate.mockReset();

      expect(await serviceWithLogs().estimateMigratedWorkoutCalories()).toBe(0);
      expect(estimate).not.toHaveBeenCalled();
    });

    it('skips a workout whose estimate fails without losing the others', async () => {
      (loadWorkoutEnergyProfile as jest.Mock).mockReset().mockResolvedValue(profile);
      const estimate = WorkoutService.estimateWorkoutKcal as jest.Mock;
      estimate.mockReset().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(120);
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(await serviceWithLogs().estimateMigratedWorkoutCalories()).toBe(1);
      expect(mockUpdated['log-b']?.caloriesBurned).toBe(120);
      expect(mockUpdated['log-a']).toBeUndefined();
    });
  });

  it('builds the sets from exerciseData, not from the template Set table', async () => {
    const { sets } = await run();

    expect(sets).toBe(2);
    const created = mockCreated.filter(({ table }) => table === 'workout_log_sets');
    expect(created.map(({ record }) => record.reps)).toEqual([8, 6]);
    expect(created.map(({ record }) => record.setOrder)).toEqual([1, 2]);
    // imperial sets were stored in pounds, the database is always kilograms
    expect(created[0].record.weight).toBe(100);
    expect(created[1].record.weight as number).toBeCloseTo(99.79, 1);
    expect(created.every(({ record }) => record.rirRecorded === false)).toBe(true);
  });

  it('derives completion time and volume from the session', async () => {
    await run();

    const log = mockCreated.find(({ table }) => table === 'workout_logs')!.record;
    expect((log.completedAt as number) - (log.startedAt as number)).toBe(60 * 60_000);
    expect(log.totalVolume as number).toBeCloseTo(100 * 8 + 99.79 * 6, 0);
  });

  it('brings over the text chat messages and skips workout cards', async () => {
    const service = new MigrationService({
      database: loadLegacyDump(SESSIONS_DUMP),
      valuesEncrypted: false,
    });

    expect(await (service as unknown as SessionSteps).migrateChatMessages()).toBe(2);
    expect(
      mockCreated
        .filter(({ table }) => table === 'chat_messages')
        .map(({ record }) => record.sender)
    ).toEqual(['coach', 'user']);
  });

  it('reports the real log and set counts in the summary', async () => {
    const service = new MigrationService({
      database: loadLegacyDump(SESSIONS_DUMP),
      valuesEncrypted: false,
    });
    const summary = await service.getMigrationSummary();

    expect(summary.workoutLogsCount).toBe(1);
    expect(summary.logSetsCount).toBe(2);
  });
});
