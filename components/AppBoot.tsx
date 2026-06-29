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
import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import { PeriodLogRepository } from '@/database/repositories/PeriodLogRepository';
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

const PERIOD_LOGS_BACKFILL_V22_KEY = 'PERIOD_LOGS_BACKFILL_V22_DONE';

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

  // One-time backfill: users who upgraded from v21 have last_period_start_date on
  // their menstrual_cycles row but no corresponding period_log entries. Seed one
  // period_log from that anchor so the new luteal-anchored prediction code has data.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const backfillPeriodLogs = async () => {
      try {
        const alreadyDone = await AsyncStorage.getItem(PERIOD_LOGS_BACKFILL_V22_KEY);
        if (alreadyDone) {
          return;
        }

        await waitForDbReady();

        const cycles = await MenstrualCycleRepository.getAll().fetch();

        const logsToCreate = (
          await Promise.all(
            cycles
              .filter((cycle) => !!cycle.lastPeriodStartDate)
              .map(async (cycle) => {
                const existing = await PeriodLogRepository.fetchForCycle(cycle.id);
                if (existing.length > 0) {
                  return null;
                }

                return {
                  menstrualCycleId: cycle.id,
                  startDate: cycle.lastPeriodStartDate as number,
                  endDate: null,
                  timezone: cycle.timezone ?? undefined,
                };
              })
          )
        ).filter((l): l is NonNullable<typeof l> => l !== null);

        if (logsToCreate.length > 0) {
          await PeriodLogRepository.createMany(logsToCreate);
        }

        await AsyncStorage.setItem(PERIOD_LOGS_BACKFILL_V22_KEY, '1');
      } catch (err) {
        captureBootException(err, 'AppBoot.backfillPeriodLogs');
      }
    };

    void backfillPeriodLogs();
  }, []);

  return null;
}
