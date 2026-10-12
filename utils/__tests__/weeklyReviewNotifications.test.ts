import { router } from 'expo-router';
import { handleNotificationResponse } from '@/utils/notifications';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-notifications', () => ({}));
it.each([
  [{ type: 'weekly-review', reviewId: 'r 1' }, '/app/nutrition/checkin-list?reviewId=r%201'],
  [{ type: 'weekly-review', reviewDay: 100 }, '/app/nutrition/checkin-list?reviewDay=100'],
  [{ type: 'nutrition-checkin', checkinId: 'c1' }, '/app/nutrition/checkin-list?checkinId=c1'],
  [{ type: 'nutrition-checkin' }, '/app/nutrition/checkin-list'],
])('opens the relevant weekly or legacy review (%s)', async (data, path) => {
  jest.clearAllMocks();
  await handleNotificationResponse({ notification: { request: { content: { data } } } } as any);
  expect(router.navigate).toHaveBeenCalledWith(path);
});
