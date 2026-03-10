import type { EventSubscription } from 'expo-modules-core';
import * as Notifications from 'expo-notifications';
import { NotificationResponse } from 'expo-notifications/src/Notifications.types';
import { router } from 'expo-router';

import { getActiveWorkoutLogId } from './activeWorkoutStorage';

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
}

export function addNotificationResponseReceivedListener(
  listener: (event: NotificationResponse) => void
): EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export const handleNotificationResponse = async (response: Notifications.NotificationResponse) => {
  const { identifier, content } = response.notification.request;
  const data = content.data as Record<string, any>;

  if (identifier === 'active-workout-notification' || data?.type === 'active-workout') {
    const workoutLogId = data?.workoutLogId || (await getActiveWorkoutLogId());
    if (workoutLogId) {
      router.push(`/workout/workout-session?workoutLogId=${workoutLogId}`);
    }

    return;
  }

  switch (data?.type) {
    case 'workout-reminder':
      router.push('/workout/workouts');
      break;
    case 'nutrition-overview':
      router.push('/nutrition/food');
      break;
    case 'menstrual-cycle':
      router.push('/cycle');
      break;
  }
};
