import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../lang/lang';

export class NotificationService {
  static async requestPermissions() {
    if (Platform.OS === 'web') return false;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  static async scheduleLocalNotification(title: string, body: string, data: any = {}, trigger: any = null) {
    if (Platform.OS === 'web') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger,
    });
  }

  static async scheduleNutritionCheckin(checkinId: string, date: number) {
    const triggerDate = new Date(date);
    triggerDate.setHours(8, 0, 0, 0);

    if (triggerDate.getTime() < Date.now()) return;

    await this.scheduleLocalNotification(
      i18n.t('notifications.nutritionCheckin.title'),
      i18n.t('notifications.nutritionCheckin.body'),
      { action: 'open-nutrition-checkin', id: checkinId },
      triggerDate
    );
  }

  static async cancelAllNotifications() {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async dismissActiveWorkoutNotification() {
    if (Platform.OS === 'web') return;
    // Implementation for dismissing active workout notification
  }
}
