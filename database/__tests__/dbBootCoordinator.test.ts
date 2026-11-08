import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';

import { runDatabaseBootSequence } from '@/database/dbBootCoordinator';
import { ExerciseService } from '@/database/services/ExerciseService';
import { FoodService } from '@/database/services/FoodService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { captureBootException } from '@/utils/bootErrorReporting';

const noop = () => jest.fn(async () => undefined);

jest.mock('@/database/dbDurability', () => ({ startDbDurabilityMonitoring: jest.fn() }));
jest.mock('@/database/dbReady', () => ({
  isDbReady: jest.fn(() => false),
  markDbReady: jest.fn(),
  markDbReadyFailed: jest.fn(),
  trackBootMigrations: (chain: Promise<void>) => chain,
  waitForDbReady: jest.fn(async () => undefined),
}));
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
  ExerciseService: {
    backfillExerciseSources: noop(),
    backfillSearchText: noop(),
  },
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
jest.mock('@/database/services/NutritionHealthOwnershipMigration', () => ({
  NutritionHealthOwnershipMigration: { run: noop() },
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

describe('boot migration slow reporting and background suppression', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined;
  let removeListener: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
    await AsyncStorage.clear();
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    removeListener = jest.fn();
    (AppState.addEventListener as jest.Mock).mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: removeListener };
    });
    const { SettingsService } = jest.requireMock('@/database/services/SettingsService') as {
      SettingsService: { getAnonymousBugReport: jest.Mock };
    };
    SettingsService.getAnonymousBugReport.mockImplementation(async () => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the slow search backfill after 30s of foreground time across a long background gap', async () => {
    jest.useFakeTimers();

    let resolveMigration!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    (ExerciseService.backfillSearchText as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveMigration = resolve;
          markStarted();
        })
    );

    const bootPromise = runDatabaseBootSequence(() => false);
    await started;
    await jest.advanceTimersByTimeAsync(10_000);
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    appStateListener?.('background');
    await jest.advanceTimersByTimeAsync(11_011_749);
    expect(captureBootException).not.toHaveBeenCalledWith(
      expect.anything(),
      'AppBoot.bootMigration.slow',
      expect.anything()
    );
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    appStateListener?.('active');
    await jest.advanceTimersByTimeAsync(19_999);
    expect(captureBootException).not.toHaveBeenCalledWith(
      expect.anything(),
      'AppBoot.bootMigration.slow',
      expect.anything()
    );
    await jest.advanceTimersByTimeAsync(1);

    expect(captureBootException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Boot migration is still running' }),
      'AppBoot.bootMigration.slow',
      expect.objectContaining({
        tag: 'ExerciseService.backfillSearchText',
        elapsedMs: expect.any(Number),
        foregroundElapsedMs: expect.any(Number),
      })
    );
    const slowCall = (captureBootException as jest.Mock).mock.calls.find(
      ([, context]) => context === 'AppBoot.bootMigration.slow'
    );
    expect(slowCall?.[2].elapsedMs).toBeGreaterThan(11_011_749);
    expect(slowCall?.[2].foregroundElapsedMs).toBe(30_000);

    resolveMigration();
    await bootPromise;
    expect(removeListener).toHaveBeenCalled();
  });

  it('does not finish the DB-ready probe simply because the app backgrounds', async () => {
    jest.useFakeTimers();

    const { SettingsService } = jest.requireMock('@/database/services/SettingsService') as {
      SettingsService: { getAnonymousBugReport: jest.Mock };
    };
    let resolveProbe!: (value: unknown) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    SettingsService.getAnonymousBugReport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve;
          markStarted();
        })
    );

    const bootPromise = runDatabaseBootSequence(() => false);
    await started;
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    appStateListener?.('background');
    await jest.advanceTimersByTimeAsync(11_011_749);
    expect(require('@/database/dbReady').markDbReady).not.toHaveBeenCalled();
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    appStateListener?.('active');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(require('@/database/dbReady').markDbReady).not.toHaveBeenCalled();

    resolveProbe(undefined);
    await bootPromise;
    expect(require('@/database/dbReady').markDbReady).toHaveBeenCalledTimes(1);
    expect(ExerciseService.backfillSearchText).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalled();
  });

  it('fails the DB-ready probe only after its foreground retry budget is exhausted', async () => {
    jest.useFakeTimers();
    const { SettingsService } = jest.requireMock('@/database/services/SettingsService') as {
      SettingsService: { getAnonymousBugReport: jest.Mock };
    };
    SettingsService.getAnonymousBugReport.mockRejectedValue(new Error('No driver with tag'));

    const bootPromise = runDatabaseBootSequence(() => false);
    await jest.advanceTimersByTimeAsync(30_000);
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    appStateListener?.('background');
    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(require('@/database/dbReady').markDbReadyFailed).not.toHaveBeenCalled();

    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    appStateListener?.('active');
    await jest.advanceTimersByTimeAsync(14_999);
    expect(require('@/database/dbReady').markDbReadyFailed).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    await bootPromise;

    expect(require('@/database/dbReady').markDbReadyFailed).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalled();
  });

  it('fails a DB-ready probe whose read hangs through the foreground watchdog', async () => {
    jest.useFakeTimers();
    const { SettingsService } = jest.requireMock('@/database/services/SettingsService') as {
      SettingsService: { getAnonymousBugReport: jest.Mock };
    };
    let rejectProbe!: (error: Error) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    SettingsService.getAnonymousBugReport.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectProbe = reject;
          markStarted();
        })
    );

    const bootPromise = runDatabaseBootSequence(() => false);
    await started;
    await jest.advanceTimersByTimeAsync(45_000);
    await bootPromise;

    expect(require('@/database/dbReady').markDbReadyFailed).toHaveBeenCalledTimes(1);
    expect(require('@/database/dbReady').markDbReady).not.toHaveBeenCalled();
    expect(ExerciseService.backfillSearchText).not.toHaveBeenCalled();
    expect(captureBootException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('DB-ready probe watchdog elapsed'),
      }),
      'AppBoot.databaseBootSequence'
    );

    const captureCallsBeforeLateFailure = (captureBootException as jest.Mock).mock.calls.length;
    rejectProbe(new Error('late probe failure'));
    await Promise.resolve();
    expect(SettingsService.getAnonymousBugReport).toHaveBeenCalledTimes(1);
    expect(captureBootException).toHaveBeenCalledTimes(captureCallsBeforeLateFailure);
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('does NOT capture slow error if boot sequence was cancelled', async () => {
    jest.useFakeTimers();

    let resolveMigration!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    (FoodService.fixNegativeFiber as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveMigration = resolve;
          markStarted();
        })
    );

    let cancelled = false;
    const bootPromise = runDatabaseBootSequence(() => cancelled);

    await started;

    cancelled = true;
    await jest.advanceTimersByTimeAsync(35_000);

    expect(captureBootException).not.toHaveBeenCalledWith(
      expect.anything(),
      'AppBoot.bootMigration.slow',
      expect.anything()
    );

    resolveMigration();
    await bootPromise;
  });
});
