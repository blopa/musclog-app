import { Platform } from 'react-native';

import { SETTINGS } from '@/constants/settingDefinitions';
import { ActivityRepository } from '@/database/repositories/ActivityRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { ComebackNotificationService } from '@/services/ComebackNotificationService';
import { CycleNotificationService } from '@/services/CycleNotificationService';
import { NotificationService } from '@/services/NotificationService';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';
import {
  type ComebackReminderContext,
  shouldBackOffReminders,
} from '@/utils/comeback/comebackNotifications';

/**
 * The facts comeback mode needs to plan reminders, read once for the whole pass. A failure here must
 * never stop the reminders themselves, so it reads as "no comeback, no lapse".
 */
async function loadComebackContext(): Promise<ComebackReminderContext> {
  const now = Date.now();
  try {
    const [activity, state] = await Promise.all([
      ActivityRepository.lastActivity(),
      SettingsService.get(SETTINGS.comebackState),
    ]);
    const stamps = [activity.lastWorkoutAt, activity.lastFoodAt, activity.lastWeighInAt].filter(
      (value): value is number => value !== null
    );

    return {
      lastActivityAt: stamps.length > 0 ? Math.max(...stamps) : null,
      comebackActive: state.status === 'active',
      now,
    };
  } catch {
    return { lastActivityAt: null, comebackActive: false, now };
  }
}

/**
 * Re-plans every offline reminder. Cheap and idempotent: boot, foreground and workout end all call
 * it. The planners touch disjoint notification types, so they run side by side.
 */
export async function refreshAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const comeback = await loadComebackContext();
  const backOff = shouldBackOffReminders(comeback);

  await Promise.all([
    NotificationService.scheduleWorkoutReminders({ backOff }),
    NotificationService.scheduleGoalAtRiskReminder({ backOff }),
    NutritionNotificationService.scheduleNutritionOverview({ backOff }),
    NutritionNotificationService.scheduleCheckinNotifications(),
    CycleNotificationService.scheduleMenstrualCycleNotifications(),
    ComebackNotificationService.scheduleWelcomeBack(comeback),
  ]);
}
