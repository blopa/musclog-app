import { SETTINGS } from '@/constants/settingDefinitions';
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
    read: () => SettingsService.get(SETTINGS.workoutView),
    write: (v) => SettingsService.set(SETTINGS.workoutView, v),
  },
  workoutAutonomy: {
    read: () => SettingsService.get(SETTINGS.workoutAutonomy),
    write: (v) => SettingsService.set(SETTINGS.workoutAutonomy, v),
  },
  progressionMode: {
    read: () => SettingsService.getProgressionMode(),
    write: (v) => SettingsService.setProgressionMode(v),
  },
  autoStartRestTimer: {
    read: () => SettingsService.get(SETTINGS.autoStartRestTimer),
    write: (v) => SettingsService.set(SETTINGS.autoStartRestTimer, v),
  },
  restTimerHaptics: {
    read: () => SettingsService.get(SETTINGS.restTimerHaptics),
    write: (v) => SettingsService.set(SETTINGS.restTimerHaptics, v),
  },
  reviewWeekday: {
    read: () => SettingsService.get(SETTINGS.reviewWeekday),
    write: async (value) => {
      const previous = await SettingsService.get(SETTINGS.reviewWeekday);
      await SettingsService.set(SETTINGS.reviewWeekday, value);
      try {
        await NutritionNotificationService.scheduleWeeklyReviewNotification();
      } catch (error) {
        // Match the reverted choice if notification scheduling fails after the setting saved.
        await SettingsService.set(SETTINGS.reviewWeekday, previous);
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
