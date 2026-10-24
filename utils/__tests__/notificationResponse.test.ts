import type { NotificationResponse } from 'expo-notifications';

import { CycleNotificationService } from '@/services/CycleNotificationService';
import { NotificationService } from '@/services/NotificationService';
import { handleNotificationResponse } from '@/utils/notifications';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));
jest.mock('expo-notifications', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    extendRestFromNotification: jest.fn(),
    snoozeReminder: jest.fn(),
  },
}));

jest.mock('@/services/CycleNotificationService', () => ({
  CycleNotificationService: {
    recordPillAnswer: jest.fn(),
    snoozePill: jest.fn(),
    snoozeReminder: jest.fn(),
  },
}));

const cycle = CycleNotificationService as jest.Mocked<typeof CycleNotificationService>;
const workout = NotificationService as jest.Mocked<typeof NotificationService>;

const response = (
  data: Record<string, unknown>,
  actionIdentifier = 'expo.modules.notifications.actions.DEFAULT'
) =>
  ({
    actionIdentifier,
    notification: { request: { content: { title: 'T', body: 'B', data } } },
  }) as unknown as NotificationResponse;

describe('handleNotificationResponse: cycle buttons', () => {
  beforeEach(() => jest.clearAllMocks());
  const pillData = { type: 'menstrual-cycle', subtype: 'pill' };

  it('records "Done" as taken and "Skip" as skipped, without opening the app', async () => {
    await handleNotificationResponse(response(pillData, 'pill-done'));
    await handleNotificationResponse(response(pillData, 'pill-skip'));
    expect(cycle.recordPillAnswer.mock.calls).toEqual([['taken'], ['skipped']]);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('defers a pill reminder on "Later" and any other cycle reminder on "Snooze"', async () => {
    await handleNotificationResponse(response(pillData, 'pill-later'));
    expect(cycle.snoozePill).toHaveBeenCalledTimes(1);
    await handleNotificationResponse(
      response({ type: 'menstrual-cycle', subtype: 'period-start' }, 'cycle-snooze')
    );
    expect(cycle.snoozeReminder).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens the explainer for a tap on the body, for an ordinary and a snoozed reminder alike', async () => {
    await handleNotificationResponse(response({ type: 'menstrual-cycle', subtype: 'pill' }));
    await handleNotificationResponse(response({ type: 'menstrual-cycle-snooze', subtype: 'pill' }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/app/cycle?reminder=pill');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/app/cycle?reminder=pill');
    expect(cycle.recordPillAnswer).not.toHaveBeenCalled();
  });

  it('keeps the workout buttons working', async () => {
    await handleNotificationResponse(
      response({ type: 'rest-timer-alert', workoutLogId: 'log1' }, 'rest-add-time')
    );
    expect(workout.extendRestFromNotification).toHaveBeenCalledWith('log1');
    await handleNotificationResponse(response({ type: 'workout-reminder' }, 'reminder-snooze'));
    expect(workout.snoozeReminder).toHaveBeenCalledTimes(1);
  });
});

describe('handleNotificationResponse: workout reminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the workouts screen with the reminder explained, from the context it carries', async () => {
    await handleNotificationResponse(
      response({
        type: 'workout-reminder',
        templateId: 't1',
        dayIndex: 2,
        reminderTime: '08:00',
        leadMinutes: 15,
        fromPlan: true,
      })
    );
    const route = mockNavigate.mock.calls[0][0] as string;
    expect(route.startsWith('/app/workout/workouts?')).toBe(true);
    const query = new URLSearchParams(route.split('?')[1]);
    expect(Object.fromEntries(query)).toEqual({
      reminderTemplateId: 't1',
      reminderDay: '2',
      reminderTime: '08:00',
      reminderLead: '15',
      reminderPlan: '1',
    });
  });

  it('opens the plain list for a reminder without a workout', async () => {
    await handleNotificationResponse(response({ type: 'workout-reminder' }));
    expect(mockNavigate).toHaveBeenCalledWith('/app/workout/workouts');
  });
});
