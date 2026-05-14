import type { EventSubscription, NotificationResponse } from 'expo-notifications';

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
