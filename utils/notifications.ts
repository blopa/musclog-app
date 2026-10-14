import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import {
  GOAL_AT_RISK_NOTIFICATION_TYPE,
  NOTIFICATION_ACTIONS,
} from '@/constants/notificationActions';
import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';
import { NotificationService } from '@/services/NotificationService';
import { isCycleReminderKind } from '@/utils/cycle/cycleReminders';

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

  // Buttons under the notification act without opening the app (except "next set", which does).
  if (response.actionIdentifier === NOTIFICATION_ACTIONS.restAddTime) {
    const logId = data['workoutLogId'];
    await NotificationService.extendRestFromNotification(typeof logId === 'string' ? logId : null);
    return;
  }

  if (response.actionIdentifier === NOTIFICATION_ACTIONS.reminderSnooze) {
    await NotificationService.snoozeReminder(response.notification.request.content);
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
      router.navigate(
        data['checkinId']
          ? `${WEEKLY_REVIEW_ROUTE}?checkinId=${encodeURIComponent(String(data['checkinId']))}`
          : WEEKLY_REVIEW_ROUTE
      );
      break;

    case 'weekly-review': {
      const reviewId = data['reviewId'];
      const reviewDay = data['reviewDay'];
      if (reviewId) {
        router.navigate(`${WEEKLY_REVIEW_ROUTE}?reviewId=${encodeURIComponent(String(reviewId))}`);
      } else if (reviewDay) {
        router.navigate(
          `${WEEKLY_REVIEW_ROUTE}?reviewDay=${encodeURIComponent(String(reviewDay))}`
        );
      } else {
        router.navigate(WEEKLY_REVIEW_ROUTE);
      }

      break;
    }

    case 'active-workout':
      // Notification persists while workout is active, tapping it should return to the session
      router.navigate('/app/workout/workout-session');
      break;

    case 'rest-timer-alert':
    case 'unfinished-workout':
      router.navigate('/app/workout/workout-session');
      break;

    case GOAL_AT_RISK_NOTIFICATION_TYPE:
      router.navigate('/app/workout/workouts');
      break;

    case 'menstrual-cycle': {
      // The cycle screen explains which setting sent this and what it was based on.
      const kind = data['subtype'];
      router.navigate(
        typeof kind === 'string' && isCycleReminderKind(kind)
          ? `/app/cycle?reminder=${encodeURIComponent(kind)}`
          : '/app/cycle'
      );
      break;
    }

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
