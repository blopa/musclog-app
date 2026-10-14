import * as Notifications from 'expo-notifications';

import { SettingsService } from '@/database/services/SettingsService';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/utils/notificationPolicy';

type ScheduledNotification = Notifications.NotificationRequest;

/**
 * Cancels the scheduled notifications that match, in parallel. Pass `scheduled` when the caller
 * already read the list, so one planning pass does not read it twice.
 */
export async function cancelScheduledWhere(
  matches: (notification: ScheduledNotification) => boolean,
  scheduled?: ScheduledNotification[]
): Promise<void> {
  const all = scheduled ?? (await Notifications.getAllScheduledNotificationsAsync());
  await Promise.all(
    all
      .filter(matches)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
  );
}

/** Cancels every scheduled notification whose `data.type` is `type`. */
export const cancelScheduledByType = (type: string, scheduled?: ScheduledNotification[]) =>
  cancelScheduledWhere((notification) => notification.content.data?.type === type, scheduled);

/** Preferences failing to load must never stop a reminder, so this falls back to the defaults. */
export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    return await SettingsService.getNotificationPreferences();
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}
