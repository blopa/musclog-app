import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { SETTINGS } from '@/constants/settingDefinitions';
import { database } from '@/database';
import NutritionCheckin from '@/database/models/NutritionCheckin';
import type WeeklyReview from '@/database/models/WeeklyReview';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import {
  cancelScheduledByType,
  cancelScheduledWhere,
  loadNotificationPreferences,
} from '@/services/notificationScheduling';
import { localDayKeyPlusCalendarDaysFromNow, localDayStartMs } from '@/utils/calendarDate';
import { isSuppressed, planNutritionOverview } from '@/utils/notificationPolicy';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';

/** Offline nutrition reminders: the evening overview, check-ins and the weekly review. */
export class NutritionNotificationService {
  static async scheduleNutritionOverview(options: { backOff?: boolean } = {}) {
    if (Platform.OS === 'web') {
      return;
    }

    const isEnabled = await SettingsService.getNotificationsNutritionOverview();
    const isNotificationsEnabled = await SettingsService.getNotifications();

    // Clear existing
    await cancelScheduledByType('nutrition-overview');

    if (!isEnabled || !isNotificationsEnabled || options.backOff) {
      return;
    }

    // One-offs for the coming week rather than a repeating trigger, so a pause or quiet hours can drop
    // individual evenings. They are re-planned on boot and every foreground.
    const prefs = await loadNotificationPreferences();
    await Promise.all(
      planNutritionOverview(new Date(), prefs).map((date) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('notifications.types.nutritionOverview.title'),
            body: i18n.t('notifications.types.nutritionOverview.body'),
            data: { type: 'nutrition-overview' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        })
      )
    );
  }

  static async scheduleCheckinNotifications() {
    if (Platform.OS === 'web') {
      return;
    }

    const isNotificationsEnabled = await SettingsService.getNotifications();

    await NutritionNotificationService.scheduleWeeklyReviewNotification();

    // Clear existing check-in notifications
    await cancelScheduledByType('nutrition-checkin');

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

    const prefs = await loadNotificationPreferences();
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
      SettingsService.get(SETTINGS.notificationsWeeklyReview),
      SettingsService.get(SETTINGS.reviewWeekday),
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
    const blocked = !enabled || !allowed || isSuppressed(date, await loadNotificationPreferences());
    await cancelScheduledWhere(
      (notification) =>
        notification.content.data?.type === 'weekly-review' &&
        (blocked || notification.identifier !== identifier),
      scheduled
    );

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
}
