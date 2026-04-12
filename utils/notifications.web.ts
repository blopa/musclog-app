import { EventSubscription } from 'expo-notifications';
import type { NotificationResponse } from 'expo-notifications/src/Notifications.types';

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
  return Promise.resolve(null);
}

export function addNotificationResponseReceivedListener(
  listener: (event: NotificationResponse) => void
): EventSubscription {
  return {
    remove: () => {},
  } as EventSubscription;
}

export const handleNotificationResponse = async (response: NotificationResponse) => {
  return;
};
