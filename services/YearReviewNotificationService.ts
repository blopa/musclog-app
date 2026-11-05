import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { YEAR_REVIEW_NOTIFICATION_TYPE } from '@/constants/notificationActions';
import { SETTINGS } from '@/constants/settingDefinitions';
import { YearInReviewRepository } from '@/database/repositories/YearInReviewRepository';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import {
  cancelScheduledByType,
  loadNotificationPreferences,
} from '@/services/notificationScheduling';
import { planYearReviewNotification } from '@/utils/yearInReview/yearReviewNotification';

/** Stable per year, so a re-plan replaces the notice rather than stacking a second one. */
export const yearReviewNotificationIdentifier = (year: number) => `year-review-${year}`;

export class YearReviewNotificationService {
  /**
   * Plans the one year-end notice. Everything the planner decides on is read here, and the pure
   * planner decides whether and when. Cancelled and re-planned on every pass.
   */
  static async scheduleYearReview({ backOff }: { backOff: boolean }): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await cancelScheduledByType(YEAR_REVIEW_NOTIFICATION_TYPE);
    if (!(await SettingsService.getNotifications())) {
      return;
    }

    const now = new Date();
    const planned = planYearReviewNotification(now, await loadNotificationPreferences(), {
      dismissedYear: await SettingsService.get(SETTINGS.yearReviewDismissedYear),
      hasSessions: await YearInReviewRepository.hasCompletedSession(now.getFullYear()),
      backOff,
    });
    if (!planned) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: yearReviewNotificationIdentifier(planned.year),
      content: {
        title: i18n.t('yearInReview.notification.title', { year: planned.year }),
        body: i18n.t('yearInReview.notification.body'),
        data: { type: YEAR_REVIEW_NOTIFICATION_TYPE, year: planned.year },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: planned.date },
    });
  }
}
