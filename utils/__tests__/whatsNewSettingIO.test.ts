import { SettingsService } from '@/database/services/SettingsService';
import { NotificationService } from '@/services/NotificationService';

import { WHATS_NEW_SETTING_IO, writeWhatsNewSetting } from '../whatsNew/settingIO';

jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {
  getWorkoutView: jest.fn(async () => 'guided'), setWorkoutView: jest.fn(async () => undefined),
  getReviewWeekday: jest.fn(async () => 1), setReviewWeekday: jest.fn(async () => undefined),
} }));
jest.mock('@/services/NotificationService', () => ({ NotificationService: { scheduleWeeklyReviewNotification: jest.fn(async () => undefined) } }));
beforeEach(() => jest.clearAllMocks());
test('reads persisted defaults, writes only valid values', async () => {
  expect(await WHATS_NEW_SETTING_IO.workoutView.read()).toBe('guided');
  await writeWhatsNewSetting('workoutView', 'inline');
  expect(SettingsService.setWorkoutView).toHaveBeenCalledWith('inline');
  await expect(writeWhatsNewSetting('workoutView', 'bad')).rejects.toThrow();
  await expect(writeWhatsNewSetting('restTimerHaptics', 'true')).rejects.toThrow();
  await expect(writeWhatsNewSetting('reviewWeekday', 7)).rejects.toThrow();
  expect(SettingsService.setWorkoutView).toHaveBeenCalledTimes(1);
});
test('reschedules only after a successful weekday write', async () => {
  await writeWhatsNewSetting('reviewWeekday', 5);
  expect(SettingsService.setReviewWeekday).toHaveBeenCalledWith(5);
  expect(NotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(1);
  jest.mocked(SettingsService.setReviewWeekday).mockRejectedValueOnce(new Error('disk'));
  await expect(writeWhatsNewSetting('reviewWeekday', 3)).rejects.toThrow('disk');
  expect(NotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(1);
});

test('restores the weekday when rescheduling fails after persistence', async () => {
  jest.mocked(NotificationService.scheduleWeeklyReviewNotification).mockRejectedValueOnce(new Error('notifications'));
  await expect(writeWhatsNewSetting('reviewWeekday', 5)).rejects.toThrow('notifications');
  expect(SettingsService.setReviewWeekday).toHaveBeenNthCalledWith(1, 5);
  expect(SettingsService.setReviewWeekday).toHaveBeenLastCalledWith(1);
  expect(NotificationService.scheduleWeeklyReviewNotification).toHaveBeenCalledTimes(2);
});
