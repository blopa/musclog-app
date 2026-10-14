import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import {
  GOAL_AT_RISK_NOTIFICATION_TYPE,
  NOTIFICATION_ACTIONS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  REST_TIMER_NOTIFICATION_ID,
  REST_TIMER_REPEAT_NOTIFICATION_ID,
  UNFINISHED_WORKOUT_NOTIFICATION_ID,
} from '@/constants/notificationActions';
import { database } from '@/database';
import type WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import {
  cancelScheduledByType,
  loadNotificationPreferences,
} from '@/services/notificationScheduling';
import { darkTheme } from '@/theme';
import { localDayStartMs } from '@/utils/calendarDate';
import {
  calendarWeekBounds,
  goalAtRiskFireDate,
  goalAtRiskRemaining,
  isSuppressed,
  planWorkoutReminders,
  REST_ADD_SECONDS,
  REST_REPEAT_DELAY_SECONDS,
  SNOOZE_MINUTES,
  UNFINISHED_WORKOUT_DELAY_MINUTES,
} from '@/utils/notificationPolicy';

export class NotificationService {
  private static isConfigured = false;

  /** True while a screen that shows the rest countdown (and fires its haptics) is mounted. */
  private static restCueVisible = false;

  static setRestCueVisible(visible: boolean) {
    this.restCueVisible = visible;
  }

  /** Action buttons. Labels are read at registration; a language change applies on the next launch. */
  private static async registerCategories() {
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.restTimer, [
      {
        identifier: NOTIFICATION_ACTIONS.restAddTime,
        buttonTitle: i18n.t('notifications.actions.addRest', { seconds: REST_ADD_SECONDS }),
        options: { opensAppToForeground: false },
      },
      {
        identifier: NOTIFICATION_ACTIONS.restNextSet,
        buttonTitle: i18n.t('notifications.actions.nextSet'),
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORIES.workoutReminder, [
      {
        identifier: NOTIFICATION_ACTIONS.reminderSnooze,
        buttonTitle: i18n.t('notifications.actions.snooze'),
        options: { opensAppToForeground: false },
      },
    ]);
  }

  static async configure() {
    if (this.isConfigured || Platform.OS === 'web') {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const id = notification.request.identifier;
        const isWorkoutUpdate = id === 'active-workout-notification';
        // The rest screen already buzzes in the hand; a banner and a chime on top of a countdown the
        // user is looking at adds noise, not information. Only the backgrounded app gets the push.
        const isRestAlertOverVisibleTimer =
          this.restCueVisible &&
          AppState.currentState === 'active' &&
          (id === REST_TIMER_NOTIFICATION_ID || id === REST_TIMER_REPEAT_NOTIFICATION_ID);
        const quiet = isWorkoutUpdate || isRestAlertOverVisibleTimer;
        return {
          shouldShowAlert: !quiet,
          shouldPlaySound: !quiet,
          shouldSetBadge: false,
          shouldShowBanner: !quiet,
          shouldShowList: !isRestAlertOverVisibleTimer,
        };
      },
    });

    if (Platform.OS === 'android') {
      // Always the dark theme's color: Android fixes a channel's lightColor at creation, so
      // it can never follow the theme, and reading the preference here would touch the
      // database before it is ready (configure() runs ahead of waitForDbReady()).
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.default, {
        name: i18n.t('notifications.channels.default'),
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: darkTheme.colors.status.error,
      });

      // Cycle reminders get their own channel so they can be silenced on their own in the OS
      // settings, and so a secure lock screen hides their text whatever wording was chosen.
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.cycle, {
        name: i18n.t('notifications.channels.cycle'),
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.activeWorkout, {
        name: i18n.t('notifications.channels.activeWorkout'),
        importance: Notifications.AndroidImportance.LOW, // Low importance for persistent notification to avoid annoying sound/popup on every update
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // The rest alert is part of the workout, not engagement: it keeps the loudest importance, and
      // living on its own channel lets someone keep it loud while quieting every reminder.
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.restTimer, {
        name: i18n.t('notifications.channels.restTimer'),
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });

      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.workoutReminders, {
        name: i18n.t('notifications.channels.workoutReminders'),
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    }

    await this.registerCategories();

    this.isConfigured = true;
  }

  static async requestPermissions() {
    if (Platform.OS === 'web') {
      return false;
    }

    const permissions = (await Notifications.getPermissionsAsync()) as {
      status: Notifications.PermissionStatus;
    };
    let finalStatus = permissions.status;
    if (finalStatus !== 'granted') {
      const requestResult = (await Notifications.requestPermissionsAsync()) as {
        status: Notifications.PermissionStatus;
      };
      finalStatus = requestResult.status;
    }

    return finalStatus === 'granted';
  }

  static async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data: Record<string, unknown> = {},
    channelId: string = 'default'
  ) {
    if (Platform.OS === 'web') {
      return null;
    }

    const isNotificationsEnabled = await SettingsService.getNotifications();
    if (!isNotificationsEnabled) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        ...Platform.select({
          android: {
            channelId,
          },
        }),
      },
      trigger,
    });
  }

  static async cancelAllNotifications() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async cancelNotification(notificationId: string) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Active Workout Notification (Persistent)
  static async updateActiveWorkoutNotification(
    workoutName: string,
    totalTime: string,
    currentExercise?: string,
    workoutLogId?: string
  ) {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsActiveWorkout();
    const isNotificationsEnabled = await SettingsService.getNotifications();
    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Both lines show on a locked screen, so the person can trade detail for privacy.
    const { lockScreenDetail } = await loadNotificationPreferences();
    const isMinimal = lockScreenDetail === 'minimal';
    const title = isMinimal
      ? i18n.t('notifications.types.activeWorkout.titleMinimal')
      : i18n.t('notifications.types.activeWorkout.title', { workoutName });
    const body =
      currentExercise && !isMinimal
        ? i18n.t('notifications.types.activeWorkout.body', { totalTime, currentExercise })
        : i18n.t('notifications.types.activeWorkout.bodyNoExercise', { totalTime });

    // On Android, we use a fixed ID for the active workout notification to update it
    const NOTIFICATION_ID = 'active-workout-notification';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body,
        data: { type: 'active-workout', workoutLogId },
        sticky: true, // Prevents swipe dismissal on Android - must be at top level of content
        ...Platform.select({
          android: {
            channelId: 'workout-active',
            autoDismiss: false, // Prevents dismissal on click
          },
          ios: {
            interruptionLevel: 'timeSensitive', // Makes notification more prominent and persistent on iOS
          },
        }),
      } as Notifications.NotificationContentInput,
      trigger: null, // show immediately
    });
  }

  static async dismissActiveWorkoutNotification() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.dismissNotificationAsync('active-workout-notification');
  }

  // Test methods - bypass settings checks for development/testing
  static async testNotification(
    title: string,
    body: string,
    data: Record<string, unknown> = {},
    channelId: string = 'default'
  ) {
    if (Platform.OS === 'web') {
      console.log('[Test Notification]', title, body);
      return null;
    }

    // Ensure configured (configure() is idempotent)
    await this.configure();

    // Request permissions if not granted
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissions not granted for test notification');
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        ...Platform.select({
          android: {
            channelId,
          },
        }),
      },
      trigger: null, // Show immediately
    });
  }

  static async testActiveWorkoutNotification(
    workoutName: string,
    totalTime: string,
    currentExercise?: string
  ) {
    if (Platform.OS === 'web') {
      console.log('[Test Active Workout Notification]', workoutName, totalTime, currentExercise);
      return;
    }

    // Ensure configured (configure() is idempotent)
    await this.configure();

    // Request permissions if not granted
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissions not granted for test notification');
      return;
    }

    const title = i18n.t('notifications.types.activeWorkout.title', { workoutName });
    const body = currentExercise
      ? i18n.t('notifications.types.activeWorkout.body', { totalTime, currentExercise })
      : i18n.t('notifications.types.activeWorkout.bodyNoExercise', { totalTime });

    const NOTIFICATION_ID = 'active-workout-notification';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: true, // Prevents swipe dismissal on Android - must be at top level of content
        ...Platform.select({
          android: {
            channelId: 'workout-active',
            autoDismiss: false, // Prevents dismissal on click
          },
          ios: {
            interruptionLevel: 'timeSensitive', // Makes notification more prominent and persistent on iOS
          },
        }),
      } as Notifications.NotificationContentInput,
      trigger: null, // show immediately
    });
  }

  // Workout Reminders
  static async scheduleWorkoutReminders() {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsWorkoutReminders();
    const isNotificationsEnabled = await SettingsService.getNotifications();

    // Always clear existing reminders before rescheduling
    await cancelScheduledByType('workout-reminder');

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    const prefs = await loadNotificationPreferences();
    const resolvedSchedules = await WorkoutPlanRepository.getResolvedSchedules();
    const templateIds = [...new Set(resolvedSchedules.map((schedule) => schedule.templateId))];
    const templates =
      templateIds.length > 0
        ? await database
            .get<WorkoutTemplate>('workout_templates')
            .query(Q.where('id', Q.oneOf(templateIds)), Q.where('deleted_at', Q.eq(null)))
            .fetch()
        : [];
    const templatesById = new Map(templates.map((template) => [template.id, template]));
    const completedToday = await this.getTemplateIdsCompletedToday();

    const planned = planWorkoutReminders({
      now: new Date(),
      sources: resolvedSchedules.filter((schedule) => {
        const template = templatesById.get(schedule.templateId);
        return template && !template.deletedAt && !template.isArchived;
      }),
      prefs,
      completedTemplateIdsToday: completedToday,
    });

    await Promise.all(
      planned.flatMap((reminder) => {
        const template = templatesById.get(reminder.templateId);
        if (!template) {
          return [];
        }

        return Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.types.workoutReminderMorning.title'),
            body: i18n.t('notifications.types.workoutReminderMorning.body', {
              workoutName: template.name,
            }),
            categoryIdentifier: NOTIFICATION_CATEGORIES.workoutReminder,
            data: {
              type: 'workout-reminder',
              templateId: template.id,
              planId: reminder.planId,
            },
            ...Platform.select({
              android: { channelId: NOTIFICATION_CHANNELS.workoutReminders },
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.date,
          },
        });
      })
    );
  }

  /** Templates whose workout was already finished today — their reminder for today is moot. */
  private static async getTemplateIdsCompletedToday(): Promise<Set<string>> {
    try {
      const start = localDayStartMs(new Date());
      const logs = await database
        .get<WorkoutLog>('workout_logs')
        .query(Q.where('completed_at', Q.gte(start)), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      return new Set(
        logs.map((log) => log.templateId).filter((id): id is string => typeof id === 'string')
      );
    } catch {
      return new Set();
    }
  }

  // Rest Timer Alert
  static async scheduleRestTimerNotification(restSeconds: number, workoutLogId?: string | null) {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsRestTimer();
    const isNotificationsEnabled = await SettingsService.getNotifications();
    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Cancel any pre-existing rest timer notification before scheduling a new one
    await this.cancelRestTimerNotification();

    const content = {
      title: i18n.t('notifications.types.restTimerAlert.title'),
      body: i18n.t('notifications.types.restTimerAlert.body'),
      categoryIdentifier: NOTIFICATION_CATEGORIES.restTimer,
      data: { type: 'rest-timer-alert', workoutLogId: workoutLogId ?? undefined },
      ...Platform.select({
        android: { channelId: NOTIFICATION_CHANNELS.restTimer },
        ios: { interruptionLevel: 'timeSensitive' as const },
      }),
    };

    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_ID,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: restSeconds,
      },
    });

    // A second, shorter-lived nudge for the person who put the phone down across the room. It is
    // cancelled with the first one the moment the rest is skipped or the next rest starts.
    const prefs = await loadNotificationPreferences();
    if (prefs.restTimerRepeat) {
      await Notifications.scheduleNotificationAsync({
        identifier: REST_TIMER_REPEAT_NOTIFICATION_ID,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: restSeconds + REST_REPEAT_DELAY_SECONDS,
        },
      });
    }
  }

  static async cancelRestTimerNotification() {
    if (Platform.OS === 'web') {
      return;
    }

    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIFICATION_ID).catch(() => {}),
      Notifications.cancelScheduledNotificationAsync(REST_TIMER_REPEAT_NOTIFICATION_ID).catch(
        () => {}
      ),
    ]);
  }

  /** The "+30s" button on the rest alert: rest a little longer, without opening the app. */
  static async extendRestFromNotification(workoutLogId?: string | null) {
    await this.scheduleRestTimerNotification(REST_ADD_SECONDS, workoutLogId);
    if (workoutLogId) {
      const { setRestTimerEndAt } = await import('@/utils/activeWorkoutStorage');
      await setRestTimerEndAt(workoutLogId, Date.now() + REST_ADD_SECONDS * 1000);
    }
  }

  /** The "Snooze" button on a workout reminder: the same reminder again in an hour. */
  static async snoozeReminder(content: Notifications.NotificationContent) {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title ?? '',
        body: content.body ?? '',
        data: content.data,
        categoryIdentifier: NOTIFICATION_CATEGORIES.workoutReminder,
        ...Platform.select({
          android: { channelId: NOTIFICATION_CHANNELS.workoutReminders },
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: SNOOZE_MINUTES * 60,
      },
    });
  }

  // Unfinished workout: "did you forget to finish and log it?" after the last saved set.
  static async scheduleUnfinishedWorkoutReminder(workoutName: string) {
    if (Platform.OS === 'web') {
      return;
    }

    const [isNotificationsEnabled, prefs] = await Promise.all([
      SettingsService.getNotifications(),
      loadNotificationPreferences(),
    ]);
    await this.cancelUnfinishedWorkoutReminder();
    if (!isNotificationsEnabled || !prefs.unfinishedWorkout) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: UNFINISHED_WORKOUT_NOTIFICATION_ID,
      content: {
        title: i18n.t('notifications.types.unfinishedWorkout.title'),
        body: i18n.t('notifications.types.unfinishedWorkout.body', { workoutName }),
        data: { type: 'unfinished-workout' },
        ...Platform.select({
          android: { channelId: NOTIFICATION_CHANNELS.workoutReminders },
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: UNFINISHED_WORKOUT_DELAY_MINUTES * 60,
      },
    });
  }

  static async cancelUnfinishedWorkoutReminder() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelScheduledNotificationAsync(UNFINISHED_WORKOUT_NOTIFICATION_ID).catch(
      () => {}
    );
  }

  // Weekly goal at risk — only when the user has a consistency goal and chose to be nudged.
  static async scheduleGoalAtRiskReminder() {
    if (Platform.OS === 'web') {
      return;
    }

    await cancelScheduledByType(GOAL_AT_RISK_NOTIFICATION_TYPE);

    const [isNotificationsEnabled, prefs] = await Promise.all([
      SettingsService.getNotifications(),
      loadNotificationPreferences(),
    ]);
    if (!isNotificationsEnabled || !prefs.goalAtRisk || prefs.accountability === 'flexible') {
      return;
    }

    const now = new Date();
    const week = calendarWeekBounds(now);
    const [{ ExerciseGoalService }, { WorkoutService }] = await Promise.all([
      import('@/database/services/ExerciseGoalService'),
      import('@/database/services/WorkoutService'),
    ]);
    const goal = await ExerciseGoalService.getActiveConsistencyGoal();
    const done = await WorkoutService.getCompletedWorkoutCount({
      startDate: week.start.getTime(),
      endDate: now.getTime(),
    });
    const remaining = goalAtRiskRemaining({
      goalPerWeek: goal?.targetSessionsPerWeek ?? null,
      doneThisWeek: done,
      daysLeft: week.daysLeft,
    });
    const date = remaining === null ? null : goalAtRiskFireDate(now, week.end);
    if (remaining === null || !date || isSuppressed(date, prefs)) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.types.goalAtRisk.title'),
        body: i18n.t('notifications.types.goalAtRisk.body', { count: remaining }),
        data: { type: GOAL_AT_RISK_NOTIFICATION_TYPE },
        ...Platform.select({
          android: { channelId: NOTIFICATION_CHANNELS.workoutReminders },
        }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }

  /** What the settings screen shows so "permission granted" is never mistaken for "will arrive". */
  static async getDeliveryStatus(): Promise<{
    permission: Notifications.PermissionStatus | 'unsupported';
    pending: number;
  }> {
    if (Platform.OS === 'web') {
      return { permission: 'unsupported', pending: 0 };
    }

    const [permissions, scheduled] = await Promise.all([
      Notifications.getPermissionsAsync() as Promise<{ status: Notifications.PermissionStatus }>,
      Notifications.getAllScheduledNotificationsAsync(),
    ]);

    return { permission: permissions.status, pending: scheduled.length };
  }

  // Workout Duration Warning
  static async scheduleWorkoutDurationWarning(startedAt: number) {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsWorkoutDuration();
    const isNotificationsEnabled = await SettingsService.getNotifications();
    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Cancel any pre-existing duration warning before scheduling
    await Notifications.cancelScheduledNotificationAsync('workout-duration-warning').catch(
      () => {}
    );

    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const secondsUntilFire = Math.floor((startedAt + FIVE_HOURS_MS - Date.now()) / 1000);

    // If 5 hours have already passed, do not schedule
    if (secondsUntilFire <= 0) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: 'workout-duration-warning',
      content: {
        title: i18n.t('notifications.types.workoutDurationWarning.title'),
        body: i18n.t('notifications.types.workoutDurationWarning.body'),
        data: { type: 'workout-duration-warning' },
        ...Platform.select({
          android: { channelId: NOTIFICATION_CHANNELS.default },
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilFire,
      },
    });
  }

  static async cancelWorkoutDurationWarning() {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelScheduledNotificationAsync('workout-duration-warning').catch(
      () => {}
    );
  }

  static async testRestTimerNotification(delaySeconds = 5) {
    if (Platform.OS === 'web') {
      console.log('[Test Rest Timer Notification]');
      return null;
    }

    await this.configure();
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissions not granted for test notification');
      return null;
    }

    await this.cancelRestTimerNotification();

    return await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIFICATION_ID,
      content: {
        categoryIdentifier: NOTIFICATION_CATEGORIES.restTimer,
        title: i18n.t('notifications.types.restTimerAlert.title'),
        body: i18n.t('notifications.types.restTimerAlert.body'),
        data: { type: 'rest-timer-alert' },
        ...Platform.select({ android: { channelId: NOTIFICATION_CHANNELS.restTimer } }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });
  }

  static async testWorkoutDurationWarning(delaySeconds = 5) {
    if (Platform.OS === 'web') {
      console.log('[Test Workout Duration Warning]');
      return null;
    }

    await this.configure();
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[NotificationService] Permissions not granted for test notification');
      return null;
    }

    await Notifications.cancelScheduledNotificationAsync('workout-duration-warning').catch(
      () => {}
    );

    return await Notifications.scheduleNotificationAsync({
      identifier: 'workout-duration-warning',
      content: {
        title: i18n.t('notifications.types.workoutDurationWarning.title'),
        body: i18n.t('notifications.types.workoutDurationWarning.body'),
        data: { type: 'workout-duration-warning' },
        ...Platform.select({ android: { channelId: 'default' } }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });
  }
}
