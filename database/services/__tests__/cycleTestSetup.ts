import { database } from '@/database/database-instance';
import { localDayStartMs } from '@/utils/calendarDate';

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
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    setCycleShowFertility: jest.fn(async () => {}),
    resetCycleSettings: jest.fn(async () => {}),
    getThemePreference: async () => 'kinetic-depth',
  },
}));
jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
  createPreCycleEncryptionBackup: jest.fn(async () => 'backup-uri'),
  getStoredBackups: jest.fn(async () => [
    {
      uri: 'backup-uri',
      createdAt: '',
      fromVersion: null,
      toVersion: null,
      reason: 'cycle-encryption',
    },
    { uri: 'other-uri', createdAt: '', fromVersion: null, toVersion: null, reason: 'pre-restore' },
  ]),
  deleteBackup: jest.fn(async () => {}),
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
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn(async () => null) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({ isMusclogGatewayAvailable: () => true }));

export const cycleTestDay = (n: number) =>
  localDayStartMs(new Date(new Date().getFullYear() - 1, 0, 1 + n));

afterAll(() => {
  const adapter = database.adapter.underlyingAdapter as unknown as {
    _dispatcher: { _worker: { _bridge: { driver: { loki: { close: () => void } } } } };
  };
  adapter._dispatcher._worker._bridge.driver.loki.close();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await database.write(() => database.unsafeResetDatabase());
});
