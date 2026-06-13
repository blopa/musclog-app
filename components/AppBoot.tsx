import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { isStaticExport } from '@/constants/platform';
import {
  ALL_CONFETTI_ACTIVITIES,
  CONFETTI_ALL_DONE_SENTINEL,
  CONFETTI_INTERACTIONS_KEY,
  ConfettiActivity,
} from '@/context/ConfettiInteractionsContext';
import { startDbDurabilityMonitoring } from '@/database/dbDurability';
import { markDbReady, waitForDbReady } from '@/database/dbReady';
import {
  ExerciseGoalService,
  ExerciseService,
  FoodPortionService,
  FoodService,
  MealService,
  MuscleService,
  NutritionGoalService,
  NutritionService,
  TimezoneMigrationService,
  UserMetricService,
  WorkoutService,
} from '@/database/services';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { healthDataSyncService } from '@/services/healthDataSync';
import { NotificationService } from '@/services/NotificationService';
import { getActiveWorkoutLogId, pruneWorkoutInsights } from '@/utils/activeWorkoutStorage';
import { captureBootException } from '@/utils/bootErrorReporting';
import {
  beginBootProgress,
  completeBootProgressStep,
  finishBootProgress,
} from '@/utils/bootProgress';
import { configureDailyTasks } from '@/utils/configureDailyTasks';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  handleNotificationResponse,
} from '@/utils/notifications';
import { isOnboardingCompleted } from '@/utils/onboardingService';

const DB_RESET_RACE_ERRORS = [
  'No driver with tag',
  'Cannot call database.adapter.underlyingAdapter while the database is being reset',
];
const DB_READY_PROBE_SLOW_REPORT_MS = 15_000;
const DB_READY_PROBE_MAX_ELAPSED_MS = 45_000;
const BOOT_MIGRATION_SLOW_REPORT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDbReadyRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return DB_RESET_RACE_ERRORS.some((needle) => msg.includes(needle));
}

type BootMigration = {
  tag: string;
  webOnly?: boolean;
  runOnce?: boolean;
  run: (cutoffMs: number) => Promise<unknown>;
};

const bootMigrationDoneKey = (tag: string) => `boot_migration_done:${tag}`;
const bootMigrationCutoffKey = (tag: string) => `boot_migration_cutoff:${tag}`;

async function getRunOnceMigrationCutoff(tag: string): Promise<number> {
  const key = bootMigrationCutoffKey(tag);
  const existing = await AsyncStorage.getItem(key);
  const parsed = existing ? Number(existing) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const cutoff = Date.now();
  await AsyncStorage.setItem(key, String(cutoff));
  return cutoff;
}

// Native WatermelonDB schema migrations can miss web/LokiJS data rewrites, so
// webOnly boot migrations cover those platform-specific gaps after boot.
// runOnce migrations record a stable cutoff because repeating them later could
// overwrite user-edited data with stale historical assumptions.
const BOOT_MIGRATIONS: BootMigration[] = [
  {
    tag: 'fixNegativeFiber',
    run: () =>
      Promise.all([
        NutritionGoalService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'NutritionGoalService.fixNegativeFiber')
        ),
        FoodService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'FoodService.fixNegativeFiber')
        ),
        NutritionService.fixNegativeFiber().catch((err) =>
          captureBootException(err, 'NutritionService.fixNegativeFiber')
        ),
      ]),
  },
  {
    tag: 'ExerciseService.backfillExerciseSources',
    // Watermelon's native SQL migration covered SQLite; LokiJS needs boot-time data repair.
    webOnly: true,
    run: () => ExerciseService.backfillExerciseSources(),
  },
  {
    tag: 'FoodPortionService.backfillPortionSources',
    // Watermelon's native SQL migration covered SQLite; LokiJS needs boot-time data repair.
    webOnly: true,
    run: () => FoodPortionService.backfillPortionSources(),
  },
  {
    tag: 'ExerciseService.syncAppExercises',
    run: async () => {
      await ExerciseService.syncAppExercises();
      await ExerciseService.syncExerciseMultipliers();
    },
  },
  {
    tag: 'ExerciseService.backfillExerciseOrderIndex',
    run: () => ExerciseService.backfillExerciseOrderIndex(),
  },
  {
    tag: 'MuscleService.backfillExerciseMuscles',
    run: () => MuscleService.backfillExerciseMuscles(),
  },
  {
    tag: 'ExerciseService.migrateExerciseImageUrlsToCloud',
    // Web skipped the native migration path that rewrites bundled image URLs.
    webOnly: true,
    run: () => ExerciseService.migrateExerciseImageUrlsToCloud(),
  },
  {
    tag: 'WorkoutService.backfillNullTotalVolumes',
    run: () => WorkoutService.backfillNullTotalVolumes(),
  },
  {
    tag: 'UserMetricService.backfillTimezoneOffsets',
    run: () => UserMetricService.backfillTimezoneOffsets(),
  },
  {
    tag: 'TimezoneMigrationService.backfillMissingTimezones',
    run: () => TimezoneMigrationService.backfillMissingTimezones(),
  },
  {
    tag: 'TimezoneMigrationService.backfillConsumedTimeFromCreatedAt',
    // Use the first-run cutoff so future edits are never re-derived from created_at.
    runOnce: true,
    run: (cutoffMs) => TimezoneMigrationService.backfillConsumedTimeFromCreatedAt(cutoffMs),
  },
  {
    tag: 'SettingsService.migrateApiKeysToEncrypted',
    run: () => SettingsService.migrateApiKeysToEncrypted(),
  },
  {
    tag: 'SettingsService.migrateRequireExportEncryptionDefault',
    run: () => SettingsService.migrateRequireExportEncryptionDefault(),
  },
];

function getActiveBootMigrations(): BootMigration[] {
  return BOOT_MIGRATIONS.filter((m) => !m.webOnly || Platform.OS === 'web');
}

async function waitForExistingDbReady(cancelled: () => boolean): Promise<void> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  let attempt = 0;

  const slowTimer = setTimeout(() => {
    if (!cancelled()) {
      captureBootException(
        new Error('DB-ready probe is still waiting'),
        'AppBoot.dbReadyProbe.slow',
        { attempt, elapsedMs: elapsed() }
      );
    }
  }, DB_READY_PROBE_SLOW_REPORT_MS);

  const probe = async (): Promise<void> => {
    while (!cancelled()) {
      try {
        await SettingsService.getAnonymousBugReport();
        return;
      } catch (err: unknown) {
        if (cancelled()) {
          return;
        }

        if (isDbReadyRetryableError(err) && elapsed() < DB_READY_PROBE_MAX_ELAPSED_MS) {
          attempt += 1;
          await sleep(200);
          continue;
        }

        captureBootException(err, 'AppBoot.dbReadyProbe', {
          attempt,
          elapsedMs: elapsed(),
          retryable: isDbReadyRetryableError(err),
        });
        return;
      }
    }
  };

  // The watchdog unblocks boot if the probe query hangs without ever rejecting.
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<void>((resolve) => {
    watchdogTimer = setTimeout(() => {
      if (!cancelled()) {
        captureBootException(
          new Error('DB-ready probe watchdog elapsed'),
          'AppBoot.dbReadyProbe.watchdog',
          { attempt, elapsedMs: elapsed() }
        );
      }
      resolve();
    }, DB_READY_PROBE_MAX_ELAPSED_MS);
  });

  try {
    await Promise.race([probe(), watchdog]);
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdogTimer);
  }
}

async function runBootMigration(m: BootMigration): Promise<void> {
  const startedAt = Date.now();
  const slowTimer = setTimeout(() => {
    captureBootException(
      new Error('Boot migration is still running'),
      'AppBoot.bootMigration.slow',
      {
        tag: m.tag,
        elapsedMs: Date.now() - startedAt,
      }
    );
  }, BOOT_MIGRATION_SLOW_REPORT_MS);

  try {
    if (m.runOnce && (await AsyncStorage.getItem(bootMigrationDoneKey(m.tag)))) {
      return;
    }

    const cutoffMs = m.runOnce ? await getRunOnceMigrationCutoff(m.tag) : Date.now();
    await m.run(cutoffMs);

    if (m.runOnce) {
      await AsyncStorage.setItem(bootMigrationDoneKey(m.tag), '1');
      await AsyncStorage.removeItem(bootMigrationCutoffKey(m.tag));
    }
  } catch (err) {
    captureBootException(err, 'AppBoot.bootMigration', {
      tag: m.tag,
      runOnce: m.runOnce === true,
      webOnly: m.webOnly === true,
    });
  } finally {
    clearTimeout(slowTimer);
    completeBootProgressStep();
  }
}

export function AppBoot() {
  const segments = useSegments();

  useEffect(() => {
    if (isStaticExport) {
      markDbReady();
      return;
    }

    let cancelled = false;

    const runDatabaseBootSequence = async () => {
      try {
        const migrations = getActiveBootMigrations();
        const onboardingDone = await isOnboardingCompleted();

        if (onboardingDone) {
          beginBootProgress(1 + migrations.length);
          // Completed users may boot while the production seed reset is still
          // swapping adapters; probe before marking ready. New installs render
          // AppDbReadyGate immediately because seeding lives inside that gated tree.
          await waitForExistingDbReady(() => cancelled);
          if (cancelled) {
            return;
          }

          completeBootProgressStep();
          markDbReady();
        } else {
          // New installs are unblocked by AppDbReadyGate/seedProductionData calling markDbReady().
          await waitForDbReady();
          if (cancelled) {
            return;
          }

          beginBootProgress(migrations.length);
        }

        await Promise.all(migrations.map((m) => runBootMigration(m)));

        if (!cancelled) {
          finishBootProgress();
        }
      } catch (err) {
        captureBootException(err, 'AppBoot.databaseBootSequence');
        markDbReady();
        finishBootProgress();
      }
    };

    void runDatabaseBootSequence();

    return () => {
      cancelled = true;
      finishBootProgress();
    };
  }, []);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const isInsideWorkoutDomain = segments[0] === 'workout';
    if (!isInsideWorkoutDomain) {
      pruneWorkoutInsights().catch((err) =>
        captureBootException(err, 'WorkoutInsights.pruneOrphans')
      );
    }
  }, [segments]);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const fixPortionNames = async () => {
      try {
        await waitForDbReady();
        if (cancelled) {
          return;
        }

        const language = await SettingsService.getLanguage();
        if (!language || cancelled) {
          return;
        }

        if (i18n.language !== language) {
          await i18n.changeLanguage(language);
        }

        if (cancelled) {
          return;
        }

        await FoodPortionService.fixPortionNamesStoredAsI18nKeys();
      } catch (err) {
        captureBootException(err, 'FoodPortionService.fixPortionNamesStoredAsI18nKeys');
      }
    };

    void fixPortionNames();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || isStaticExport) {
      return;
    }

    const notificationInit = NotificationService.configure()
      .then(async () => {
        const activeWorkoutLogId = await getActiveWorkoutLogId();
        if (!activeWorkoutLogId) {
          NotificationService.dismissActiveWorkoutNotification();
        }

        await waitForDbReady();

        NotificationService.scheduleWorkoutReminders();
        NotificationService.scheduleNutritionOverview();
        NotificationService.scheduleMenstrualCycleNotifications();
        NotificationService.scheduleCheckinNotifications();
      })
      .catch((err) => captureBootException(err, 'NotificationService.bootInit'));

    startDbDurabilityMonitoring();
    // dbDurability owns its AppState listener so WAL checkpointing stays with the durability policy.

    Promise.all([
      waitForDbReady().then(() =>
        healthDataSyncService
          .syncFromHealthPlatform({ lookbackDays: 7 })
          .catch((err) => captureBootException(err, 'HealthDataSync.bootSync'))
      ),
      configureDailyTasks().catch((err) =>
        captureBootException(err, 'configureDailyTasks.bootStartup')
      ),
      notificationInit,
    ]);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      })
      .catch((err: unknown) => captureBootException(err, 'NotificationService.coldStartResponse'));

    const subscription = addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const migrateConfettiInteractions = async () => {
      try {
        const [stored, onboardingDone] = await Promise.all([
          AsyncStorage.getItem(CONFETTI_INTERACTIONS_KEY),
          isOnboardingCompleted(),
        ]);

        if (stored !== null || !onboardingDone) {
          return;
        }

        await waitForDbReady();

        const [nutritionLogs, nutritionGoals, exerciseGoals, workoutHistory, meals] =
          await Promise.all([
            NutritionService.getNutritionLogsPaginated(1, 0),
            NutritionGoalService.getHistory(1),
            ExerciseGoalService.getGoalHistory(1, 0),
            WorkoutService.getWorkoutHistory(undefined, 1, 0),
            MealService.getMealsPaginated(1, 0),
          ]);

        const done = new Set<string>([
          ConfettiActivity.ONBOARDING_COMPLETED,
          ConfettiActivity.ONBOARDING_CONFIRMED,
        ]);

        if (nutritionLogs.length > 0) {
          done.add(ConfettiActivity.FIRST_NUTRITION_LOG);
        }
        if (nutritionGoals.length > 0) {
          done.add(ConfettiActivity.FIRST_MANUAL_NUTRITION_GOAL);
        }
        if (exerciseGoals.length > 0) {
          done.add(ConfettiActivity.FIRST_FITNESS_GOAL);
        }
        if (workoutHistory.length > 0) {
          done.add(ConfettiActivity.FIRST_WORKOUT_CREATED);
        }
        if (meals.length > 0) {
          done.add(ConfettiActivity.FIRST_MEAL_CREATED);
        }

        const pending = ALL_CONFETTI_ACTIVITIES.filter((a) => !done.has(a));

        await AsyncStorage.setItem(
          CONFETTI_INTERACTIONS_KEY,
          pending.length === 0 ? CONFETTI_ALL_DONE_SENTINEL : JSON.stringify(pending)
        );
      } catch (err) {
        captureBootException(err, 'AppBoot.migrateConfettiInteractions');
      }
    };

    void migrateConfettiInteractions();
  }, []);

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    }

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => subscription.remove();
  }, []);

  return null;
}
