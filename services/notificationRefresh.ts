import { Platform } from 'react-native';

import { CycleNotificationService } from '@/services/CycleNotificationService';
import { NotificationService } from '@/services/NotificationService';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';

/**
 * Re-plans every offline reminder. Cheap and idempotent: boot, foreground and workout end all call
 * it. The planners touch disjoint notification types, so they run side by side.
 */
export async function refreshAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await Promise.all([
    NotificationService.scheduleWorkoutReminders(),
    NotificationService.scheduleGoalAtRiskReminder(),
    NutritionNotificationService.scheduleNutritionOverview(),
    NutritionNotificationService.scheduleCheckinNotifications(),
    CycleNotificationService.scheduleMenstrualCycleNotifications(),
  ]);
}
