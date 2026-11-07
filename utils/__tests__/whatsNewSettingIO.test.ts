import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';

import { WHATS_NEW_SETTING_IO, writeWhatsNewSetting } from '../whatsNew/settingIO';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: require('@/database/services/__tests__/settingsGetMock').settingsGetMock({
      workoutView: 'guided',
      reviewWeekday: 1,
    }),
    set: jest.fn(async () => undefined),
  },
}));
jest.mock('@/services/NutritionNotificationService', () => ({
  NutritionNotificationService: {
    scheduleWeeklyReviewNotification: jest.fn(async () => undefined),
  },
}));
beforeEach(() => jest.clearAllMocks());
test('reads persisted defaults, writes only valid values', async () => {
  expect(await WHATS_NEW_SETTING_IO.workoutView.read()).toBe('guided');
  await writeWhatsNewSetting('workoutView', 'inline');
  expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.workoutView, 'inline');
  await expect(writeWhatsNewSetting('workoutView', 'bad')).rejects.toThrow();
  await expect(writeWhatsNewSetting('restTimerHaptics', 'true')).rejects.toThrow();
  await expect(writeWhatsNewSetting('reviewWeekday', 7)).rejects.toThrow();
  expect(SettingsService.set).toHaveBeenCalledTimes(1);
});
test('Loggy toggles read and write the same settings as Appearance and home', async () => {
  expect(await WHATS_NEW_SETTING_IO.showLoggy.read()).toBe(true);
  expect(await WHATS_NEW_SETTING_IO.animatedLoggy.read()).toBe(true);
  await writeWhatsNewSetting('showLoggy', false);
  await writeWhatsNewSetting('animatedLoggy', false);
  expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.showLoggy, false);
  expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.animatedLoggy, false);
  await expect(writeWhatsNewSetting('showLoggy', 'off')).rejects.toThrow();
  expect(SettingsService.set).toHaveBeenCalledTimes(2);
});
test('reschedules only after a successful weekday write', async () => {
  await writeWhatsNewSetting('reviewWeekday', 5);
  expect(SettingsService.set).toHaveBeenCalledWith(SETTINGS.reviewWeekday, 5);
  expect(NutritionNotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(1);
  jest.mocked(SettingsService.set).mockRejectedValueOnce(new Error('disk'));
  await expect(writeWhatsNewSetting('reviewWeekday', 3)).rejects.toThrow('disk');
  expect(NutritionNotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(1);
});

test('restores the weekday when rescheduling fails after persistence', async () => {
  jest
    .mocked(NutritionNotificationService.scheduleWeeklyReviewNotification)
    .mockRejectedValueOnce(new Error('notifications'));
  await expect(writeWhatsNewSetting('reviewWeekday', 5)).rejects.toThrow('notifications');
  expect(SettingsService.set).toHaveBeenNthCalledWith(1, SETTINGS.reviewWeekday, 5);
  expect(SettingsService.set).toHaveBeenLastCalledWith(SETTINGS.reviewWeekday, 1);
  expect(NutritionNotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(2);
});
