import { router } from 'expo-router';
import { handleNotificationResponse } from '@/utils/notifications';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-notifications', () => ({}));
it.each([
  [{ type: 'weekly-review', reviewId: 'r 1' }, '/app/weekly-review?reviewId=r%201'],
  [{ type: 'weekly-review', reviewDay: 100 }, '/app/weekly-review?reviewDay=100'],
  [{ type: 'nutrition-checkin', checkinId: 'c1' }, '/app/weekly-review?checkinId=c1'],
  [{ type: 'nutrition-checkin' }, '/app/weekly-review'],
])('opens the relevant weekly or legacy review (%s)', async (data, path) => {
  jest.clearAllMocks();
  await handleNotificationResponse({ notification: { request: { content: { data } } } } as any);
  expect(router.navigate).toHaveBeenCalledWith(path);
});
