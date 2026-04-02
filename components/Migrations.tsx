import { focusManager } from '@tanstack/react-query';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import { ExerciseService, FoodPortionService, WorkoutService } from '../database/services';
import { useSettings } from '../hooks/useSettings';
import i18n from '../lang/lang';
import { healthDataSyncService } from '../services/healthDataSync';
import { NotificationService } from '../services/NotificationService';
import { getActiveWorkoutLogId, pruneWorkoutInsights } from '../utils/activeWorkoutStorage';
import { configureDailyTasks } from '../utils/configureDailyTasks';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  handleNotificationResponse,
} from '../utils/notifications';

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
    const isInsideWorkoutDomain = segments[0] === 'workout';
    if (!isInsideWorkoutDomain) {
      pruneWorkoutInsights().catch((err) => console.warn('[WorkoutInsights] Pruning error:', err));
    }
  }, [segments]);

  // Backfill the exercise `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v2 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    ExerciseService.backfillExerciseSources().catch((err) =>
      console.warn('[ExerciseService] backfillExerciseSources error:', err)
    );
  }, []);

  // Backfill the food_portion `source` field on web only. Native/SQLite handles
  // this via unsafeExecuteSql in the v3 schema migration; LokiJS (web) silently
  // ignores that step, so we run the JS equivalent here instead.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    FoodPortionService.backfillPortionSources().catch((err) =>
      console.warn('[FoodPortionService] backfillPortionSources error:', err)
    );
  }, []);

  // Fix food_portion rows saved as raw i18n keys (e.g. "food.portions.tbsp") instead of labels.
  useEffect(() => {
    if (!language) {
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
    ExerciseService.syncAppExercises().catch((err) =>
      console.warn('[ExerciseService] syncAppExercises error:', err)
    );
  }, []);

  // Backfill totalVolume for workout logs that have NULL after the v3 migration.
  // Runs once per boot but exits immediately when there is nothing to do.
  useEffect(() => {
    WorkoutService.backfillNullTotalVolumes().catch((err) =>
      console.warn('[WorkoutService] backfillNullTotalVolumes error:', err)
    );
  }, []);

  // Boot-time tasks (native: Android + iOS, all run in parallel)
  useEffect(() => {
    if (Platform.OS === 'web') {
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
