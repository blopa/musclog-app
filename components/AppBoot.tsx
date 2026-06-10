import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { ONBOARDING_COMPLETED } from '@/constants/misc';
import { isStaticExport } from '@/constants/platform';
import {
  ALL_CONFETTI_ACTIVITIES,
  CONFETTI_ALL_DONE_SENTINEL,
  CONFETTI_INTERACTIONS_KEY,
  ConfettiActivity,
} from '@/context/ConfettiInteractionsContext';
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

// All one-shot idempotent DB migrations that run on every boot, collected here so the
// per-task boilerplate (waitForDbReady, cancellation, catch+warn) lives in one place.
// Entries with webOnly: true run only on the LokiJS (web) adapter path, where the
// corresponding SQLite migration step is a no-op; all others run on every platform.
// Entries with runOnce: true persist a completion marker after the first successful
// run and are skipped on subsequent boots — required when re-running could clobber
// data the user has since edited, and an optimization for full-table scans.
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

const BOOT_MIGRATIONS: BootMigration[] = [
  {
    // Fix negative fiber values stored in nutrition_goals, foods, and nutrition_logs.
    // Each sub-task catches independently so one failure doesn't cancel the others.
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
    // LokiJS (web) silently ignores the v2 schema unsafeExecuteSql step.
    tag: 'ExerciseService.backfillExerciseSources',
    webOnly: true,
    run: () => ExerciseService.backfillExerciseSources(),
  },
  {
    // LokiJS (web) silently ignores the v3 schema unsafeExecuteSql step.
    tag: 'FoodPortionService.backfillPortionSources',
    webOnly: true,
    run: () => FoodPortionService.backfillPortionSources(),
  },
  {
    // Seed exercises from the bundled JSON missing from the DB with source='app'.
    // Sequential: multipliers depend on syncAppExercises completing first.
    tag: 'ExerciseService.syncAppExercises',
    run: async () => {
      await ExerciseService.syncAppExercises();
      await ExerciseService.syncExerciseMultipliers();
    },
  },
  {
    // Ensure app exercises appear in the same order as the bundled JSON file.
    tag: 'ExerciseService.backfillExerciseOrderIndex',
    run: () => ExerciseService.backfillExerciseOrderIndex(),
  },
  {
    // Backfill exercise-muscle links for users upgrading to v11.
    tag: 'MuscleService.backfillExerciseMuscles',
    run: () => MuscleService.backfillExerciseMuscles(),
  },
  {
    // LokiJS (web) silently ignores the v7 schema unsafeExecuteSql step.
    tag: 'ExerciseService.migrateExerciseImageUrlsToCloud',
    webOnly: true,
    run: () => ExerciseService.migrateExerciseImageUrlsToCloud(),
  },
  {
    // Backfill totalVolume for workout logs that have NULL after the v3 migration.
    tag: 'WorkoutService.backfillNullTotalVolumes',
    run: () => WorkoutService.backfillNullTotalVolumes(),
  },
  {
    // Convert legacy user_metrics.timezone IANA names to "±HH:MM" offset format (v20).
    tag: 'UserMetricService.backfillTimezoneOffsets',
    run: () => UserMetricService.backfillTimezoneOffsets(),
  },
  {
    // Backfill missing timezone columns in newly updated tables (v21).
    tag: 'TimezoneMigrationService.backfillMissingTimezones',
    run: () => TimezoneMigrationService.backfillMissingTimezones(),
  },
  {
    // Backfill consumed time-of-day into nutrition_logs.date (was stored at local
    // midnight) from each row's created_at, preserving the original calendar day.
    // runOnce: a persisted cutoff excludes newly created deliberate-midnight rows,
    // and completion is marked only after a successful run.
    tag: 'TimezoneMigrationService.backfillConsumedTimeFromCreatedAt',
    runOnce: true,
    run: (cutoffMs) => TimezoneMigrationService.backfillConsumedTimeFromCreatedAt(cutoffMs),
  },
  {
    // Encrypt API keys that were stored as plaintext before this migration was introduced.
    tag: 'SettingsService.migrateApiKeysToEncrypted',
    run: () => SettingsService.migrateApiKeysToEncrypted(),
  },
  {
    // Enable require-export-encryption by default for users who never explicitly set it.
    tag: 'SettingsService.migrateRequireExportEncryptionDefault',
    run: () => SettingsService.migrateRequireExportEncryptionDefault(),
  },
];

function getActiveBootMigrations(): BootMigration[] {
  return BOOT_MIGRATIONS.filter((m) => !m.webOnly || Platform.OS === 'web');
}

async function waitForExistingDbReady(cancelled: () => boolean): Promise<void> {
  const startedAt = Date.now();
  let attempt = 0;
  let settled = false;
  let slowTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

  return new Promise<void>((resolve) => {
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      if (slowTimer) {
        clearTimeout(slowTimer);
      }
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
      }
      resolve();
    };

    slowTimer = setTimeout(() => {
      if (settled || cancelled()) {
        return;
      }

      captureBootException(
        new Error('DB-ready probe is still waiting'),
        'AppBoot.dbReadyProbe.slow',
        {
          attempt,
          elapsedMs: Date.now() - startedAt,
        }
      );
    }, DB_READY_PROBE_SLOW_REPORT_MS);

    watchdogTimer = setTimeout(() => {
      if (settled || cancelled()) {
        return;
      }

      captureBootException(
        new Error('DB-ready probe watchdog elapsed'),
        'AppBoot.dbReadyProbe.watchdog',
        {
          attempt,
          elapsedMs: Date.now() - startedAt,
        }
      );
      finish();
    }, DB_READY_PROBE_MAX_ELAPSED_MS);

    const probe = async () => {
      while (!settled && !cancelled() && attempt < 500) {
        try {
          await SettingsService.getAnonymousBugReport();
          finish();
          return;
        } catch (err: unknown) {
          if (settled || cancelled()) {
            return;
          }

          const elapsedMs = Date.now() - startedAt;
          if (isDbReadyRetryableError(err) && elapsedMs < DB_READY_PROBE_MAX_ELAPSED_MS) {
            attempt += 1;
            await sleep(200);
            continue;
          }

          captureBootException(err, 'AppBoot.dbReadyProbe', {
            attempt,
            elapsedMs,
            retryable: isDbReadyRetryableError(err),
          });
          finish();
          return;
        }
      }

      if (!settled && !cancelled()) {
        captureBootException(
          new Error('DB-ready probe exhausted retries'),
          'AppBoot.dbReadyProbe.exhausted',
          {
            attempt,
            elapsedMs: Date.now() - startedAt,
          }
        );
        finish();
      }
    };

    void probe();
  });
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

    // Marked done only after success so failed runs retry on the next boot.
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

/**
 * One-time and boot-time data fixes, sync, and native services that are not
 * tied to a specific screen. Renders nothing.
 */
export function AppBoot() {
  const segments = useSegments();

  // Owns the DB-ready handoff and the idempotent boot migrations as one sequence.
  // Upgrading users need a readiness probe because seedProductionData() only runs
  // from onboarding. Fresh installs wait for that seeding path to mark DB-ready,
  // then run the same boot migrations.
  useEffect(() => {
    if (isStaticExport) {
      markDbReady();
      return;
    }

    let cancelled = false;

    const runDatabaseBootSequence = async () => {
      try {
        const migrations = getActiveBootMigrations();
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETED);

        if (onboardingDone === 'true') {
          beginBootProgress(1 + migrations.length);
          await waitForExistingDbReady(() => cancelled);
          if (cancelled) {
            return;
          }

          completeBootProgressStep();
          markDbReady();
        } else {
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

  // Prune orphaned workout insights dismissal state when leaving the workout domain.
  // This prevents accumulation of old keys if the app is killed or navigates away.
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

  // Fix food_portion rows saved as raw i18n keys (e.g. "food.portions.tbsp") instead of labels.
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

  // Boot-time tasks (native: Android + iOS, all run in parallel)
  //
  // IMPORTANT — DB-ready race: this effect fires at mount, which is before (or
  // concurrent with) seedProductionData() in app/onboarding/landing.tsx.
  // On a fresh install, seedProductionData() calls unsafeResetDatabase(), which
  // temporarily replaces the SQLite adapter with an ErrorAdapter that throws on
  // any query. Any boot task that touches the DB (e.g. configureDailyTasks) must
  // await waitForDbReady() from database/dbReady.ts before issuing queries.
  useEffect(() => {
    if (Platform.OS === 'web' || isStaticExport) {
      return;
    }

    const notificationInit = NotificationService.configure()
      .then(async () => {
        // Dismiss any orphaned workout notification from a previous killed session
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

    // Handle cold-start: app opened by tapping a notification
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

  // One-time migration for users upgrading from a build that predates the confetti feature.
  // When the key is absent and onboarding is already done, we inspect the DB to determine
  // which activities the user has already performed so we don't show stale confetti.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const migrateConfettiInteractions = async () => {
      try {
        const [stored, onboardingDone] = await Promise.all([
          AsyncStorage.getItem(CONFETTI_INTERACTIONS_KEY),
          AsyncStorage.getItem(ONBOARDING_COMPLETED),
        ]);

        if (stored !== null || onboardingDone !== 'true') {
          // Key already written (seeder or previous migration run), or fresh install
          // (seeder will seed it) — nothing to do.
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

    // Setup Focus Management for Mobile
    // This ensures TanStack Query knows when the app is active/foregrounded
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
