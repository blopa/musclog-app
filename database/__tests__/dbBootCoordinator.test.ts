import AsyncStorage from '@react-native-async-storage/async-storage';

import { runDatabaseBootSequence } from '@/database/dbBootCoordinator';
import { FoodService } from '@/database/services/FoodService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';

const noop = () => jest.fn(async () => undefined);

jest.mock('@/database/dbDurability', () => ({ startDbDurabilityMonitoring: jest.fn() }));
jest.mock('@/database/preMigrationBackup', () => ({
  waitForPreMigrationBackup: jest.fn(async () => undefined),
}));
jest.mock('@/utils/onboardingService', () => ({
  isOnboardingCompleted: jest.fn(async () => true),
}));
jest.mock('@/utils/bootErrorReporting', () => ({ captureBootException: jest.fn() }));
jest.mock('@/utils/bootProgress', () => ({
  advanceBootProgressStep: jest.fn(),
  finishBootProgress: jest.fn(),
  startBootProgress: jest.fn(),
}));
jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { fixNegativeFiber: noop() },
}));
jest.mock('@/database/services/FoodService', () => ({ FoodService: { fixNegativeFiber: noop() } }));
jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { fixNegativeFiber: noop() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getAnonymousBugReport: noop(),
    migrateApiKeysToEncrypted: noop(),
    migrateRequireExportEncryptionDefault: noop(),
  },
}));
jest.mock('@/database/services/AppExerciseCatalogueService', () => ({
  AppExerciseCatalogueService: { sync: noop() },
}));
jest.mock('@/database/services/LegacyExerciseCatalogueMigration', () => ({
  LegacyExerciseCatalogueMigration: { run: noop() },
}));
jest.mock('@/database/services/ExerciseService', () => ({
  ExerciseService: { backfillExerciseSources: noop(), backfillSearchText: noop() },
}));
jest.mock('@/database/services/FoodPortionService', () => ({
  FoodPortionService: { backfillPortionSources: noop() },
}));
jest.mock('@/database/services/WorkoutSetStatusMigration', () => ({
  WorkoutSetStatusMigration: { run: noop() },
}));
jest.mock('@/database/services/CycleDataEncryptionMigration', () => ({
  CycleDataEncryptionMigration: { run: noop() },
}));
jest.mock('@/database/services/CycleRecordPurge', () => ({
  CycleRecordPurge: { purgeDeleted: noop() },
}));
jest.mock('@/database/services/LegacyWorkoutTemplateIdRepair', () => ({
  LegacyWorkoutTemplateIdRepair: { run: noop() },
}));
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { backfillNullTotalVolumes: noop() },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { backfillTimezoneOffsets: noop() },
}));
jest.mock('@/database/services/TimezoneMigrationService', () => ({
  TimezoneMigrationService: {
    backfillMissingTimezones: noop(),
    repairNullTimezoneNutritionLogs: noop(),
    backfillConsumedTimeFromCreatedAt: noop(),
  },
}));

const bootTwice = async () => {
  await runDatabaseBootSequence(() => false);
  await runDatabaseBootSequence(() => false);
};

/**
 * Logged fiber is encrypted, so the nutrition-log repair loads and decrypts every log the user has
 * ever recorded — about 1,900 decrypts on a three-year diary — and it used to run on every launch.
 * Every writer clamps fiber now, so only rows from before that fix can be negative.
 */
describe('negative-fiber boot repairs', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('scans nutrition logs once, and keeps the cheap goal and food repairs on every boot', async () => {
    await bootTwice();

    expect(NutritionService.fixNegativeFiber).toHaveBeenCalledTimes(1);
    expect(FoodService.fixNegativeFiber).toHaveBeenCalledTimes(2);
    expect(NutritionGoalService.fixNegativeFiber).toHaveBeenCalledTimes(2);
  });

  it('retries the log scan on the next boot when it failed', async () => {
    (NutritionService.fixNegativeFiber as jest.Mock).mockRejectedValueOnce(new Error('busy'));

    await bootTwice();
    await runDatabaseBootSequence(() => false);

    expect(NutritionService.fixNegativeFiber).toHaveBeenCalledTimes(2);
  });
});
