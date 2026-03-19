import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

export function addNotificationResponseReceivedListener(
  listener: (event: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function getLastNotificationResponseAsync() {
  return Notifications.getLastNotificationResponseAsync();
}

/**
 * Handles notification clicks/interactions for the entire app.
 */
export async function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data;
  const { type } = data;

  if (!type) {
    return;
  }

  switch (type) {
    case 'workout-reminder':
      if (data.templateId) {
        router.push(`/workouts/start?templateId=${data.templateId}`);
      } else {
        router.push('/workouts');
      }
      break;

    case 'nutrition-overview':
      router.push('/food');
      break;

    case 'nutrition-checkin':
      router.push('/nutrition/checkin');
      break;

    case 'active-workout':
      // Notification persists while workout is active, tapping it should return to the session
      router.push('/workouts/session');
      break;

    case 'rest-timer-alert':
      router.push('/workouts/session');
      break;

    case 'menstrual-cycle':
      router.push('/cycle');
      break;

    default:
      console.log('Unhandled notification type:', type);
  }
}

/**
 * Configures global notification behavior for the platform.
 */
export function setupNotificationConfig() {
  if (Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Don't show an alert for persistent active-workout updates, as it would be noisy
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
}

/**
 * Schedules a local notification.
 */
export async function scheduleLocalNotification({
  title,
  body,
  date,
  data,
}: {
  title: string;
  body: string;
  date: Date;
  data?: any;
}) {
  if (Platform.OS === 'web') {
    return;
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') {
      return;
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: {
      date,
    },
  });
}
