import { database } from '@/database/database-instance';
import { dumpDatabase } from '@/database/exportDb.web';
import { restoreDatabase } from '@/database/importDb';
import type NutritionHealthOwnership from '@/database/models/NutritionHealthOwnership';
import type Setting from '@/database/models/Setting';
import { NutritionHealthRepository } from '@/database/repositories/NutritionHealthRepository';
import { classifyHealthRecord, loadOwnershipContext } from '@/services/nutritionHealthOwnership';

jest.mock('@/database/adapter', () => {
  const Loki = jest.requireActual('@nozbe/watermelondb/adapters/lokijs').default;
  return {
    __esModule: true,
    default: new Loki({
      schema: jest.requireActual('@/database/schema').schema,
      migrations: jest.requireActual('@/database/migrations').migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
      _testLokiAdapter: new (require('lokijs').LokiMemoryAdapter)(),
    }),
  };
});

jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
}));
jest.mock('@/database/dbReady', () => ({ waitForBootMigrations: jest.fn(async () => {}) }));
jest.mock('@/database/dbDurability', () => ({
  updateNutritionLogCountBaseline: jest.fn(async () => {}),
}));
jest.mock('@/database/services/AppExerciseCatalogueService', () => ({
  AppExerciseCatalogueService: { sync: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/MuscleService', () => ({
  MuscleService: {
    seedMuscles: jest.fn(async () => ({})),
    backfillExerciseMuscles: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getThemePreference: async () => 'kinetic-depth' },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn(async () => null) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({ isMusclogGatewayAvailable: () => true }));
jest.mock('@/widgets/resetWidgets', () => ({ resetWidgets: jest.fn(async () => {}) }));

async function legacySetting(ownedLogIds: string[], ignoredRecordIds: string[]) {
  return database.write(() =>
    database.get<Setting>('settings').create((row) => {
      Object.assign(row, {
        type: 'health_nutrition_takeovers',
        value: JSON.stringify({ ownedLogIds, ignoredRecordIds }),
        createdAt: 1,
        updatedAt: 1,
      });
    })
  );
}

const ownershipRows = () =>
  database.get<NutritionHealthOwnership>('nutrition_health_ownership').query().fetch();

beforeEach(async () => {
  jest.restoreAllMocks();
  await database.write(() => database.unsafeResetDatabase());
});

afterAll(() => {
  const adapter = database.adapter.underlyingAdapter as unknown as {
    _dispatcher: { _worker: { _bridge: { driver: { loki: { close: () => void } } } } };
  };
  adapter._dispatcher._worker._bridge.driver.loki.close();
});

describe('NutritionHealthRepository', () => {
  it('preserves purged owners and ignored originals through a full backup and restore', async () => {
    await NutritionHealthRepository.recordTakeover('purged-log', 'foreign-original');
    const before = (await ownershipRows()).map((row) => ({
      id: row.id,
      kind: row.kind,
      recordId: row.recordId,
      createdAt: row.createdAt,
    }));
    const dump = await dumpDatabase();

    await restoreDatabase(dump);

    expect(
      (await ownershipRows()).map((row) => ({
        id: row.id,
        kind: row.kind,
        recordId: row.recordId,
        createdAt: row.createdAt,
      }))
    ).toEqual(before);
    const ownership = await loadOwnershipContext(['purged-log'], ['own-copy', 'foreign-original']);
    expect(ownership.ownLogs.size).toBe(0);
    expect(ownership.ownedLogIds).toEqual(new Set(['purged-log']));
    expect(ownership.ignoredRecordIds).toEqual(new Set(['foreign-original']));
    expect(classifyHealthRecord('own-copy', 'purged-log', ownership)).toBe('orphan');
    expect(classifyHealthRecord('foreign-original', undefined, ownership)).toBe('tombstoned');
  });

  it('migrates more than 1000 facts of each kind without forgetting the oldest', async () => {
    const logs = Array.from({ length: 1005 }, (_, index) => `log-${index}`);
    const external = Array.from({ length: 1005 }, (_, index) => `hc-${index}`);
    const setting = await legacySetting(logs, external);

    const state = await NutritionHealthRepository.loadState(logs, external);

    expect(state.ownedLogIds).toEqual(new Set(logs));
    expect(state.ignoredRecordIds).toEqual(new Set(external));
    expect(setting.value).toBe('{}');
    expect(await ownershipRows()).toHaveLength(2010);

    await NutritionHealthRepository.loadState(logs, external);
    expect(await ownershipRows()).toHaveLength(2010);
  });

  it('commits legacy migration and its marker atomically, and can retry a failed commit', async () => {
    const setting = await legacySetting(['log'], ['hc']);
    const before = setting.value;
    jest.spyOn(database, 'batch').mockRejectedValueOnce(new Error('adapter failed'));

    await expect(NutritionHealthRepository.loadState(['log'], ['hc'])).rejects.toThrow(
      'adapter failed'
    );

    expect(setting.value).toBe(before);
    expect(await ownershipRows()).toEqual([]);

    const recovered = await NutritionHealthRepository.loadState(['log'], ['hc']);
    expect(recovered.ownedLogIds.has('log')).toBe(true);
    expect(recovered.ignoredRecordIds.has('hc')).toBe(true);
    expect(setting.value).toBe('{}');
  });

  it('records both takeover facts in one commit and repeated or concurrent writes stay idempotent', async () => {
    await Promise.all([
      NutritionHealthRepository.recordTakeover('log', 'hc'),
      NutritionHealthRepository.recordTakeover('log', 'hc'),
      NutritionHealthRepository.recordOwned('log'),
    ]);

    expect(await ownershipRows()).toHaveLength(2);
    expect((await NutritionHealthRepository.loadState(['log'], [])).ownedLogIds.has('log')).toBe(
      true
    );
    const state = await NutritionHealthRepository.loadState(['other'], ['other']);
    expect(state.ownedLogIds.size).toBe(0);
    expect(state.ignoredRecordIds.size).toBe(0);
  });
});
