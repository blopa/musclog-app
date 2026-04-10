import { focusManager } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { isStaticExport } from '@/constants/platform';
import { ExerciseService, FoodPortionService, WorkoutService } from '@/database/services';
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

/**
 * One-time and boot-time data fixes, sync, and native services that are not
 * tied to a specific screen. Renders nothing.
 */
export function Migrations() {
  const segments = useSegments();
  const { language } = useSettings();

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
  }, [segments, isStaticExport]);

  // Backfill the exercise `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v2 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web' || isStaticExport) {
      return;
    }

    ExerciseService.backfillExerciseSources().catch((err) =>
      console.warn('[ExerciseService] backfillExerciseSources error:', err)
    );
  }, [isStaticExport]);

  // Backfill the food_portion `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v3 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web' || isStaticExport) {
      return;
    }

    FoodPortionService.backfillPortionSources().catch((err) =>
      console.warn('[FoodPortionService] backfillPortionSources error:', err)
    );
  }, [isStaticExport]);

  // Fix food_portion rows saved as raw i18n keys (e.g. "food.portions.tbsp") instead of labels.
  useEffect(() => {
    if (!language || isStaticExport) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (i18n.language !== language) {
          await i18n.changeLanguage(language);
        }
        if (cancelled) {
          return;
        }
        await FoodPortionService.fixPortionNamesStoredAsI18nKeys();
      } catch (err) {
        console.warn('[FoodPortionService] fixPortionNamesStoredAsI18nKeys error:', err);
      }
    })();

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

    ExerciseService.syncAppExercises().catch((err) =>
      console.warn('[ExerciseService] syncAppExercises error:', err)
    );
  }, [isStaticExport]);

  // Backfill totalVolume for workout logs that have NULL after the v3 migration.
  // Runs once per boot but exits immediately when there is nothing to do.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    WorkoutService.backfillNullTotalVolumes().catch((err) =>
      console.warn('[WorkoutService] backfillNullTotalVolumes error:', err)
    );
  }, [isStaticExport]);

  // Encrypt any API keys that were stored as plaintext before this migration was introduced.
  // Idempotent: already-encrypted keys are detected and left untouched.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    SettingsService.migrateApiKeysToEncrypted().catch((err) =>
      console.warn('[SettingsService] migrateApiKeysToEncrypted error:', err)
    );
  }, []);

  // One-time migration: enable require-export-encryption by default.
  // No-op if the user has already explicitly configured this setting.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    SettingsService.migrateRequireExportEncryptionDefault().catch((err) =>
      console.warn('[SettingsService] migrateRequireExportEncryptionDefault error:', err)
    );
  }, []);

  // Boot-time tasks (native: Android + iOS, all run in parallel)
  useEffect(() => {
    if (Platform.OS === 'web' || isStaticExport) {
      return;
    }

    const notificationInit = NotificationService.configure()
      .then(async () => {
        NotificationService.scheduleWorkoutReminders();
        NotificationService.scheduleNutritionOverview();
        NotificationService.scheduleMenstrualCycleNotifications();
        NotificationService.scheduleCheckinNotifications();

        // Dismiss any orphaned workout notification from a previous killed session
        const activeWorkoutLogId = await getActiveWorkoutLogId();
        if (!activeWorkoutLogId) {
          NotificationService.dismissActiveWorkoutNotification();
        }
      })
      .catch((err) => console.warn('[NotificationService] Init error:', err));

    Promise.all([
      healthDataSyncService
        .syncFromHealthPlatform({ lookbackDays: 7 })
        .catch((err) => console.warn('[boot sync] Health platform sync error:', err)),
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
  }, [isStaticExport]);

  return null;
}
