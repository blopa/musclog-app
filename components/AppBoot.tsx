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
import { runDatabaseBootSequence, stopDatabaseBootProgress } from '@/database/dbBootCoordinator';
import { waitForDbReady } from '@/database/dbReady';
import {
  ExerciseGoalService,
  FoodPortionService,
  MealService,
  NutritionGoalService,
  NutritionService,
  WorkoutService,
} from '@/database/services';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { healthDataSyncService } from '@/services/healthDataSync';
import { NotificationService } from '@/services/NotificationService';
import { getActiveWorkoutLogId, pruneWorkoutInsights } from '@/utils/activeWorkoutStorage';
import { captureBootException } from '@/utils/bootErrorReporting';
import { configureDailyTasks } from '@/utils/configureDailyTasks';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
  handleNotificationResponse,
} from '@/utils/notifications';
import { isOnboardingCompleted } from '@/utils/onboardingService';

export function AppBoot() {
  const segments = useSegments();

  useEffect(() => {
    let cancelled = false;

    void runDatabaseBootSequence(() => cancelled);

    return () => {
      cancelled = true;
      stopDatabaseBootProgress();
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

    void Promise.all([
      waitForDbReady().then(() =>
        healthDataSyncService
          .syncFromHealthPlatform({ lookbackDays: 7 })
          .catch((err) => captureBootException(err, 'HealthDataSync.bootSync'))
      ),
      configureDailyTasks().catch((err) =>
        captureBootException(err, 'configureDailyTasks.bootStartup')
      ),
      notificationInit,
    ]).catch((err) => captureBootException(err, 'AppBoot.nativeBootTasks'));
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
