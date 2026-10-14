import { SettingsService } from '@/database/services/SettingsService';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';

import {
  isWhatsNewSettingValue,
  type WhatsNewSetting,
  type WhatsNewSettingValues,
} from './catalog';

type SettingIO = {
  [K in WhatsNewSetting]: {
    read: () => Promise<WhatsNewSettingValues[K]>;
    write: (value: WhatsNewSettingValues[K]) => Promise<void>;
  };
};
export const WHATS_NEW_SETTING_IO: SettingIO = {
  workoutView: {
    read: () => SettingsService.getWorkoutView(),
    write: (v) => SettingsService.setWorkoutView(v),
  },
  workoutAutonomy: {
    read: () => SettingsService.getWorkoutAutonomy(),
    write: (v) => SettingsService.setWorkoutAutonomy(v),
  },
  progressionMode: {
    read: () => SettingsService.getProgressionMode(),
    write: (v) => SettingsService.setProgressionMode(v),
  },
  autoStartRestTimer: {
    read: () => SettingsService.getAutoStartRestTimer(),
    write: (v) => SettingsService.setAutoStartRestTimer(v),
  },
  restTimerHaptics: {
    read: () => SettingsService.getRestTimerHaptics(),
    write: (v) => SettingsService.setRestTimerHaptics(v),
  },
  reviewWeekday: {
    read: () => SettingsService.getReviewWeekday(),
    write: async (value) => {
      const previous = await SettingsService.getReviewWeekday();
      await SettingsService.setReviewWeekday(value);
      try {
        await NutritionNotificationService.scheduleWeeklyReviewNotification();
      } catch (error) {
        // Match the reverted choice if notification scheduling fails after the setting saved.
        await SettingsService.setReviewWeekday(previous);
        await NutritionNotificationService.scheduleWeeklyReviewNotification().catch(
          () => undefined
        );
        throw error;
      }
    },
  },
};

export async function writeWhatsNewSetting<K extends WhatsNewSetting>(
  setting: K,
  value: unknown
): Promise<void> {
  if (!isWhatsNewSettingValue(setting, value)) {
    throw new Error(`Invalid value for ${setting}`);
  }

  await (WHATS_NEW_SETTING_IO[setting] as SettingIO[K]).write(value);
}
