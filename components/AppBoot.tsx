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

  // Fix negative fiber values in nutrition_goals, foods, and nutrition_logs by clamping to zero.
  // nutrition_logs fiber is encrypted so all non-deleted logs are fetched and decrypted in JS.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const fixNegativeFiber = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await Promise.all([
        NutritionGoalService.fixNegativeFiber().catch((err) =>
          console.warn('[NutritionGoalService] fixNegativeFiber error:', err)
        ),
        FoodService.fixNegativeFiber().catch((err) =>
          console.warn('[FoodService] fixNegativeFiber error:', err)
        ),
        NutritionService.fixNegativeFiber().catch((err) =>
          console.warn('[NutritionService] fixNegativeFiber error:', err)
        ),
      ]);
    };

    void fixNegativeFiber();

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

  // Backfill the exercise `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v2 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web' || isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillExerciseSources = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await ExerciseService.backfillExerciseSources().catch((err) =>
        console.warn('[ExerciseService] backfillExerciseSources error:', err)
      );
    };

    void backfillExerciseSources();

    return () => {
      cancelled = true;
    };
  }, []);

  // Backfill the food_portion `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v3 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web' || isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillPortionSources = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await FoodPortionService.backfillPortionSources().catch((err) =>
        console.warn('[FoodPortionService] backfillPortionSources error:', err)
      );
    };

    void backfillPortionSources();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Sync app exercises on every boot: seeds any exercises that are in the
  // bundled JSON but missing from the DB with source='app'. This is a no-op
  // on most boots once the DB is up to date.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const syncExercises = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      try {
        await ExerciseService.syncAppExercises();
        if (cancelled) {
          return;
        }
        await ExerciseService.syncExerciseMultipliers();
      } catch (err) {
        console.warn('[ExerciseService] syncAppExercises/Multipliers error:', err);
      }
    };

    void syncExercises();

    return () => {
      cancelled = true;
    };
  }, []);

  // Backfill order_index for existing app exercises on every boot.
  // Ensures app exercises appear in the same order as the JSON file.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillExerciseOrderIndex = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await ExerciseService.backfillExerciseOrderIndex().catch((err) =>
        console.warn('[ExerciseService] backfillExerciseOrderIndex error:', err)
      );
    };

    void backfillExerciseOrderIndex();

    return () => {
      cancelled = true;
    };
  }, []);

  // Backfill exercise-muscle links for users upgrading to v11. Runs on every
  // boot but is a cheap no-op once all exercises are linked. New installs also
  // hit this path, but seedProductionData already called backfillExerciseMuscles
  // during setup — the no-op exit path costs only two DB reads.
  //
  // This now waits for the boot DB gate so the upgrade path never races the
  // seeding/migration window. On a fresh install the effect simply runs after
  // seedProductionData() resolves and marks the DB ready.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillExerciseMuscles = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await MuscleService.backfillExerciseMuscles().catch((err) =>
        console.warn('[MuscleService] backfillExerciseMuscles error:', err)
      );
    };

    void backfillExerciseMuscles();

    return () => {
      cancelled = true;
    };
  }, []);

  // Web fallback for the v7 migration: replace file:// exercise image URIs with
  // cloud URLs. LokiJS (web) silently ignores unsafeExecuteSql, so we run the
  // equivalent JS logic here. No-op when there is nothing to migrate.
  useEffect(() => {
    if (Platform.OS !== 'web' || isStaticExport) {
      return;
    }

    let cancelled = false;

    const migrateExerciseImageUrls = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await ExerciseService.migrateExerciseImageUrlsToCloud().catch((err) =>
        console.warn('[ExerciseService] migrateExerciseImageUrlsToCloud error:', err)
      );
    };

    void migrateExerciseImageUrls();

    return () => {
      cancelled = true;
    };
  }, []);

  // Backfill totalVolume for workout logs that have NULL after the v3 migration.
  // Runs once per boot but exits immediately when there is nothing to do.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillNullTotalVolumes = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await WorkoutService.backfillNullTotalVolumes().catch((err) =>
        console.warn('[WorkoutService] backfillNullTotalVolumes error:', err)
      );
    };

    void backfillNullTotalVolumes();

    return () => {
      cancelled = true;
    };
  }, []);

  // Convert legacy user_metrics.timezone values from IANA zone names to the app's "±HH:MM"
  // offset format (paired with the v20 migration). DST-aware, so it can't run as SQL.
  // Runs once per boot but exits immediately when there is nothing to convert.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const backfillTimezoneOffsets = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await UserMetricService.backfillTimezoneOffsets().catch((err) =>
        console.warn('[UserMetricService] backfillTimezoneOffsets error:', err)
      );
    };

    void backfillTimezoneOffsets();

    return () => {
      cancelled = true;
    };
  }, []);

  // Encrypt any API keys that were stored as plaintext before this migration was introduced.
  // Idempotent: already-encrypted keys are detected and left untouched.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const migrateApiKeysToEncrypted = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await SettingsService.migrateApiKeysToEncrypted().catch((err) =>
        console.warn('[SettingsService] migrateApiKeysToEncrypted error:', err)
      );
    };

    void migrateApiKeysToEncrypted();

    return () => {
      cancelled = true;
    };
  }, []);

  // One-time migration: enable require-export-encryption by default.
  // No-op if the user has already explicitly configured this setting.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;

    const migrateRequireExportEncryptionDefault = async () => {
      await waitForDbReady();
      if (cancelled) {
        return;
      }

      await SettingsService.migrateRequireExportEncryptionDefault().catch((err) =>
        console.warn('[SettingsService] migrateRequireExportEncryptionDefault error:', err)
      );
    };

    void migrateRequireExportEncryptionDefault();

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
