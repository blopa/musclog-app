import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { database } from '../database';
import MenstrualCycle from '../database/models/MenstrualCycle';
import Schedule from '../database/models/Schedule';
import { SettingsService } from '../database/services/SettingsService';
import i18n from '../lang/lang';

export class NotificationService {
  private static isConfigured = false;

  static async configure() {
    if (this.isConfigured || Platform.OS === 'web') {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isWorkoutUpdate = notification.request.identifier === 'active-workout-notification';
        return {
          shouldShowAlert: !isWorkoutUpdate,
          shouldPlaySound: !isWorkoutUpdate,
          shouldSetBadge: false,
          shouldShowBanner: !isWorkoutUpdate,
          shouldShowList: true,
        };
      },
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: i18n.t('notifications.channels.default'),
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      await Notifications.setNotificationChannelAsync('workout-active', {
        name: i18n.t('notifications.channels.activeWorkout'),
        importance: Notifications.AndroidImportance.LOW, // Low importance for persistent notification to avoid annoying sound/popup on every update
        lockscreenVisibility: (Notifications as any).AndroidVisibility?.PUBLIC,
      });
    }

    this.isConfigured = true;
  }

  static async requestPermissions() {
    if (Platform.OS === 'web') {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  static async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data: Record<string, any> = {},
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
    currentExercise?: string
  ) {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsActiveWorkout();
    const isNotificationsEnabled = await SettingsService.getNotifications();
    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    const title = i18n.t('notifications.types.activeWorkout.title', { workoutName });
    const body = currentExercise
      ? i18n.t('notifications.types.activeWorkout.body', { totalTime, currentExercise })
      : i18n.t('notifications.types.activeWorkout.bodyNoExercise', { totalTime });

    // On Android, we use a fixed ID for the active workout notification to update it
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
    data: Record<string, any> = {},
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
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'workout-reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Fetch all active schedules
    const schedules = await database
      .get<Schedule>('schedules')
      .query(Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // TODO: do we need to translate these?
    const expoDayMap: Record<string, number> = {
      Sunday: 1,
      Monday: 2,
      Tuesday: 3,
      Wednesday: 4,
      Thursday: 5,
      Friday: 6,
      Saturday: 7,
    };

    for (const schedule of schedules) {
      const template = await schedule.template;
      if (!template || template.deletedAt || template.isArchived) {
        continue;
      }

      const [hours, minutes] = (schedule.reminderTime || '08:00').split(':').map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.types.workoutReminderMorning.title'),
          body: i18n.t('notifications.types.workoutReminderMorning.body', {
            workoutName: template.name,
          }),
          data: { type: 'workout-reminder', templateId: template.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoDayMap[schedule.dayOfWeek],
          hour: hours,
          minute: minutes,
        },
      });
    }
  }

  // Nutrition Overview
  static async scheduleNutritionOverview() {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsNutritionOverview();
    const isNotificationsEnabled = await SettingsService.getNotifications();

    // Clear existing
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'nutrition-overview') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Schedule for 9 PM every day
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('notifications.types.nutritionOverview.title'),
        body: i18n.t('notifications.types.nutritionOverview.body'),
        data: { type: 'nutrition-overview' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });
  }

  // This can be called when the notification is received or opened, or we can pre-calculate it if we want it in the body.
  // Since we want it in the body, we'd need a background task to update it daily or just schedule it with a generic message.
  // For "offline/internal" without complex background sync, a daily reminder at 9pm is good.

  // Menstrual Cycle Notifications
  static async scheduleMenstrualCycleNotifications() {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsMenstrualCycle();
    const isNotificationsEnabled = await SettingsService.getNotifications();

    // Clear existing
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'menstrual-cycle') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    // Fetch active cycle
    const cycles = await database
      .get<MenstrualCycle>('menstrual_cycles')
      .query(Q.where('is_active', true), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const cycle = cycles[0];
    if (!cycle) {
      return;
    }

    // Schedule next period prediction (2 days before)
    const nextPeriodDate = cycle.getNextPeriodDate();
    const notificationDate = new Date(nextPeriodDate.getTime() - 2 * 24 * 60 * 60 * 1000);
    notificationDate.setHours(9, 0, 0, 0);

    if (notificationDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.types.periodPrediction.title'),
          body: i18n.t('notifications.types.periodPrediction.body'),
          data: { type: 'menstrual-cycle', subtype: 'period-start' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationDate,
        },
      });
    }

    // Schedule fertile window start
    const fertileWindow = cycle.getFertileWindow();
    const fertileStartNotification = new Date(fertileWindow.start.getTime());
    fertileStartNotification.setHours(9, 0, 0, 0);

    if (fertileStartNotification.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.types.fertileWindow.title'),
          body: i18n.t('notifications.types.fertileWindow.body'),
          data: { type: 'menstrual-cycle', subtype: 'fertile-window' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fertileStartNotification,
        },
      });
    }
  }
}
