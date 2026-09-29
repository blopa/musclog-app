import AsyncStorage from '@react-native-async-storage/async-storage';

import { restoreDatabase } from '@/database/importDb';
import { createPreRestoreBackup } from '@/database/preMigrationBackup';

const mockUnsafeResetDatabase = jest.fn(async () => {});
const mockBatch = jest.fn(async () => {});

jest.mock('@/database/database-instance', () => ({
  database: {
    adapter: {},
    batch: (...args: unknown[]) => mockBatch(...args),
    get: () => ({
      prepareCreate: (build: (record: Record<string, unknown>) => void) => {
        const record: Record<string, unknown> = { _raw: {} };
        build(record);
        return record;
      },
      query: () => ({ fetch: async () => [] }),
    }),
    unsafeResetDatabase: () => mockUnsafeResetDatabase(),
    write: async (work: () => Promise<void>) => work(),
  },
}));

jest.mock('@/database/schemaToZod', () => ({
  validateExportDump: (data: unknown) => ({ data, success: true }),
}));
jest.mock('@/database/prepareLocalCreateFromRaw', () => ({
  prepareLocalCreateFromRaw: jest.fn(() => ({})),
}));
jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
}));
jest.mock('@/database/dbDurability', () => ({ updateNutritionLogCountBaseline: jest.fn() }));
jest.mock('@/database/dbReady', () => ({ waitForBootMigrations: jest.fn(async () => {}) }));
jest.mock('@/database/services/AppExerciseCatalogueService', () => ({
  AppExerciseCatalogueService: { sync: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/ExerciseService', () => ({
  ExerciseService: { backfillExerciseSources: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/FoodPortionService', () => ({
  FoodPortionService: { backfillPortionSources: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/MuscleService', () => ({
  MuscleService: {
    backfillExerciseMuscles: jest.fn(async () => {}),
    seedMuscles: jest.fn(async () => ({})),
  },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { setUseMusclogFreeTier: jest.fn(async () => {}) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({
  isMusclogGatewayAvailable: () => true,
}));

const DUMP = JSON.stringify({
  _async_storage_: {
    currentUserSyncId: 'imported-user',
    onboardingCompleted: 'true',
    seeding_complete: 'true',
  },
  _exportPlatform: 'android',
  _exportVersion: 26,
  users: [],
});

async function storedKeys(): Promise<string[]> {
  return [...(await AsyncStorage.getAllKeys())].sort();
}

describe('restoreDatabase AsyncStorage ordering', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove([...keys]);
    }

    await AsyncStorage.multiSet([
      ['currentUserSyncId', 'local-user'],
      ['onboardingCompleted', 'true'],
      ['seeding_complete', 'true'],
      ['staleLocalKey', 'stale'],
    ]);
  });

  // The pre-restore backup is the user's only way back. It embeds a live AsyncStorage
  // snapshot, so taking it after a wipe produced a "recovery point" that restores an
  // un-onboarded, un-seeded app.
  it('takes the pre-restore backup while AsyncStorage still holds the live state', async () => {
    let keysAtBackup: string[] = [];
    jest.mocked(createPreRestoreBackup).mockImplementation(async () => {
      keysAtBackup = await storedKeys();
    });

    await restoreDatabase(DUMP);

    expect(keysAtBackup).toContain('onboardingCompleted');
    expect(keysAtBackup).toContain('seeding_complete');
  });

  // A restore that fails between the database wipe and the AsyncStorage swap used to leave
  // `seeding_complete` missing, so the next boot's seedProductionData() reset the database
  // and dropped the user back into onboarding.
  it('leaves onboarding and seeding metadata intact when the restore fails mid-way', async () => {
    mockBatch.mockRejectedValueOnce(new Error('restore blew up'));

    await expect(restoreDatabase(DUMP)).rejects.toThrow('restore blew up');

    expect(await AsyncStorage.getItem('onboardingCompleted')).toBe('true');
    expect(await AsyncStorage.getItem('seeding_complete')).toBe('true');
  });

  it('swaps the snapshot in and prunes keys the backup does not carry', async () => {
    await restoreDatabase(DUMP);

    expect(await AsyncStorage.getItem('currentUserSyncId')).toBe('imported-user');
    expect(await storedKeys()).toEqual([
      'currentUserSyncId',
      'onboardingCompleted',
      'seeding_complete',
    ]);
  });
});
