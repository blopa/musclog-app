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

  if (!data) {
    return;
  }

  const type = data['type'] as string | undefined;

  if (!type) {
    return;
  }

  switch (type) {
    case 'workout-reminder':
      if (data['templateId']) {
        router.navigate(`/app/workout/workouts?templateId=${data['templateId']}`);
      } else {
        router.navigate('/app/workout/workouts');
      }
      break;

    case 'nutrition-overview':
      router.navigate('/app/nutrition/food');
      break;

    case 'nutrition-checkin':
      router.navigate('/app/nutrition/checkin-list');
      break;

    case 'active-workout':
      // Notification persists while workout is active, tapping it should return to the session
      router.navigate('/app/workout/workout-session');
      break;

    case 'rest-timer-alert':
      router.navigate('/app/workout/workout-session');
      break;

    case 'menstrual-cycle':
      router.navigate('/app/cycle');
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
