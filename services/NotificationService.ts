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
import type { CycleNotificationStyle } from '@/constants/settings';
import { database } from '@/database';
import NutritionCheckin from '@/database/models/NutritionCheckin';
import type WeeklyReview from '@/database/models/WeeklyReview';
import type WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import { getCycleBackupPreparedAt } from '@/services/cycleRecovery';
import { darkTheme } from '@/theme';
import { localDayKeyPlusCalendarDaysFromNow, localDayStartMs } from '@/utils/calendarDate';
import { cycleReminderContent } from '@/utils/cycle/cycleReminderCopy';
import { planCycleReminders } from '@/utils/cycle/cycleReminders';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';
import {
  calendarWeekBounds,
  DEFAULT_NOTIFICATION_PREFERENCES,
  goalAtRiskFireDate,
  goalAtRiskRemaining,
  isSuppressed,
  type NotificationPreferences,
  planNutritionOverview,
  planWorkoutReminders,
  REST_ADD_SECONDS,
  REST_REPEAT_DELAY_SECONDS,
  SNOOZE_MINUTES,
  UNFINISHED_WORKOUT_DELAY_MINUTES,
} from '@/utils/notificationPolicy';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';

const CYCLE_CHANNEL_ID = 'cycle';

export interface CycleDeliveryStatus {
  permission: Notifications.PermissionStatus | 'unsupported';
  appEnabled: boolean;
  cycleEnabled: boolean;
}

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

  /** Preferences failing to load must never stop a reminder, so this falls back to the defaults. */
  private static async loadPreferences(): Promise<NotificationPreferences> {
    try {
      return await SettingsService.getNotificationPreferences();
    } catch {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
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
      await Notifications.setNotificationChannelAsync(CYCLE_CHANNEL_ID, {
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
    const { lockScreenDetail } = await this.loadPreferences();
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
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'workout-reminder') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    const prefs = await this.loadPreferences();
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

    for (const reminder of planned) {
      const template = templatesById.get(reminder.templateId);
      if (!template) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
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
    }
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

  /** Re-plans every offline reminder. Cheap and idempotent: boot, foreground and workout end all call it. */
  static async refreshAll() {
    if (Platform.OS === 'web') {
      return;
    }

    await this.scheduleWorkoutReminders();
    await this.scheduleNutritionOverview();
    await this.scheduleGoalAtRiskReminder();
    await this.scheduleMenstrualCycleNotifications();
    await this.scheduleCheckinNotifications();
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

    // One-offs for the coming week rather than a repeating trigger, so a pause or quiet hours can drop
    // individual evenings. They are re-planned on boot and every foreground.
    const prefs = await this.loadPreferences();
    for (const date of planNutritionOverview(new Date(), prefs)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('notifications.types.nutritionOverview.title'),
          body: i18n.t('notifications.types.nutritionOverview.body'),
          data: { type: 'nutrition-overview' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    }
  }

  // Nutrition Check-ins
  static async scheduleCheckinNotifications() {
    if (Platform.OS === 'web') {
      return;
    }

    const isNotificationsEnabled = await SettingsService.getNotifications();

    await this.scheduleWeeklyReviewNotification();

    // Clear existing check-in notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'nutrition-checkin') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (!isNotificationsEnabled) {
      return;
    }

    // Fetch pending check-ins for the next 30 calendar days.
    // checkin_date stores local-midnight ms, so both bounds must be calendar-day keys.
    const todayDayStart = localDayStartMs(new Date());
    const thirtyDaysFromNow = localDayKeyPlusCalendarDaysFromNow(30);

    const checkins = await database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(
        Q.or(Q.where('status', Q.eq('pending')), Q.where('status', Q.eq(null))),
        Q.where('checkin_date', Q.between(todayDayStart, thirtyDaysFromNow)),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    const currentGoal = await NutritionGoalService.getCurrent();
    if (currentGoal?.targetMode === 'weekly') {
      return;
    }

    const prefs = await this.loadPreferences();
    for (const checkin of checkins) {
      if (currentGoal && checkin.nutritionGoalId !== currentGoal.id) {
        continue;
      }

      const date = new Date(checkin.checkinDate);
      // Set to 8 AM local time on the check-in day
      date.setHours(8, 0, 0, 0);

      if (date.getTime() <= Date.now() || isSuppressed(date, prefs)) {
        continue;
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.types.nutritionCheckin.title'),
            body: i18n.t('notifications.types.nutritionCheckin.body'),
            data: { type: 'nutrition-checkin', checkinId: checkin.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
          },
        });
      }
    }
  }

  static async scheduleWeeklyReviewNotification(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    const [enabled, allowed, weekday, scheduled, goal, intuitive] = await Promise.all([
      SettingsService.getNotifications(),
      SettingsService.getNotificationsWeeklyReview(),
      SettingsService.getReviewWeekday(),
      Notifications.getAllScheduledNotificationsAsync(),
      NutritionGoalService.getCurrent(),
      SettingsService.getIntuitiveEatingMode(),
    ]);
    const period = weeklyReviewPeriod(new Date(), weekday);
    const reviews = await database
      .get<WeeklyReview>('weekly_reviews')
      .query(Q.where('period_end', period.end), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const reviewed = reviews.some(
      (row) =>
        (row.nutritionGoalId ?? null) === (goal?.id ?? null) &&
        row.trainingReviewedAt &&
        (!goal || intuitive || row.nutritionReviewedAt)
    );
    let date = new Date(reviewed ? period.next : period.end);
    date.setHours(8, 0, 0, 0);
    if (date.getTime() <= Date.now()) {
      date = new Date(period.next);
      date.setHours(8, 0, 0, 0);
    }

    const identifier = `weekly-review-${localDayStartMs(date)}`;
    const blocked = !enabled || !allowed || isSuppressed(date, await this.loadPreferences());
    for (const notification of scheduled) {
      if (
        notification.content.data?.type === 'weekly-review' &&
        (blocked || notification.identifier !== identifier)
      ) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    if (blocked || scheduled.some((notification) => notification.identifier === identifier)) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: i18n.t('weeklyReview.title'),
        body: i18n.t('weeklyReview.reminderBody'),
        data: { type: 'weekly-review', reviewDay: localDayStartMs(date) },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }

  // Menstrual Cycle Notifications
  private static cycleReminderQueue: Promise<void> = Promise.resolve();

  /** Serialised: every cycle write and app foreground reschedules, and two passes must not interleave. */
  static scheduleMenstrualCycleNotifications(): Promise<void> {
    const next = NotificationService.cycleReminderQueue
      .catch(() => undefined)
      .then(() => NotificationService.scheduleMenstrualCycleNotificationsNow());
    NotificationService.cycleReminderQueue = next;
    return next;
  }

  /**
   * Everything the cycle reminder settings need to say whether a reminder can actually reach the
   * person: the OS permission, the app-wide switch and the cycle switch. Read, never requested.
   */
  static async getCycleDeliveryStatus(): Promise<CycleDeliveryStatus> {
    const [appEnabled, cycleEnabled] = await Promise.all([
      SettingsService.getNotifications(),
      SettingsService.getNotificationsMenstrualCycle(),
    ]);
    if (Platform.OS === 'web') {
      return { permission: 'unsupported', appEnabled, cycleEnabled };
    }

    const { status } = (await Notifications.getPermissionsAsync()) as {
      status: Notifications.PermissionStatus;
    };

    return { permission: status, appEnabled, cycleEnabled };
  }

  /**
   * Asked in context: only when the person turns cycle reminders on, after seeing what they will
   * look like, never at launch. Switches both settings on and reschedules on success.
   */
  static async enableCycleReminders(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    await this.configure();
    const granted = await this.requestPermissions();
    if (!granted) {
      return false;
    }

    await SettingsService.setNotifications(true);
    await SettingsService.setNotificationsMenstrualCycle(true);
    await NotificationService.scheduleMenstrualCycleNotifications();
    return true;
  }

  /** Sends, in a few seconds, exactly what a daily check-in would look like in the chosen style. */
  static async sendCycleTestNotification(style: CycleNotificationStyle): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    await this.configure();
    if (!(await this.requestPermissions())) {
      return false;
    }

    const content = cycleReminderContent(
      { kind: 'daily-log' },
      style,
      i18n.t.bind(i18n),
      i18n.resolvedLanguage ?? i18n.language
    );
    await Notifications.scheduleNotificationAsync({
      content: { ...content, data: { type: 'menstrual-cycle', subtype: 'test' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        channelId: CYCLE_CHANNEL_ID,
      },
    });
    return true;
  }

  private static async scheduleMenstrualCycleNotificationsNow() {
    if (Platform.OS === 'web') {
      return;
    }

    const [isEnabled, isNotificationsEnabled] = await Promise.all([
      SettingsService.getNotificationsMenstrualCycle(),
      SettingsService.getNotifications(),
    ]);

    // Clear existing: a context change (pregnancy, a loss, a hormonal method) or a pause takes
    // effect by not planning the incompatible reminders again.
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduledNotifications
        .filter((notification) => notification.content.data?.type === 'menstrual-cycle')
        .map((notification) =>
          Notifications.cancelScheduledNotificationAsync(notification.identifier)
        )
    );

    if (!isEnabled || !isNotificationsEnabled) {
      return;
    }

    const cycle = (await CycleRepository.cycles().fetch()).find((c) => c.isActive);
    if (!cycle) {
      return;
    }

    const [periods, contexts, config, showPredictions, showFertility, style, lastBackup] =
      await Promise.all([
        CycleRepository.periods(cycle.id).fetch().then(readPeriods),
        CycleRepository.contexts(cycle.id).fetch().then(readContexts),
        readCycleConfig(cycle),
        SettingsService.getCycleShowPredictions(),
        SettingsService.getCycleShowFertility(),
        SettingsService.getCycleNotificationStyle(),
        getCycleBackupPreparedAt(),
      ]);
    const nowMs = Date.now();
    const { timeline, activePeriod } = buildCycleSnapshot({
      periods,
      contexts,
      config,
      nowMs,
      showPredictions,
      showFertility,
    });
    const locale = i18n.resolvedLanguage ?? i18n.language;

    for (const reminder of planCycleReminders(timeline, nowMs, {
      preferences: config.reminders,
      activePeriod,
      backupDays: config.backupReminderDays,
      lastBackup,
    })) {
      await Notifications.scheduleNotificationAsync({
        content: {
          ...cycleReminderContent(reminder, style, i18n.t.bind(i18n), locale),
          data: { type: 'menstrual-cycle', subtype: reminder.kind },
        },
        trigger: reminder.repeatsDaily
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: reminder.date.getHours(),
              minute: reminder.date.getMinutes(),
              channelId: CYCLE_CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.date,
              channelId: CYCLE_CHANNEL_ID,
            },
      });
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
    const prefs = await this.loadPreferences();
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
      this.loadPreferences(),
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

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.type === GOAL_AT_RISK_NOTIFICATION_TYPE) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    const [isNotificationsEnabled, prefs] = await Promise.all([
      SettingsService.getNotifications(),
      this.loadPreferences(),
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
