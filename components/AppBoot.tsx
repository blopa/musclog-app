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
  UserMetricService,
  TimezoneMigrationService,
  WorkoutService,
} from '@/database/services';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';
import i18n from '@/lang/lang';
import { healthDataSyncService } from '@/services/healthDataSync';
import { NotificationService } from '@/services/NotificationService';
import { getActiveWorkoutLogId, pruneWorkoutInsights } from '@/utils/activeWorkoutStorage';
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

// All one-shot idempotent DB migrations that run on every boot, collected here so the
// per-task boilerplate (waitForDbReady, cancellation, catch+warn) lives in one place.
// Entries with webOnly: true run only on the LokiJS (web) adapter path, where the
// corresponding SQLite migration step is a no-op; all others run on every platform.
type BootMigration = { tag: string; webOnly?: boolean; run: () => Promise<unknown> };

const BOOT_MIGRATIONS: BootMigration[] = [
  {
    // Fix negative fiber values stored in nutrition_goals, foods, and nutrition_logs.
    // Each sub-task catches independently so one failure doesn't cancel the others.
    tag: 'fixNegativeFiber',
    run: () =>
      Promise.all([
        NutritionGoalService.fixNegativeFiber().catch((err) =>
          console.warn('[NutritionGoalService] fixNegativeFiber error:', err)
        ),
        FoodService.fixNegativeFiber().catch((err) =>
          console.warn('[FoodService] fixNegativeFiber error:', err)
        ),
        NutritionService.fixNegativeFiber().catch((err) =>
          console.warn('[NutritionService] fixNegativeFiber error:', err)
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

/**
 * One-time and boot-time data fixes, sync, and native services that are not
 * tied to a specific screen. Renders nothing.
 */
export function AppBoot() {
  const segments = useSegments();
  const { language } = useSettings();

  // Probe for WatermelonDB JSI driver readiness and call markDbReady() once the driver is
  // registered. This is needed for upgrading users: seedProductionData() (which calls
  // markDbReady()) only runs on new installs via the onboarding landing page, so upgrading
  // users would otherwise leave waitForDbReady() hanging forever.
  //
  // For new installs (onboarding not yet completed), we skip the probe — seedProductionData()
  // will call markDbReady() after seeding completes.
  //
  // On web/static export we mark ready immediately since there is no JSI adapter.
  useEffect(() => {
    if (isStaticExport) {
      markDbReady();
      return;
    }

    let cancelled = false;

    const probe = async () => {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_COMPLETED);
      if (onboardingDone !== 'true') {
        return;
      }

      for (let attempt = 0; attempt < 500 && !cancelled; attempt++) {
        try {
          await SettingsService.getAnonymousBugReport();
          if (!cancelled) {
            markDbReady();
          }

          return;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (DB_RESET_RACE_ERRORS.some((needle) => msg.includes(needle))) {
            await new Promise<void>((resolve) => setTimeout(resolve, 200));
            continue;
          }
          // Any other error means the JSI driver is registered — mark ready.
          if (!cancelled) {
            markDbReady();
          }

          return;
        }
      }

      // Exhausted retries — unblock the app to avoid a permanent freeze.
      if (!cancelled) {
        markDbReady();
      }
    };

    void probe();

    return () => {
      cancelled = true;
    };
  }, []);

  // Run all idempotent boot migrations in parallel after the DB is ready.
  // See BOOT_MIGRATIONS above for the full list and rationale per entry.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const runBootMigrations = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await Promise.all(
        BOOT_MIGRATIONS.filter((m) => !m.webOnly || Platform.OS === 'web').map((m) =>
          m.run().catch((err) => console.warn(`[AppBoot] ${m.tag} error:`, err))
        )
      );
    };

    void runBootMigrations();

    return () => {
      cancelled = true;
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
      pruneWorkoutInsights().catch((err) => console.warn('[WorkoutInsights] Pruning error:', err));
    }
  }, [segments]);

  // Fix food_portion rows saved as raw i18n keys (e.g. "food.portions.tbsp") instead of labels.
  useEffect(() => {
    if (!language || isStaticExport) {
      return;
    }

    let cancelled = false;

    const fixPortionNames = async () => {
      try {
        if (i18n.language !== language) {
          await i18n.changeLanguage(language);
        }
        if (cancelled) {
          return;
        }
        await waitForDbReady();
        if (cancelled) {
          return;
        }
        await FoodPortionService.fixPortionNamesStoredAsI18nKeys();
      } catch (err) {
        console.warn('[FoodPortionService] fixPortionNamesStoredAsI18nKeys error:', err);
      }
    };

    void fixPortionNames();

    return () => {
      cancelled = true;
    };
  }, [language]);

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
      .catch((err) => console.warn('[NotificationService] Init error:', err));

    Promise.all([
      waitForDbReady().then(() =>
        healthDataSyncService
          .syncFromHealthPlatform({ lookbackDays: 7 })
          .catch((err) => console.warn('[boot sync] Health platform sync error:', err))
      ),
      configureDailyTasks().catch((err) =>
        console.warn('[configureDailyTasks] Startup error:', err)
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
      .catch((err: unknown) =>
        console.warn('[NotificationService] Cold-start response error:', err)
      );

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
        console.warn('[AppBoot] Failed to migrate confetti interactions state:', err);
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
