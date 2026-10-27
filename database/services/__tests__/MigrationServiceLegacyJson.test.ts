import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { MigrationService } from '@/database/services/MigrationService';
import { decryptDatabaseValue } from '@/utils/encryption';
import {
  legacyCreateTableSql,
  legacyInsertSql,
  type LegacyV1Dump,
  planLegacyV1Tables,
} from '@/utils/legacyV1Backup';

const mockCreated: { table: string; record: Record<string, unknown> }[] = [];

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));
jest.mock('@/database/models', () => ({}));
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
