import { refreshAllNotifications } from '@/services/notificationRefresh';

const mockRun = jest.fn(async (..._args: unknown[]) => undefined);
const mockActivity = jest.fn();
const mockState = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    scheduleWorkoutReminders: (options: unknown) => mockRun('workout', options),
    scheduleGoalAtRiskReminder: (options: unknown) => mockRun('goal', options),
  },
}));
jest.mock('@/services/NutritionNotificationService', () => ({
  NutritionNotificationService: {
    scheduleNutritionOverview: (options: unknown) => mockRun('overview', options),
    scheduleCheckinNotifications: () => mockRun(),
  },
}));
jest.mock('@/services/ComebackNotificationService', () => ({
  ComebackNotificationService: {
    scheduleWelcomeBack: (context: unknown) => mockRun('welcome', context),
  },
}));
jest.mock('@/database/repositories/ActivityRepository', () => ({
  ActivityRepository: { lastActivity: () => mockActivity() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: () => mockState() },
}));
jest.mock('@/services/CycleNotificationService', () => ({
  CycleNotificationService: { scheduleMenstrualCycleNotifications: () => mockRun() },
}));

const DAY = 24 * 60 * 60 * 1000;

describe('refreshAllNotifications', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockActivity.mockResolvedValue({
      lastWorkoutAt: Date.now() - DAY,
      lastFoodAt: null,
      lastWeighInAt: null,
    });
    mockState.mockResolvedValue({ status: 'none' });
  });

  const optionsFor = (name: string) => mockRun.mock.calls.find(([key]) => key === name)?.[1];

  it('re-plans every reminder family', async () => {
    await refreshAllNotifications();
    expect(mockRun).toHaveBeenCalledTimes(6);
  });

  it('keeps reminders on for someone who is active', async () => {
    await refreshAllNotifications();
    expect(optionsFor('workout')).toEqual({ backOff: false });
    expect(optionsFor('overview')).toEqual({ backOff: false });
  });

  it('backs the reminders off after two weeks of silence, but not during a comeback', async () => {
    mockActivity.mockResolvedValue({
      lastWorkoutAt: Date.now() - 40 * DAY,
      lastFoodAt: null,
      lastWeighInAt: null,
    });
    await refreshAllNotifications();
    expect(optionsFor('workout')).toEqual({ backOff: true });
    expect(optionsFor('goal')).toEqual({ backOff: true });
    expect(optionsFor('overview')).toEqual({ backOff: true });

    mockRun.mockClear();
    mockState.mockResolvedValue({ status: 'active' });
    await refreshAllNotifications();
    expect(optionsFor('workout')).toEqual({ backOff: false });
  });

  it('still plans reminders when the activity read fails', async () => {
    mockActivity.mockRejectedValue(new Error('db'));
    await refreshAllNotifications();
    expect(optionsFor('workout')).toEqual({ backOff: false });
  });
});
