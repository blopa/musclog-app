import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { COMEBACK_WELCOME_NOTIFICATION_TYPE } from '@/constants/notificationActions';
import { SettingsService } from '@/database/services/SettingsService';
import i18n from '@/lang/lang';
import {
  cancelScheduledByType,
  loadNotificationPreferences,
} from '@/services/notificationScheduling';
import {
  type ComebackReminderContext,
  planWelcomeBackNudge,
} from '@/utils/comeback/comebackNotifications';

/** Stable, so a re-plan replaces the nudge instead of stacking a second one. */
const WELCOME_NOTIFICATION_ID = 'comeback-welcome-notification';

export class ComebackNotificationService {
  /**
   * The single "welcome back" nudge per gap. Everything it needs arrives as `context` (read once by
   * `refreshAllNotifications`), so this planner reads neither the comeback state nor the activity.
   */
  static async scheduleWelcomeBack(context: ComebackReminderContext): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await cancelScheduledByType(COMEBACK_WELCOME_NOTIFICATION_TYPE);
    if (!(await SettingsService.getNotifications())) {
      return;
    }

    const date = planWelcomeBackNudge(context, await loadNotificationPreferences());
    if (!date) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: WELCOME_NOTIFICATION_ID,
      content: {
        title: i18n.t('notifications.types.comebackWelcome.title'),
        body: i18n.t('notifications.types.comebackWelcome.body'),
        data: { type: COMEBACK_WELCOME_NOTIFICATION_TYPE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}
