/**
 * Module mocks shared by every weekly-progression integration suite. Import it FIRST: the
 * mocks must be registered before anything they replace is loaded.
 */
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
jest.mock('@/database/services/GymService', () => ({
  GymService: { getActiveGym: async () => null },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getWorkoutAutonomy: async () => 'manual',
    getProgressionMode: async () => 'weight_first',
    getReviewWeekday: async () => 1,
    getThemePreference: async () => 'kinetic-depth',
    getIntuitiveEatingMode: async () => false,
    getEnableFastedDay: jest.fn(async () => false),
  },
}));
jest.mock('@/database/services/ExerciseUserSettingsService', () => ({
  ExerciseUserSettingsService: {
    getWeightUnitsResolver: async () => () => 'metric',
    getResolvers: async () => ({ unitsFor: () => 'metric', repCeilingFor: () => 25 }),
  },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: {
    getUserBodyWeightKgForVolume: async () => 70,
    getLatest: async () => null,
    getMetricsHistory: async () => [],
  },
}));
jest.mock('@/utils/dynamicNutritionTarget', () => ({
  resolveWeeklyRecommendation: jest.fn(async () => null),
  resolveDailyMacros: jest.fn(async () => ({
    totalCalories: 2400,
    protein: 150,
    carbs: 250,
    fats: 80,
    fiber: 30,
    tdee: 2600,
    usedEmpiricalData: true,
  })),
}));

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
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn(async () => null) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({ isMusclogGatewayAvailable: () => true }));

export {};
